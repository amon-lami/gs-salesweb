-- =============================================
-- Migration: Create expenses table (v2 fix)
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop if exists from failed attempt
DROP TABLE IF EXISTS expenses;

CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  category TEXT DEFAULT 'その他',
  vendor TEXT NOT NULL,
  product TEXT NOT NULL,
  method TEXT DEFAULT 'Amex',
  amount NUMERIC NOT NULL DEFAULT 0,
  memo TEXT,
  receipt_url TEXT,
  receipt_name TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_all" ON expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_update_own" ON expenses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
