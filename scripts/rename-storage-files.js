const { Client } = require('pg');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'product-images';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const { rows } = await client.query(
    "SELECT pi.id as image_id, pi.product_id, pi.image_url, pi.position, pm.jan " +
    "FROM product_images pi " +
    "JOIN product_master pm ON pm.id = pi.product_id " +
    "WHERE pi.source = 'supabase-storage'"
  );
  console.log('Images to rename:', rows.length);

  let success = 0, errors = 0;

  for (const row of rows) {
    try {
      const ext = row.image_url.split('?')[0].split('.').pop();
      const oldPath = row.jan + '.' + ext;
      const newPath = row.jan + '-' + row.position + '.' + ext;

      // Download current file
      const imgResp = await fetch(row.image_url);
      if (!imgResp.ok) throw new Error('Download failed: ' + imgResp.status);
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg';

      // Upload with new name
      const uploadResp = await fetch(
        SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + newPath,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Content-Type': contentType,
            'x-upsert': 'true'
          },
          body: buffer
        }
      );
      if (!uploadResp.ok) throw new Error('Upload failed: ' + (await uploadResp.text()));

      const newUrl = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + newPath;

      // Update product_images
      await client.query('UPDATE product_images SET image_url = $1 WHERE id = $2', [newUrl, row.image_id]);

      // Update product_master for main image
      if (row.position === 1) {
        await client.query('UPDATE product_master SET image_url = $1 WHERE id = $2', [newUrl, row.product_id]);
      }

      // Delete old file
      await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + oldPath, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + SERVICE_KEY }
      });

      success++;
    } catch (e) {
      errors++;
      console.error('  Error [' + row.jan + ']: ' + e.message);
    }

    if ((success + errors) % 50 === 0) {
      console.log('  Progress: ' + (success + errors) + '/' + rows.length + ' (ok: ' + success + ', err: ' + errors + ')');
    }
  }

  console.log('\nDone: ' + success + ' renamed, ' + errors + ' errors');
  console.log('New format: {JAN}-{position}.{ext}');
  await client.end();
}

main().catch(e => console.error(e));
