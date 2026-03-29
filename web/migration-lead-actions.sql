-- ========================================
-- lead_actions テーブル作成
-- ========================================
CREATE TABLE IF NOT EXISTS lead_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'その他',
  memo TEXT,
  action_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_lead_actions_lead_id ON lead_actions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_actions_action_date ON lead_actions(action_date DESC);

-- RLS
ALTER TABLE lead_actions ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーがCRUDできるポリシー
CREATE POLICY "lead_actions_select" ON lead_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "lead_actions_insert" ON lead_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "lead_actions_update" ON lead_actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "lead_actions_delete" ON lead_actions FOR DELETE TO authenticated USING (true);

-- ========================================
-- sales_leads に lost_reason カラム追加
-- ========================================
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;

