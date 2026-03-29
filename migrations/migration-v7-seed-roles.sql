-- ============================================
-- GS Sales CRM - v7 ロール初期設定
-- migration-v7.sql の直後に実行すること
-- ============================================

-- Amonをadminに設定（メールからuser_idを逆引き）
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'alt@globalstride.jp'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Amon以外の全メンバーをmanagerに設定
INSERT INTO user_roles (user_id, role)
SELECT id, 'manager'
FROM auth.users
WHERE email IN (
  'kota.tsumura@globalstride.jp',
  'yuki.nakagawa@globalstride.jp',
  'chikaki@globalstride.jp',
  'yuta.ito@globalstride.jp',
  'mark.matiros@globalstride.jp',
  'sarah.azzouz@globalstride.jp',
  'joseph.mackay@globalstride.jp'
)
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

-- 確認: 全ロール一覧を表示
SELECT ur.role, au.email
FROM user_roles ur
JOIN auth.users au ON au.id = ur.user_id
ORDER BY
  CASE ur.role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
  au.email;
