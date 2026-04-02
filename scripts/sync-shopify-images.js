const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': 'Bearer ' + SERVICE_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal'
};

async function fetchAllSupabaseProducts() {
  let all = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/product_master?select=jan,id,name_en&limit=${limit}&offset=${offset}`, {
      headers: HEADERS
    });
    const data = await resp.json();
    all = all.concat(data);
    if (data.length < limit) break;
    offset += limit;
  }
  return all;
}

async function main() {
  const shopifyData = require('C:/Users/josep/AppData/Local/Temp/shopify_all_products.json');
  console.log(`Shopify products loaded: ${shopifyData.length}`);

  // Fetch all Supabase products
  const supabaseProducts = await fetchAllSupabaseProducts();
  console.log(`Supabase products loaded: ${supabaseProducts.length}`);

  // Build JAN -> product map
  const janMap = {};
  supabaseProducts.forEach(p => { janMap[p.jan] = p; });

  // Build matched list
  const matched = [];
  shopifyData.forEach(sp => {
    const sku = sp.skus[0];
    if (janMap[sku]) {
      matched.push({
        product_id: janMap[sku].id,
        jan: sku,
        images: sp.images
      });
    }
  });
  console.log(`Matched products: ${matched.length}`);

  // === Step 1: Update product_master.image_url with main Shopify image ===
  console.log('\n--- Step 1: Updating product_master.image_url ---');
  let updateCount = 0;
  let updateErrors = 0;

  // Batch updates in groups of 50
  for (let i = 0; i < matched.length; i += 50) {
    const batch = matched.slice(i, i + 50);
    const promises = batch.map(async (m) => {
      const mainImage = m.images[0].url;
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/product_master?id=eq.${m.product_id}`,
        {
          method: 'PATCH',
          headers: HEADERS,
          body: JSON.stringify({ image_url: mainImage })
        }
      );
      if (resp.ok) {
        updateCount++;
      } else {
        updateErrors++;
        const text = await resp.text();
        console.error(`  Error updating ${m.jan}: ${text}`);
      }
    });
    await Promise.all(promises);
    process.stderr.write(`\r  Updated: ${updateCount}/${matched.length}`);
  }
  console.log(`\n  Done: ${updateCount} updated, ${updateErrors} errors`);

  // === Step 2: Insert into product_images table ===
  console.log('\n--- Step 2: Inserting into product_images ---');
  let insertCount = 0;
  let insertErrors = 0;

  // Build all image rows
  const allImageRows = [];
  matched.forEach(m => {
    m.images.forEach(img => {
      allImageRows.push({
        product_id: m.product_id,
        image_url: img.url,
        alt_text: img.alt_text,
        position: img.position,
        source: 'shopify'
      });
    });
  });
  console.log(`  Total image rows to insert: ${allImageRows.length}`);

  // Batch inserts in groups of 100
  for (let i = 0; i < allImageRows.length; i += 100) {
    const batch = allImageRows.slice(i, i + 100);
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/product_images`,
      {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(batch)
      }
    );
    if (resp.ok) {
      insertCount += batch.length;
    } else {
      insertErrors += batch.length;
      const text = await resp.text();
      console.error(`  Error inserting batch at ${i}: ${text}`);
    }
    process.stderr.write(`\r  Inserted: ${insertCount}/${allImageRows.length}`);
  }
  console.log(`\n  Done: ${insertCount} inserted, ${insertErrors} errors`);

  // === Summary ===
  console.log('\n=== Summary ===');
  console.log(`Shopify products: ${shopifyData.length}`);
  console.log(`Supabase products: ${supabaseProducts.length}`);
  console.log(`JAN matched: ${matched.length}`);
  console.log(`product_master.image_url updated: ${updateCount}`);
  console.log(`product_images rows inserted: ${insertCount}`);
}

main().catch(e => console.error(e));
