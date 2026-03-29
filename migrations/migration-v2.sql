-- ============================================
-- GS Sales CRM - Migration v2
-- ステージ・カテゴリ・インコタームズ・国・日程
-- ============================================

-- カテゴリテーブル（動的管理用）
CREATE TABLE IF NOT EXISTS sales_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#1a1a1a',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sales_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY scat_select ON sales_categories FOR SELECT USING (true);
CREATE POLICY scat_insert ON sales_categories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY scat_update ON sales_categories FOR UPDATE USING (true);
CREATE POLICY scat_delete ON sales_categories FOR DELETE USING (auth.uid() IS NOT NULL);

-- デフォルトカテゴリ挿入
INSERT INTO sales_categories (name, color, sort_order) VALUES
  ('J-Beauty', '#2563eb', 0),
  ('抹茶', '#059669', 1)
ON CONFLICT (name) DO NOTHING;

-- 取引先にカテゴリタグ(複数)と国を追加
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb;

-- 商談に新フィールド追加
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS incoterms TEXT DEFAULT '';
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS confidence INT DEFAULT 50;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS payment_confirmed_date DATE;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS shipping_date DATE;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS invoice_date DATE;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC(15,2);
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS invoice_file_url TEXT;

-- 週次レポートテーブル
CREATE TABLE IF NOT EXISTS sales_weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sales_weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY swr_select ON sales_weekly_reports FOR SELECT USING (true);
CREATE POLICY swr_insert ON sales_weekly_reports FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY swr_update ON sales_weekly_reports FOR UPDATE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_weekly_reports_deal ON sales_weekly_reports(deal_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON sales_weekly_reports(week_start);
