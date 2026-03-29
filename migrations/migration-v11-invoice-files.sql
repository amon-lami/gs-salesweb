-- v11: Add invoice_files JSONB column for multiple invoice support
-- Run this in Supabase SQL Editor

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS invoice_files JSONB;

-- Migrate existing single invoice_file_url to invoice_files array
UPDATE sales_deals
SET invoice_files = jsonb_build_array(
  jsonb_build_object('url', invoice_file_url, 'name', '請求書', 'date', COALESCE(invoice_date::text, ''))
)
WHERE invoice_file_url IS NOT NULL AND invoice_files IS NULL;
