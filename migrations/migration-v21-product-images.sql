-- ============================================================================
-- Migration: v21 - product_images table
-- Description: Shopify画像を含む複数画像を商品ごとに管理するテーブル
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  position int DEFAULT 1,              -- 表示順 (1 = メイン画像)
  source text DEFAULT 'shopify',       -- 画像ソース (shopify, manual, etc.)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_position ON product_images(product_id, position);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on product_images" ON product_images
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_product_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_images_updated_at
  BEFORE UPDATE ON product_images
  FOR EACH ROW
  EXECUTE FUNCTION update_product_images_updated_at();
