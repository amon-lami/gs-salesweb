-- ============================================================
-- Migration: lead_files テーブル作成
-- 実行先: Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  file_type TEXT,
  size BIGINT,
  uploaded_by UUID,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON lead_files(lead_id);

ALTER TABLE lead_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_files_select" ON lead_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_files_insert" ON lead_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lead_files_update" ON lead_files FOR UPDATE TO authenticated USING (true);
CREATE POLICY "lead_files_delete" ON lead_files FOR DELETE TO authenticated USING (true);

-- 確認
SELECT tablename FROM pg_tables WHERE tablename = 'lead_files';
