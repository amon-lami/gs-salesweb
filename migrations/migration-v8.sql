-- ============================================
-- GS Sales CRM - Migration v8
-- リード管理 + JBWアトリビューション
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. リードテーブル
--    最小限の項目で運用しやすく設計
--    ステータス: new / contacted / qualified / converted / lost
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS sales_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- 必須4項目（これだけ入れればOK）
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  source TEXT NOT NULL DEFAULT 'その他',

  -- ステータス管理
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),

  -- 追加情報（全部任意）
  phone TEXT,
  whatsapp TEXT,
  country TEXT,
  website TEXT,
  notes TEXT,

  -- 商談化時のリンク（convertedの時にセット）
  converted_account_id UUID REFERENCES sales_accounts(id),
  converted_deal_id UUID REFERENCES sales_deals(id),
  converted_at TIMESTAMPTZ,

  -- 所有者・追跡
  owner_id UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. リードのマスターステータス
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_lead_statuses (
  id TEXT PRIMARY KEY,
  label_ja TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#999',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_lead_statuses (id, label_ja, color, sort_order) VALUES
  ('new',       '新規',       '#2d8cf0', 0),
  ('contacted', 'コンタクト済', '#f59e0b', 1),
  ('qualified', '見込みあり',   '#22c55e', 2),
  ('converted', '商談化',      '#1a1a1a', 3),
  ('lost',      '見送り',      '#ef4444', 4)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE master_lead_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY mls2_select ON master_lead_statuses FOR SELECT USING (true);
CREATE POLICY mls2_manage ON master_lead_statuses FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. RLSポリシー（リード）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY sl_select ON sales_leads FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY sl_insert ON sales_leads FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY sl_update ON sales_leads FOR UPDATE USING (
  owner_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY sl_delete ON sales_leads FOR DELETE USING (
  is_admin()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. インデックス
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_leads_active ON sales_leads(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status ON sales_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON sales_leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON sales_leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON sales_leads(created_at);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. 監査トリガー（リード）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP TRIGGER IF EXISTS trg_audit_leads ON sales_leads;
CREATE TRIGGER trg_audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON sales_leads
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_updated_at_leads ON sales_leads;
CREATE TRIGGER trg_updated_at_leads
  BEFORE UPDATE ON sales_leads
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. 取引先にJBWアトリビューション用カラム追加
--    JBW経由の取引先は売上をJBW成績としてカウント
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS attributed_to TEXT DEFAULT '';
-- attributed_to: '' = 通常（担当者の成績）, 'JBW' = JBW経由の成績
