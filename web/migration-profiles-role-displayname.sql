-- ============================================================
-- Migration: profiles テーブルに role / display_name を追加
-- 実行先: Supabase SQL Editor
-- ============================================================

-- 1) display_name カラム（UIに表示する短縮名）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- 2) role カラム（admin / manager / member）
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- 3) 既存メンバーの初期データ設定
-- ※ メールアドレスで特定し、display_nameとroleを設定
UPDATE profiles SET display_name = 'Amon', role = 'admin'
  WHERE email LIKE 'alt@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Yuki'
  WHERE email LIKE 'yuki.nakagawa@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Tsumura'
  WHERE email LIKE 'kota.tsumura@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Chikaki'
  WHERE email LIKE 'chikaki@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Yuta'
  WHERE email LIKE 'yuta.ito@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Mark'
  WHERE email LIKE 'mark.martiros@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Sarah'
  WHERE email LIKE 'sarah.azzouz@%' AND display_name IS NULL;

UPDATE profiles SET display_name = 'Joseph'
  WHERE email LIKE 'joseph.mackay@%' AND display_name IS NULL;

-- 4) display_name が未設定のユーザーは email の @ 前を自動セット
UPDATE profiles SET display_name = split_part(email, '@', 1)
  WHERE display_name IS NULL AND email IS NOT NULL;

-- 確認用
SELECT id, email, name, display_name, role FROM profiles ORDER BY created_at;
