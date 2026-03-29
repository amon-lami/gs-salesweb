-- ============================================
-- Migration: Fix RLS for sales app
-- Supabase SQL Editor で実行してください
-- ============================================

-- ■ 方法: 全テーブルのRLSポリシーを「認証済みユーザーは全操作OK」に設定

-- === sales_deals ===
ALTER TABLE sales_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_deals_update_policy" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_select_policy" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_insert_policy" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_delete_policy" ON sales_deals;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON sales_deals;
DROP POLICY IF EXISTS "Allow select for authenticated users" ON sales_deals;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON sales_deals;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_update_all_authenticated" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_select_all_authenticated" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_insert_all_authenticated" ON sales_deals;
DROP POLICY IF EXISTS "sales_deals_delete_all_authenticated" ON sales_deals;
CREATE POLICY "sales_deals_all" ON sales_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === sales_activities ===
ALTER TABLE sales_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_activities_all_authenticated" ON sales_activities;
DROP POLICY IF EXISTS "sales_activities_all" ON sales_activities;
CREATE POLICY "sales_activities_all" ON sales_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === sales_deal_files ===
ALTER TABLE sales_deal_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_deal_files_all_authenticated" ON sales_deal_files;
DROP POLICY IF EXISTS "sales_deal_files_all" ON sales_deal_files;
CREATE POLICY "sales_deal_files_all" ON sales_deal_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === sales_accounts ===
ALTER TABLE sales_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_accounts_all" ON sales_accounts;
CREATE POLICY "sales_accounts_all" ON sales_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === sales_contacts ===
ALTER TABLE sales_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_contacts_all" ON sales_contacts;
CREATE POLICY "sales_contacts_all" ON sales_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === sales_categories ===
ALTER TABLE sales_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sales_categories_all" ON sales_categories;
CREATE POLICY "sales_categories_all" ON sales_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === chat_rooms ===
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_rooms_all" ON chat_rooms;
CREATE POLICY "chat_rooms_all" ON chat_rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === chat_messages ===
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_messages_all" ON chat_messages;
CREATE POLICY "chat_messages_all" ON chat_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === chat_room_members ===
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_room_members_all" ON chat_room_members;
CREATE POLICY "chat_room_members_all" ON chat_room_members FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === profiles ===
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_all" ON profiles;
CREATE POLICY "profiles_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- === Storage: chat-files バケット ===
-- 既存ポリシーを全削除
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname LIKE '%chat%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- 新規ポリシー: 認証ユーザーはchat-filesバケットに全操作OK
CREATE POLICY "chat_files_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-files');
CREATE POLICY "chat_files_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-files');
CREATE POLICY "chat_files_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'chat-files') WITH CHECK (bucket_id = 'chat-files');
CREATE POLICY "chat_files_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-files');
