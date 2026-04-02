const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'product-images';

async function downloadImage(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

function getContentType(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return types[ext] || 'image/jpeg';
}

function getExtension(url) {
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
}

async function uploadToStorage(filePath, buffer, contentType) {
  const resp = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    }
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upload failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

async function main() {
  // Load matched products from Supabase
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT pi.id as image_id, pi.product_id, pi.image_url as shopify_url, pm.jan
    FROM product_images pi
    JOIN product_master pm ON pm.id = pi.product_id
    WHERE pi.source = 'shopify'
    ORDER BY pm.jan
  `);
  console.log(`Total images to process: ${rows.length}`);

  let success = 0, errors = 0;
  const CONCURRENCY = 10;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (row) => {
      try {
        const ext = getExtension(row.shopify_url);
        const contentType = getContentType(row.shopify_url);
        const storagePath = `${row.jan}.${ext}`;

        // Download from Shopify CDN
        const buffer = await downloadImage(row.shopify_url);

        // Upload to Supabase Storage
        await uploadToStorage(storagePath, buffer, contentType);

        // Build public URL
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;

        // Update product_images row
        await client.query(
          'UPDATE product_images SET image_url = $1, source = $2 WHERE id = $3',
          [publicUrl, 'supabase-storage', row.image_id]
        );

        // Update product_master.image_url
        await client.query(
          'UPDATE product_master SET image_url = $1 WHERE id = $2',
          [publicUrl, row.product_id]
        );

        success++;
      } catch (e) {
        errors++;
        console.error(`  Error [${row.jan}]: ${e.message}`);
      }
    });
    await Promise.all(promises);
    process.stderr.write(`\r  Progress: ${Math.min(i + CONCURRENCY, rows.length)}/${rows.length} (ok: ${success}, err: ${errors})`);
  }

  console.log(`\n\n=== Done ===`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);
  console.log(`Storage URL format: ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/{jan}.{ext}`);

  await client.end();
}

main().catch(e => console.error(e));
