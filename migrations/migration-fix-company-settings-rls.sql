-- ============================================================
-- Fix company_settings RLS: 全認証ユーザーが全行を読み書きできるように
-- company_settings は会社全体の設定テーブルなので全員アクセス可能にする
-- ============================================================

-- 既存のRLSポリシーを削除（エラーは無視してOK）
DROP POLICY IF EXISTS "company_settings_select" ON company_settings;
DROP POLICY IF EXISTS "company_settings_insert" ON company_settings;
DROP POLICY IF EXISTS "company_settings_update" ON company_settings;
DROP POLICY IF EXISTS "company_settings_delete" ON company_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON company_settings;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON company_settings;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON company_settings;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON company_settings;
DROP POLICY IF EXISTS "Users can view company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can insert company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can update company_settings" ON company_settings;
DROP POLICY IF EXISTS "Users can delete company_settings" ON company_settings;

-- RLSを有効にする（既に有効なら何も起きない）
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザーに全操作を許可
CREATE POLICY "company_settings_select_all"
  ON company_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "company_settings_insert_all"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "company_settings_update_all"
  ON company_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "company_settings_delete_all"
  ON company_settings FOR DELETE
  TO authenticated
  USING (true);
