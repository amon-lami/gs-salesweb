-- Migration v18: Order Management Tables
-- 発注管理テーブル（スプレッドシート「B to B 発注管理シート」のDB移行）

-- ステータスマスタテーブル（カスタムステータス追加可能）
CREATE TABLE IF NOT EXISTS order_statuses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#999999',
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on order_statuses" ON order_statuses
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- デフォルトステータスを挿入
INSERT INTO order_statuses (id, label, color, sort_order) VALUES
  ('ordered',    '発注済',      '#22c55e', 1),
  ('paid',       '振込完了',    '#a855f7', 2),
  ('sg_arrived', 'SG倉庫到着',  '#ec4899', 3),
  ('gs_arrived', 'GS到着',      '#f59e0b', 4),
  ('shipping',   '配送中',      '#3b82f6', 5),
  ('delivered',  'GS納品',      '#14b8a6', 6)
ON CONFLICT (id) DO NOTHING;

-- 発注アイテムテーブル
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  document_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  account_id UUID REFERENCES sales_accounts(id) ON DELETE SET NULL,
  product_id UUID,
  jan TEXT,
  name_en TEXT,
  name_ja TEXT,
  quantity INT NOT NULL DEFAULT 0,
  case_quantity INT,
  order_cases NUMERIC GENERATED ALWAYS AS (
    CASE WHEN case_quantity > 0 THEN ROUND(quantity::NUMERIC / case_quantity, 1) ELSE NULL END
  ) STORED,
  cost_price NUMERIC,
  cost_price_incl NUMERIC GENERATED ALWAYS AS (
    CASE WHEN cost_price IS NOT NULL THEN ROUND(cost_price * 1.1) ELSE NULL END
  ) STORED,
  total_cost NUMERIC GENERATED ALWAYS AS (
    CASE WHEN cost_price IS NOT NULL THEN ROUND(cost_price * 1.1 * quantity) ELSE NULL END
  ) STORED,
  selling_price NUMERIC,
  weight_g NUMERIC,
  supplier TEXT,
  status TEXT NOT NULL DEFAULT 'ordered' REFERENCES order_statuses(id),
  payment_date DATE,
  progress_shared_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated on order_items" ON order_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- updated_at トリガー（既存の update_updated_at_column 関数を再利用）
CREATE TRIGGER trigger_order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス
CREATE INDEX IF NOT EXISTS idx_order_items_deal ON order_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_order_items_document ON order_items(document_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
CREATE INDEX IF NOT EXISTS idx_order_items_supplier ON order_items(supplier);
CREATE INDEX IF NOT EXISTS idx_order_items_account ON order_items(account_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created ON order_items(created_at DESC);
