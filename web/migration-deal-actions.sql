-- Migration: Add lead_id to sales_deals and action_type to sales_activities
-- Run this in Supabase SQL Editor

-- 1. Add lead_id column to sales_deals (links deal to its source lead)
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES sales_leads(id);

-- 2. Add action_type column to sales_activities (for action-type activities)
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS action_type TEXT;

-- 3. Create index for faster lead_id lookups
CREATE INDEX IF NOT EXISTS idx_sales_deals_lead_id ON sales_deals(lead_id);

-- 4. Create index for action-type activities
CREATE INDEX IF NOT EXISTS idx_sales_activities_action_type ON sales_activities(type) WHERE type = 'action';
