-- ============================================
-- GS Sales CRM - Migration v5 (Turn 2)
-- タイムライン拡張 + 連絡先フィールド強化
-- ============================================

-- activities テーブル拡張: ToDo + レポート対応
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS is_todo BOOLEAN DEFAULT false;
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- 連絡先フィールド強化
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT '';
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS linkedin TEXT DEFAULT '';

-- activities の UPDATE/DELETE ポリシー（無い場合のみ）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='sact_update' AND tablename='sales_activities') THEN
    CREATE POLICY sact_update ON sales_activities FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='sact_delete' AND tablename='sales_activities') THEN
    CREATE POLICY sact_delete ON sales_activities FOR DELETE USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
