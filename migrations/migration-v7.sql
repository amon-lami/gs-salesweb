-- ============================================
-- GS Sales CRM - Migration v7
-- マスターテーブル / ロール / RLSポリシー強化
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. マスターテーブル: ステージ
--    将来のステージ追加・名称変更・並び替えに対応
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_stages (
  id TEXT PRIMARY KEY,           -- 'new', 'negotiation', etc.
  label_en TEXT NOT NULL,
  label_ja TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pre', 'post', 'done')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_stages (id, label_en, label_ja, phase, sort_order) VALUES
  ('new',             'New',             '新規',         'pre',  0),
  ('negotiation',     'Negotiation',     '交渉中',       'pre',  1),
  ('invoice_sent',    'Invoice Sent',    '請求書送付済',  'pre',  2),
  ('order_pending',   'Order Pending',   '発注未完了',    'post', 3),
  ('order_completed', 'Order Completed', '発注完了',      'post', 4),
  ('goods_received',  'Goods Received',  '入荷済',       'post', 5),
  ('shipped',         'Shipped',         '発送済',       'post', 6),
  ('closed',          'Completed',       '完了',         'done', 7),
  ('lost',            'Lost',            '失注',         'done', 8)
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. マスターテーブル: 配送タイプ
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_shipping_types (
  id TEXT PRIMARY KEY,           -- 'sea', 'air', 'domestic'
  label_ja TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#000',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_shipping_types (id, label_ja, icon, color, sort_order) VALUES
  ('sea',      '船便',   '🚢', '#2563eb', 0),
  ('air',      '航空便', '✈',  '#7c3aed', 1),
  ('domestic', '国内',   '🏠', '#059669', 2)
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. マスターテーブル: 支払いステータス
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_payment_statuses (
  id TEXT PRIMARY KEY,           -- 'none', 'partial', 'full'
  label_ja TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_payment_statuses (id, label_ja, sort_order) VALUES
  ('none',    '未入金', 0),
  ('partial', '一部入金', 1),
  ('full',    '全額入金', 2)
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. マスターテーブル: インコタームズ
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_incoterms (
  id TEXT PRIMARY KEY,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_incoterms (id, description, sort_order) VALUES
  ('EXW',   '工場渡し（Ex Works）', 0),
  ('FOB',   '本船渡し（Free On Board）', 1),
  ('CIF',   '運賃保険料込み（Cost, Insurance & Freight）', 2),
  ('DAP',   '仕向地持込渡し（Delivered At Place）', 3),
  ('Other', 'その他', 4)
ON CONFLICT (id) DO NOTHING;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. マスターテーブル: リードソース
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS master_lead_sources (
  id TEXT PRIMARY KEY,
  label_ja TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_lead_sources (id, label_ja, sort_order) VALUES
  ('JBW',      'JBW', 0),
  ('LinkedIn', 'LinkedIn', 1),
  ('WhatsApp', 'WhatsApp', 2),
  ('メール',   'メール', 3),
  ('その他',   'その他', 4)
ON CONFLICT (id) DO NOTHING;

-- マスターテーブルのRLS（全員読み取り可、adminのみ変更可）
ALTER TABLE master_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_shipping_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_payment_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_incoterms ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_lead_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select ON master_stages FOR SELECT USING (true);
CREATE POLICY mst_select ON master_shipping_types FOR SELECT USING (true);
CREATE POLICY mps_select ON master_payment_statuses FOR SELECT USING (true);
CREATE POLICY mi_select ON master_incoterms FOR SELECT USING (true);
CREATE POLICY mls_select ON master_lead_sources FOR SELECT USING (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. ロール管理テーブル
--    admin: 全データ読み書き + マスター編集
--    manager: 全データ読み取り + チーム分の書き込み
--    member: 全データ読み取り + 自分の書き込み
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 全員が自分のロールを読める
CREATE POLICY ur_select ON user_roles FOR SELECT USING (true);
-- adminのみロール変更可能
CREATE POLICY ur_insert ON user_roles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY ur_update ON user_roles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY ur_delete ON user_roles FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. ロール判定ヘルパー関数
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 現在のユーザーのロールを取得
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid()),
    'member'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 現在のユーザーがadminかどうか
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 現在のユーザーがmanager以上かどうか
CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'manager');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. RLSポリシー強化
--    旧ポリシー（USING(true)）を削除して、ロールベースに置換
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- === sales_accounts ===
DROP POLICY IF EXISTS sa_select ON sales_accounts;
DROP POLICY IF EXISTS sa_insert ON sales_accounts;
DROP POLICY IF EXISTS sa_update ON sales_accounts;
DROP POLICY IF EXISTS sa_delete ON sales_accounts;

-- 全員が読める（ソフトデリート済みはadminのみ）
CREATE POLICY sa_select ON sales_accounts FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
-- 認証済みなら作成可能
CREATE POLICY sa_insert ON sales_accounts FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
-- 自分がオーナー or admin/manager
CREATE POLICY sa_update ON sales_accounts FOR UPDATE USING (
  owner_id = auth.uid() OR is_manager_or_above()
);
-- adminのみ削除（ソフトデリート推奨）
CREATE POLICY sa_delete ON sales_accounts FOR DELETE USING (
  is_admin()
);

-- === sales_contacts ===
DROP POLICY IF EXISTS sc_select ON sales_contacts;
DROP POLICY IF EXISTS sc_insert ON sales_contacts;
DROP POLICY IF EXISTS sc_update ON sales_contacts;
DROP POLICY IF EXISTS sc_delete ON sales_contacts;

CREATE POLICY sc_select ON sales_contacts FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY sc_insert ON sales_contacts FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY sc_update ON sales_contacts FOR UPDATE USING (
  owner_id = auth.uid() OR is_manager_or_above()
);
CREATE POLICY sc_delete ON sales_contacts FOR DELETE USING (
  is_admin()
);

-- === sales_deals ===
DROP POLICY IF EXISTS sd_select ON sales_deals;
DROP POLICY IF EXISTS sd_insert ON sales_deals;
DROP POLICY IF EXISTS sd_update ON sales_deals;
DROP POLICY IF EXISTS sd_delete ON sales_deals;

CREATE POLICY sd_select ON sales_deals FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY sd_insert ON sales_deals FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
-- 自分がオーナー or admin/manager
CREATE POLICY sd_update ON sales_deals FOR UPDATE USING (
  owner_id = auth.uid() OR is_manager_or_above()
);
-- adminのみ削除
CREATE POLICY sd_delete ON sales_deals FOR DELETE USING (
  is_admin()
);

-- === sales_deal_files ===
DROP POLICY IF EXISTS sf_select ON sales_deal_files;
DROP POLICY IF EXISTS sf_insert ON sales_deal_files;
DROP POLICY IF EXISTS sf_delete ON sales_deal_files;

CREATE POLICY sf_select ON sales_deal_files FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY sf_insert ON sales_deal_files FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY sf_delete ON sales_deal_files FOR DELETE USING (
  is_admin()
);

-- === sales_activities ===
DROP POLICY IF EXISTS sact_select ON sales_activities;
DROP POLICY IF EXISTS sact_insert ON sales_activities;
DROP POLICY IF EXISTS sact_update ON sales_activities;
DROP POLICY IF EXISTS sact_delete ON sales_activities;

CREATE POLICY sact_select ON sales_activities FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY sact_insert ON sales_activities FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
-- 自分が書いたアクティビティ or admin
CREATE POLICY sact_update ON sales_activities FOR UPDATE USING (
  user_id = auth.uid() OR is_admin()
);
CREATE POLICY sact_delete ON sales_activities FOR DELETE USING (
  is_admin()
);

-- === sales_categories ===
-- カテゴリはadmin/managerのみ編集可能
DROP POLICY IF EXISTS scat_select ON sales_categories;
DROP POLICY IF EXISTS scat_insert ON sales_categories;
DROP POLICY IF EXISTS scat_update ON sales_categories;
DROP POLICY IF EXISTS scat_delete ON sales_categories;

CREATE POLICY scat_select ON sales_categories FOR SELECT USING (true);
CREATE POLICY scat_insert ON sales_categories FOR INSERT WITH CHECK (
  is_manager_or_above()
);
CREATE POLICY scat_update ON sales_categories FOR UPDATE USING (
  is_manager_or_above()
);
CREATE POLICY scat_delete ON sales_categories FOR DELETE USING (
  is_admin()
);

-- === sales_weekly_reports ===
DROP POLICY IF EXISTS swr_select ON sales_weekly_reports;
DROP POLICY IF EXISTS swr_insert ON sales_weekly_reports;
DROP POLICY IF EXISTS swr_update ON sales_weekly_reports;

CREATE POLICY swr_select ON sales_weekly_reports FOR SELECT USING (
  deleted_at IS NULL OR is_admin()
);
CREATE POLICY swr_insert ON sales_weekly_reports FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY swr_update ON sales_weekly_reports FOR UPDATE USING (
  user_id = auth.uid() OR is_admin()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. マスターテーブルの管理権限（admin only）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE POLICY ms_manage ON master_stages FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mst_manage ON master_shipping_types FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mps_manage ON master_payment_statuses FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mi_manage ON master_incoterms FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY mls_manage ON master_lead_sources FOR ALL USING (is_admin()) WITH CHECK (is_admin());
