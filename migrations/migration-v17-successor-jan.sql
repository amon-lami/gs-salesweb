-- ============================================================================
-- Migration v17: 商品マスタに後継品JANコード列を追加
-- 廃盤品 → リニューアル品のJANコード紐付けに使用
-- ============================================================================

ALTER TABLE product_master ADD COLUMN IF NOT EXISTS successor_jan TEXT;

-- インデックス: 後継品JANでの検索を高速化
CREATE INDEX IF NOT EXISTS idx_product_master_successor_jan ON product_master(successor_jan) WHERE successor_jan IS NOT NULL;

-- コメント
COMMENT ON COLUMN product_master.successor_jan IS '後継品（リニューアル品）のJANコード。廃盤時に設定する。';
