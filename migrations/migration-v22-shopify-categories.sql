-- ============================================================================
-- Migration: v22 - Shopify categories & collections
-- Description: Shopifyのカテゴリー(Taxonomy)とコレクション情報を管理
-- ============================================================================

-- product_master にカテゴリーカラム追加 (volume_ml は追加済み)
ALTER TABLE product_master ADD COLUMN IF NOT EXISTS shopify_category_id TEXT;
ALTER TABLE product_master ADD COLUMN IF NOT EXISTS shopify_category_name TEXT;
ALTER TABLE product_master ADD COLUMN IF NOT EXISTS shopify_category_full TEXT;

-- コレクションマスタ
CREATE TABLE IF NOT EXISTS shopify_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  handle TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE shopify_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on shopify_collections" ON shopify_collections
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- 商品×コレクション中間テーブル
CREATE TABLE IF NOT EXISTS product_collections (
  product_id UUID REFERENCES product_master(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES shopify_collections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, collection_id)
);

ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on product_collections" ON product_collections
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX idx_product_collections_product_id ON product_collections(product_id);
CREATE INDEX idx_product_collections_collection_id ON product_collections(collection_id);
