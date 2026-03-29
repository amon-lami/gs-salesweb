-- ============================================
-- Migration v14: Add linkedin_url to sales_leads
-- ============================================

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT '';
