-- ============================================
-- GS Sales CRM - Migration v3
-- 前払い入金%カラム追加
-- ============================================

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS prepayment_percent INT DEFAULT 0;
