-- Migration: ひとこと履歴テーブル
-- Run this in Supabase SQL Editor

-- 1. Create hitokoto_history table
CREATE TABLE IF NOT EXISTS hitokoto_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index for user lookup
CREATE INDEX IF NOT EXISTS idx_hitokoto_history_user ON hitokoto_history(user_id, posted_at DESC);

-- 3. Enable RLS
ALTER TABLE hitokoto_history ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies - all authenticated users can read, insert own
CREATE POLICY "hitokoto_history_select" ON hitokoto_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hitokoto_history_insert" ON hitokoto_history
  FOR INSERT TO authenticated WITH CHECK (true);
