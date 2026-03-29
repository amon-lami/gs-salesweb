-- ============================================
-- GS Sales CRM - Migration v4
-- 流入経路カラム追加
-- ============================================

-- 流入経路は取引先に紐づく
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT '';
