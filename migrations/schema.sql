-- ============================================
-- GS Sales CRM - Database Schema
-- ============================================

-- 取引先（顧客/会社）
CREATE TABLE IF NOT EXISTS sales_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  address_billing TEXT,
  address_shipping TEXT,
  payment_terms TEXT, -- 例: "前払い100%", "Net30", "50%前払い/50%出荷後"
  notes TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 取引先責任者（顧客側の担当者）
CREATE TABLE IF NOT EXISTS sales_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES sales_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT, -- 例: "CEO", "Purchasing Manager"
  email TEXT,
  phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 商談カウンター（自動採番用）
CREATE SEQUENCE IF NOT EXISTS sales_deal_number_seq START WITH 1;

-- 商談
CREATE TABLE IF NOT EXISTS sales_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_number INT DEFAULT nextval('sales_deal_number_seq'),
  account_id UUID REFERENCES sales_accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL, -- 自動生成: "GS-0052 Sleek Shop (航空便)"
  amount NUMERIC(15,2) DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'negotiation',
  -- stages: negotiation, invoice_sent, payment_pending, order_placed, order_completed, goods_received, shipped, closed_won, closed_lost
  shipping_type TEXT DEFAULT 'sea', -- sea, air, domestic
  category TEXT DEFAULT 'beauty', -- beauty, matcha, other
  payment_status TEXT DEFAULT 'none', -- none, partial, full
  supplier_paid BOOLEAN DEFAULT false, -- 仕入れ全額支払い済みか
  payment_date DATE, -- 先方入金日
  close_date DATE, -- 完了予定日
  deal_date DATE DEFAULT CURRENT_DATE, -- 商談開始日
  invoice_url TEXT, -- Invoice添付URL
  spreadsheet_url TEXT, -- スプレッドシートリンク
  chat_room_id UUID, -- gs-chat連携
  owner_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 商談添付ファイル
CREATE TABLE IF NOT EXISTS sales_deal_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT,
  size INT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 商談アクティビティログ
CREATE TABLE IF NOT EXISTS sales_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  account_id UUID REFERENCES sales_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL, -- stage_change, note, file_upload, payment_update
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE sales_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_deal_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;

-- 全テーブル: 認証済みユーザーは全操作可能（社内ツール）
CREATE POLICY sa_select ON sales_accounts FOR SELECT USING (true);
CREATE POLICY sa_insert ON sales_accounts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sa_update ON sales_accounts FOR UPDATE USING (true);
CREATE POLICY sa_delete ON sales_accounts FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY sc_select ON sales_contacts FOR SELECT USING (true);
CREATE POLICY sc_insert ON sales_contacts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sc_update ON sales_contacts FOR UPDATE USING (true);
CREATE POLICY sc_delete ON sales_contacts FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY sd_select ON sales_deals FOR SELECT USING (true);
CREATE POLICY sd_insert ON sales_deals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sd_update ON sales_deals FOR UPDATE USING (true);
CREATE POLICY sd_delete ON sales_deals FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY sf_select ON sales_deal_files FOR SELECT USING (true);
CREATE POLICY sf_insert ON sales_deal_files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY sf_delete ON sales_deal_files FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY sact_select ON sales_activities FOR SELECT USING (true);
CREATE POLICY sact_insert ON sales_activities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_deals_account ON sales_deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON sales_deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_category ON sales_deals(category);
CREATE INDEX IF NOT EXISTS idx_deals_shipping ON sales_deals(shipping_type);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON sales_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_files_deal ON sales_deal_files(deal_id);
