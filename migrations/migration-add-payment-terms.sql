-- sales_deals に payment_terms カラムを追加
-- Supabase SQL Editor で実行してください

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS payment_terms TEXT;
