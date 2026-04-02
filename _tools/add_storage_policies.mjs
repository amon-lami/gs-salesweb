// Add RLS policies to storage.objects for product-images bucket
// Using the Supabase service role key which bypasses RLS for this query
// We'll use the SQL execute endpoint via pg module

import pg from 'pg';
const { Client } = pg;

// Connection details from memory
const client = new Client({
  host: 'db.yzwrumeukjidsguixqxr.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  // Try common Supabase password patterns
  password: process.env.PGPASSWORD || process.argv[2],
  ssl: { rejectUnauthorized: false }
});

try {
  await client.connect();
  console.log("Connected to Postgres!");

  // Check existing policies for storage.objects
  const { rows: existing } = await client.query(`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    ORDER BY policyname;
  `);
  console.log("Existing storage.objects policies:");
  existing.forEach(r => console.log(`  ${r.policyname} (${r.cmd})`));

  // Add policies for product-images
  const policies = [
    {
      name: 'product-images allow public select',
      cmd: 'SELECT',
      using: `bucket_id = 'product-images'`,
      check: null
    },
    {
      name: 'product-images allow authenticated insert',
      cmd: 'INSERT',
      using: null,
      check: `bucket_id = 'product-images' AND auth.role() = 'authenticated'`
    },
    {
      name: 'product-images allow authenticated update',
      cmd: 'UPDATE',
      using: `bucket_id = 'product-images' AND auth.role() = 'authenticated'`,
      check: `bucket_id = 'product-images' AND auth.role() = 'authenticated'`
    },
    {
      name: 'product-images allow authenticated delete',
      cmd: 'DELETE',
      using: `bucket_id = 'product-images' AND auth.role() = 'authenticated'`,
      check: null
    }
  ];

  for (const p of policies) {
    // Skip if already exists
    if (existing.some(e => e.policyname === p.name)) {
      console.log(`Policy already exists: ${p.name}`);
      continue;
    }
    let sql;
    if (p.cmd === 'INSERT') {
      sql = `CREATE POLICY "${p.name}" ON storage.objects FOR INSERT WITH CHECK (${p.check});`;
    } else if (p.cmd === 'UPDATE') {
      sql = `CREATE POLICY "${p.name}" ON storage.objects FOR UPDATE USING (${p.using}) WITH CHECK (${p.check});`;
    } else {
      sql = `CREATE POLICY "${p.name}" ON storage.objects FOR ${p.cmd} USING (${p.using});`;
    }
    console.log(`Creating: ${p.name}`);
    await client.query(sql);
    console.log(`  -> OK`);
  }

  console.log("\nDone!");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await client.end();
}
