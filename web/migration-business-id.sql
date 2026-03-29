-- Migration: 事業部管理機能
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. businesses マスタテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT DEFAULT '#666',
  sort_order INT DEFAULT 0,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses_select" ON businesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "businesses_insert" ON businesses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "businesses_update" ON businesses FOR UPDATE TO authenticated USING (true);

-- 初期データ投入
INSERT INTO businesses (id, label, color, sort_order) VALUES
  ('jbeauty', 'J-Beauty', '#1a1a1a', 0),
  ('matcha', 'Matcha', '#4a7c59', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. 各テーブルに business_id 追加
-- ============================================================
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS business_id TEXT;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS business_id TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sales_deals_business ON sales_deals(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_accounts_business ON sales_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_contacts_business ON sales_contacts(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_leads_business ON sales_leads(business_id);

-- ============================================================
-- 3. (推奨) 既存データをJ-Beautyに紐付け
--    新しい事業はまっさらな状態でスタートするため
-- ============================================================
UPDATE sales_deals SET business_id = 'jbeauty' WHERE business_id IS NULL;
UPDATE sales_accounts SET business_id = 'jbeauty' WHERE business_id IS NULL;
UPDATE sales_contacts SET business_id = 'jbeauty' WHERE business_id IS NULL;
UPDATE sales_leads SET business_id = 'jbeauty' WHERE business_id IS NULL;
