const { Client } = require('pg');
const fs = require('fs');

const SHOPIFY_URL = `https://${process.env.SHOPIFY_STORE}/admin/api/2026-01/graphql.json`;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const PG_CONN = process.env.DATABASE_URL;

// ── Shopify fetch ──────────────────────────────────────────────
async function fetchAllProducts() {
  let all = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const afterClause = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      products(first: 250${afterClause}) {
        edges {
          node {
            id title
            variants(first: 1) { edges { node { sku } } }
            category { id name fullName }
            collections(first: 20) { edges { node { id title handle } } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const resp = await fetch(SHOPIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': SHOPIFY_TOKEN },
      body: JSON.stringify({ query })
    });
    const json = await resp.json();
    if (!json.data || !json.data.products) {
      console.error('API error on page', page, JSON.stringify(json.errors || json));
      break;
    }

    const products = json.data.products.edges;
    all = all.concat(products);
    console.log(`  Page ${page}: ${products.length} products (total: ${all.length})`);

    if (!json.data.products.pageInfo.hasNextPage) break;
    cursor = json.data.products.pageInfo.endCursor;
  }
  return all;
}

// ── Parse volume/weight from title ─────────────────────────────
function parseVolumeWeight(title) {
  // Match patterns like "440ml", "60mL", "200ML", "1.0L"
  const mlMatch = title.match(/(\d+(?:\.\d+)?)\s*(?:ml|mL|ML)\b/);
  const lMatch = title.match(/(\d+(?:\.\d+)?)\s*L\b/);
  const gMatch = title.match(/(\d+(?:\.\d+)?)\s*g\b/i);

  let volume_ml = null;
  let weight_g = null;

  if (mlMatch) {
    volume_ml = parseFloat(mlMatch[1]);
  } else if (lMatch) {
    volume_ml = parseFloat(lMatch[1]) * 1000;
  }

  if (gMatch) {
    weight_g = parseFloat(gMatch[1]);
  }

  return { volume_ml, weight_g };
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('=== Fetching Shopify products ===');
  const shopifyProducts = await fetchAllProducts();
  console.log(`Total Shopify products: ${shopifyProducts.length}\n`);

  // Connect to DB
  const client = new Client({ connectionString: PG_CONN, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Load all JAN -> product_id map from Supabase
  const { rows: dbProducts } = await client.query('SELECT id, jan, volume_ml, weight_g FROM product_master');
  const janMap = {};
  dbProducts.forEach(p => { janMap[p.jan] = p; });
  console.log(`Supabase products: ${dbProducts.length}\n`);

  // Build matched data
  const matched = [];
  shopifyProducts.forEach(sp => {
    const node = sp.node;
    const sku = node.variants.edges[0]?.node?.sku;
    if (!sku || !janMap[sku]) return;

    matched.push({
      product_id: janMap[sku].id,
      jan: sku,
      title: node.title,
      current_volume: janMap[sku].volume_ml,
      current_weight: janMap[sku].weight_g,
      category: node.category,
      collections: node.collections.edges.map(c => ({
        shopify_id: c.node.id,
        title: c.node.title,
        handle: c.node.handle
      }))
    });
  });
  console.log(`Matched products: ${matched.length}\n`);

  // ── Step 1: Update volume_ml and weight_g ──
  console.log('=== Step 1: volume_ml / weight_g ===');
  let volUpdated = 0, weightUpdated = 0;
  for (const m of matched) {
    const { volume_ml, weight_g } = parseVolumeWeight(m.title);

    if (volume_ml !== null && m.current_volume === null) {
      await client.query('UPDATE product_master SET volume_ml = $1 WHERE id = $2', [volume_ml, m.product_id]);
      volUpdated++;
    }
    if (weight_g !== null && (m.current_weight === null || m.current_weight === 0)) {
      await client.query('UPDATE product_master SET weight_g = $1 WHERE id = $2', [weight_g, m.product_id]);
      weightUpdated++;
    }
  }
  console.log(`  volume_ml updated: ${volUpdated}`);
  console.log(`  weight_g updated: ${weightUpdated}\n`);

  // ── Step 2: Update shopify_category ──
  console.log('=== Step 2: shopify_category ===');
  let catUpdated = 0;
  for (const m of matched) {
    if (m.category) {
      await client.query(
        'UPDATE product_master SET shopify_category_id = $1, shopify_category_name = $2, shopify_category_full = $3 WHERE id = $4',
        [m.category.id, m.category.name, m.category.fullName, m.product_id]
      );
      catUpdated++;
    }
  }
  console.log(`  Categories updated: ${catUpdated}\n`);

  // ── Step 3: Insert collections ──
  console.log('=== Step 3: shopify_collections + product_collections ===');

  // Collect all unique collections
  const allCollections = new Map();
  matched.forEach(m => {
    m.collections.forEach(c => {
      if (!allCollections.has(c.shopify_id)) {
        allCollections.set(c.shopify_id, c);
      }
    });
  });
  console.log(`  Unique collections: ${allCollections.size}`);

  // Insert collections (upsert)
  const collectionIdMap = {}; // shopify_id -> uuid
  for (const [shopifyId, col] of allCollections) {
    const { rows } = await client.query(
      `INSERT INTO shopify_collections (shopify_id, title, handle)
       VALUES ($1, $2, $3)
       ON CONFLICT (shopify_id) DO UPDATE SET title = $2, handle = $3
       RETURNING id`,
      [shopifyId, col.title, col.handle]
    );
    collectionIdMap[shopifyId] = rows[0].id;
  }
  console.log(`  Collections upserted: ${allCollections.size}`);

  // Insert product_collections
  let pcInserted = 0;
  for (const m of matched) {
    for (const col of m.collections) {
      const colUuid = collectionIdMap[col.shopify_id];
      if (!colUuid) continue;
      try {
        await client.query(
          'INSERT INTO product_collections (product_id, collection_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [m.product_id, colUuid]
        );
        pcInserted++;
      } catch (e) {
        // skip duplicates
      }
    }
  }
  console.log(`  Product-collection links inserted: ${pcInserted}\n`);

  // ── Summary ──
  console.log('=== Summary ===');
  console.log(`Matched: ${matched.length} products`);
  console.log(`volume_ml updated: ${volUpdated}`);
  console.log(`weight_g updated: ${weightUpdated}`);
  console.log(`Categories set: ${catUpdated}`);
  console.log(`Collections: ${allCollections.size}`);
  console.log(`Product-collection links: ${pcInserted}`);

  await client.end();
}

main().catch(e => console.error(e));
