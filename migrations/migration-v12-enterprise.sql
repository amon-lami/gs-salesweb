-- ============================================================
-- GS Sales — Migration v12: Enterprise Scale Improvements
-- Run in Supabase SQL Editor
-- ============================================================

-- ─── 1. SOFT DELETE: Add deleted_at to all transaction tables ───
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_deal_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ─── 2. AUDIT COLUMNS: updated_by on all tables ───
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- ─── 3. OPTIMISTIC LOCKING: version column ───
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;

-- ─── 4. PERFORMANCE INDEXES ───
CREATE INDEX IF NOT EXISTS idx_deals_owner ON sales_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_payment_confirmed ON sales_deals(payment_confirmed_date);
CREATE INDEX IF NOT EXISTS idx_deals_payment_date ON sales_deals(payment_date);
CREATE INDEX IF NOT EXISTS idx_deals_created ON sales_deals(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_deleted ON sales_deals(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON sales_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON sales_accounts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_name ON sales_accounts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON sales_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON sales_contacts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created ON sales_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_activities_deleted ON sales_activities(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON sales_categories(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_deleted ON sales_leads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_files_deleted ON sales_deal_files(deleted_at) WHERE deleted_at IS NULL;

-- ─── 5. FULL-TEXT SEARCH ───
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate search vectors
UPDATE sales_deals SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(notes,''));
UPDATE sales_accounts SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(country,'') || ' ' || coalesce(notes,''));
UPDATE sales_contacts SET search_vector = to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(role,'') || ' ' || coalesce(email,''));

-- Auto-update triggers for search vectors
CREATE OR REPLACE FUNCTION update_deal_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name,'') || ' ' || coalesce(NEW.notes,''));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_account_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name,'') || ' ' || coalesce(NEW.country,'') || ' ' || coalesce(NEW.notes,''));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contact_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('simple', coalesce(NEW.name,'') || ' ' || coalesce(NEW.role,'') || ' ' || coalesce(NEW.email,''));
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deal_search ON sales_deals;
CREATE TRIGGER trg_deal_search BEFORE INSERT OR UPDATE ON sales_deals FOR EACH ROW EXECUTE FUNCTION update_deal_search_vector();

DROP TRIGGER IF EXISTS trg_account_search ON sales_accounts;
CREATE TRIGGER trg_account_search BEFORE INSERT OR UPDATE ON sales_accounts FOR EACH ROW EXECUTE FUNCTION update_account_search_vector();

DROP TRIGGER IF EXISTS trg_contact_search ON sales_contacts;
CREATE TRIGGER trg_contact_search BEFORE INSERT OR UPDATE ON sales_contacts FOR EACH ROW EXECUTE FUNCTION update_contact_search_vector();

CREATE INDEX IF NOT EXISTS idx_deals_search ON sales_deals USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_accounts_search ON sales_accounts USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_contacts_search ON sales_contacts USING gin(search_vector);

-- ─── 6. FULL-TEXT SEARCH RPC ───
CREATE OR REPLACE FUNCTION search_all(query text)
RETURNS TABLE(type text, id uuid, name text, sub text, score real) AS $$
BEGIN
  RETURN QUERY
  SELECT 'deal'::text, d.id, d.name, COALESCE(a.name,'') as sub,
         ts_rank(d.search_vector, plainto_tsquery('simple', query)) as score
  FROM sales_deals d LEFT JOIN sales_accounts a ON d.account_id = a.id
  WHERE d.deleted_at IS NULL AND d.search_vector @@ plainto_tsquery('simple', query)
  UNION ALL
  SELECT 'account'::text, sa.id, sa.name, COALESCE(sa.country,'') as sub,
         ts_rank(sa.search_vector, plainto_tsquery('simple', query)) as score
  FROM sales_accounts sa
  WHERE sa.deleted_at IS NULL AND sa.search_vector @@ plainto_tsquery('simple', query)
  UNION ALL
  SELECT 'contact'::text, sc.id, sc.name, COALESCE(sc.email,'') as sub,
         ts_rank(sc.search_vector, plainto_tsquery('simple', query)) as score
  FROM sales_contacts sc
  WHERE sc.deleted_at IS NULL AND sc.search_vector @@ plainto_tsquery('simple', query)
  ORDER BY score DESC
  LIMIT 30;
END; $$ LANGUAGE plpgsql;

-- ─── 7. AUDIT LOG TRIGGER ───
CREATE OR REPLACE FUNCTION audit_log_trigger() RETURNS TRIGGER AS $$
DECLARE
  change_type text;
  deal_id_val uuid;
  acct_id_val uuid;
BEGIN
  change_type := TG_OP;

  IF TG_TABLE_NAME = 'sales_deals' THEN
    deal_id_val := COALESCE(NEW.id, OLD.id);
    acct_id_val := COALESCE(NEW.account_id, OLD.account_id);
  ELSIF TG_TABLE_NAME = 'sales_accounts' THEN
    acct_id_val := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'sales_contacts' THEN
    acct_id_val := COALESCE(NEW.account_id, OLD.account_id);
  END IF;

  -- Skip if only updated_at or search_vector changed
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'sales_deals' THEN
    IF NEW.updated_at IS DISTINCT FROM OLD.updated_at AND
       NEW.name IS NOT DISTINCT FROM OLD.name AND
       NEW.stage IS NOT DISTINCT FROM OLD.stage AND
       NEW.amount IS NOT DISTINCT FROM OLD.amount AND
       NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO sales_activities (deal_id, account_id, user_id, type, content, metadata)
  VALUES (
    deal_id_val,
    acct_id_val,
    COALESCE(auth.uid(), NEW.updated_by, NEW.created_by),
    'audit_' || lower(change_type),
    TG_TABLE_NAME || ' ' || lower(change_type),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', change_type,
      'record_id', COALESCE(NEW.id, OLD.id),
      'timestamp', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_deals ON sales_deals;
CREATE TRIGGER trg_audit_deals AFTER INSERT OR UPDATE OR DELETE ON sales_deals
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

DROP TRIGGER IF EXISTS trg_audit_accounts ON sales_accounts;
CREATE TRIGGER trg_audit_accounts AFTER INSERT OR UPDATE OR DELETE ON sales_accounts
FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ─── 8. COMPANY SETTINGS (Fiscal Year etc.) ───
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO company_settings (key, value) VALUES
  ('fiscal_year', '{"start_month": 2}'::jsonb),
  ('fy_target', '{"amount": 1000000000, "currency": "JPY"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY cs_select ON company_settings FOR SELECT USING (true);
CREATE POLICY cs_update ON company_settings FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ─── 9. OPTIMISTIC LOCK RPC ───
CREATE OR REPLACE FUNCTION safe_update_deal(
  p_id uuid, p_version int, p_data jsonb
) RETURNS jsonb AS $$
DECLARE
  current_version int;
  result sales_deals;
BEGIN
  SELECT version INTO current_version FROM sales_deals WHERE id = p_id AND deleted_at IS NULL;
  IF current_version IS NULL THEN
    RETURN jsonb_build_object('error', 'Deal not found');
  END IF;
  IF current_version != p_version THEN
    RETURN jsonb_build_object('error', 'CONFLICT', 'message', '他のユーザーが更新しました。リロードしてください。');
  END IF;

  UPDATE sales_deals
  SET name = COALESCE(p_data->>'name', name),
      amount = COALESCE((p_data->>'amount')::numeric, amount),
      stage = COALESCE(p_data->>'stage', stage),
      shipping_type = COALESCE(p_data->>'shipping_type', shipping_type),
      category = COALESCE(p_data->>'category', category),
      payment_status = COALESCE(p_data->>'payment_status', payment_status),
      payment_terms = COALESCE(p_data->>'payment_terms', payment_terms),
      owner_id = COALESCE((p_data->>'owner_id')::uuid, owner_id),
      notes = CASE WHEN p_data ? 'notes' THEN p_data->>'notes' ELSE notes END,
      invoice_file_url = COALESCE(p_data->>'invoice_file_url', invoice_file_url),
      invoice_files = CASE WHEN p_data ? 'invoice_files' THEN (p_data->'invoice_files') ELSE invoice_files END,
      supplier_paid = COALESCE((p_data->>'supplier_paid')::boolean, supplier_paid),
      prepayment_percent = COALESCE((p_data->>'prepayment_percent')::int, prepayment_percent),
      incoterms = COALESCE(p_data->>'incoterms', incoterms),
      payment_confirmed_date = COALESCE(p_data->>'payment_confirmed_date', payment_confirmed_date),
      spreadsheet_url = COALESCE(p_data->>'spreadsheet_url', spreadsheet_url),
      confidence = COALESCE((p_data->>'confidence')::int, confidence),
      version = current_version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO result;

  RETURN to_jsonb(result);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. DUPLICATE CHECK RPC ───
CREATE OR REPLACE FUNCTION check_duplicate_account(p_name text, p_country text DEFAULT NULL)
RETURNS TABLE(id uuid, name text, country text, similarity real) AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.name, sa.country,
    similarity(lower(sa.name), lower(p_name)) as sim
  FROM sales_accounts sa
  WHERE sa.deleted_at IS NULL
    AND (similarity(lower(sa.name), lower(p_name)) > 0.3
         OR lower(sa.name) = lower(p_name))
  ORDER BY sim DESC
  LIMIT 5;
END; $$ LANGUAGE plpgsql;

-- Enable pg_trgm for similarity function
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── 11. BULK CSV IMPORT RPC ───
CREATE OR REPLACE FUNCTION bulk_import_accounts(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  row_data jsonb;
  inserted int := 0;
  skipped int := 0;
BEGIN
  FOR row_data IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    -- Skip if exact name match exists
    IF EXISTS (SELECT 1 FROM sales_accounts WHERE lower(name) = lower(row_data->>'name') AND deleted_at IS NULL) THEN
      skipped := skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO sales_accounts (name, country, website, address_billing, payment_terms, notes, owner_id, lead_source, created_by)
    VALUES (
      row_data->>'name',
      row_data->>'country',
      row_data->>'website',
      row_data->>'address_billing',
      row_data->>'payment_terms',
      row_data->>'notes',
      (row_data->>'owner_id')::uuid,
      row_data->>'lead_source',
      auth.uid()
    );
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted, 'skipped', skipped);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION bulk_import_deals(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  row_data jsonb;
  inserted int := 0;
BEGIN
  FOR row_data IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO sales_deals (name, account_id, amount, stage, shipping_type, incoterms, prepayment_percent, notes, owner_id, deal_date, created_by)
    VALUES (
      row_data->>'name',
      (row_data->>'account_id')::uuid,
      COALESCE((row_data->>'amount')::numeric, 0),
      COALESCE(row_data->>'stage', 'negotiation'),
      row_data->>'shipping_type',
      row_data->>'incoterms',
      COALESCE((row_data->>'prepayment_percent')::int, 0),
      row_data->>'notes',
      (row_data->>'owner_id')::uuid,
      COALESCE(row_data->>'deal_date', CURRENT_DATE::text)::date,
      auth.uid()
    );
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION bulk_import_contacts(p_rows jsonb)
RETURNS jsonb AS $$
DECLARE
  row_data jsonb;
  inserted int := 0;
BEGIN
  FOR row_data IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO sales_contacts (name, role, account_id, email, phone, whatsapp, linkedin, owner_id)
    VALUES (
      row_data->>'name',
      row_data->>'role',
      (row_data->>'account_id')::uuid,
      row_data->>'email',
      row_data->>'phone',
      row_data->>'whatsapp',
      row_data->>'linkedin',
      (row_data->>'owner_id')::uuid
    );
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted);
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 12. RLS POLICY IMPROVEMENTS ───
-- Keep permissive SELECT but enforce soft-delete filter
-- Drop old policies and recreate with soft-delete awareness

-- sales_deals
DROP POLICY IF EXISTS sd_select ON sales_deals;
CREATE POLICY sd_select ON sales_deals FOR SELECT USING (deleted_at IS NULL);
DROP POLICY IF EXISTS sd_select_deleted ON sales_deals;
CREATE POLICY sd_select_deleted ON sales_deals FOR SELECT USING (deleted_at IS NOT NULL AND auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- sales_accounts
DROP POLICY IF EXISTS sa_select ON sales_accounts;
CREATE POLICY sa_select ON sales_accounts FOR SELECT USING (deleted_at IS NULL);

-- sales_contacts
DROP POLICY IF EXISTS sc_select ON sales_contacts;
CREATE POLICY sc_select ON sales_contacts FOR SELECT USING (deleted_at IS NULL);

-- sales_activities
DROP POLICY IF EXISTS sact_select ON sales_activities;
CREATE POLICY sact_select ON sales_activities FOR SELECT USING (deleted_at IS NULL);

-- sales_deal_files
DROP POLICY IF EXISTS sf_select ON sales_deal_files;
CREATE POLICY sf_select ON sales_deal_files FOR SELECT USING (deleted_at IS NULL);

-- sales_categories
DROP POLICY IF EXISTS scat_select ON sales_categories;
CREATE POLICY scat_select ON sales_categories FOR SELECT USING (deleted_at IS NULL);

