const fs = require('fs');

const SHOPIFY_URL = `https://${process.env.SHOPIFY_STORE}/admin/api/2026-01/graphql.json`;
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function fetchPage(cursor) {
  const afterClause = cursor ? `, after: "${cursor}"` : '';
  const query = `{ products(first: 250${afterClause}) { edges { node { id title variants(first: 5) { edges { node { sku } } } images(first: 20) { edges { node { url altText } } } } } pageInfo { hasNextPage endCursor } } }`;

  const resp = await fetch(SHOPIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': TOKEN },
    body: JSON.stringify({ query })
  });
  const json = await resp.json();
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors));
    return null;
  }
  return json;
}

async function main() {
  let allProducts = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const data = await fetchPage(cursor);
    if (!data || !data.data || !data.data.products) {
      console.error('Failed on page ' + page);
      break;
    }
    const products = data.data.products.edges;
    allProducts = allProducts.concat(products);
    const pageInfo = data.data.products.pageInfo;
    console.error(`Page ${page}: ${products.length} products (total: ${allProducts.length})`);

    if (!pageInfo.hasNextPage) break;
    cursor = pageInfo.endCursor;
  }

  // Extract SKU -> images mapping
  const result = [];
  allProducts.forEach(p => {
    const node = p.node;
    const skus = [...new Set(node.variants.edges.map(v => v.node.sku).filter(Boolean))];
    const images = node.images.edges.map((img, i) => ({
      url: img.node.url,
      alt_text: img.node.altText || null,
      position: i + 1
    }));

    if (skus.length > 0 && images.length > 0) {
      result.push({ shopify_id: node.id, title: node.title, skus, images });
    }
  });

  console.error(`Total: ${allProducts.length} products, ${result.length} with both SKU and images`);
  const outPath = process.env.TEMP + '/shopify_all_products.json';
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(outPath);
}

main().catch(e => console.error(e));
