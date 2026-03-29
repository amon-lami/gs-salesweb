-- GS-Sales J-Beauty Export Business CRM - Phase 1 Migration
-- Complete document generation system tables with RLS and triggers

-- ============================================================================
-- TABLE: product_master
-- Description: Product catalog containing 2,492 J-beauty products
-- ============================================================================

CREATE TABLE product_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ja text,
  name_en text,
  jan text UNIQUE NOT NULL,
  image_url text,
  case_quantity int,
  weight_g numeric,
  supplier text,
  list_price numeric,
  cost_price numeric,
  brand text,
  sub_brand text,
  selling_price_usd numeric,
  price_break_qty int,
  status text DEFAULT 'active',
  ingredients_en text,
  is_discontinued boolean DEFAULT false,
  business_type text DEFAULT 'j-beauty',
  extra_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_product_master_jan ON product_master(jan);
CREATE INDEX idx_product_master_brand ON product_master(brand);
CREATE INDEX idx_product_master_business_type ON product_master(business_type);

ALTER TABLE product_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on product_master" ON product_master
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: product_master_audit
-- Description: Change history and audit log for product_master
-- ============================================================================

CREATE TABLE product_master_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES product_master(id) ON DELETE CASCADE,
  changed_by uuid,
  changed_at timestamptz DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);

CREATE INDEX idx_product_master_audit_product_id ON product_master_audit(product_id);

ALTER TABLE product_master_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on product_master_audit" ON product_master_audit
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: shipping_zones
-- Description: Carrier and service to country/zone mappings
-- ============================================================================

CREATE TABLE shipping_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier text NOT NULL,
  service text NOT NULL,
  zone_code text NOT NULL,
  country text NOT NULL,
  UNIQUE(carrier, service, country)
);

CREATE INDEX idx_shipping_zones_carrier_service ON shipping_zones(carrier, service);

ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on shipping_zones" ON shipping_zones
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: shipping_rates
-- Description: Zone by weight shipping rate lookup table
-- ============================================================================

CREATE TABLE shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier text NOT NULL,
  service text NOT NULL,
  zone_code text NOT NULL,
  weight_kg numeric NOT NULL,
  rate_jpy numeric NOT NULL,
  UNIQUE(carrier, service, zone_code, weight_kg)
);

CREATE INDEX idx_shipping_rates_carrier_service_zone ON shipping_rates(carrier, service, zone_code);

ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on shipping_rates" ON shipping_rates
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: shipping_settings
-- Description: Global shipping configuration (fuel surcharge, markup rates)
-- ============================================================================

CREATE TABLE shipping_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_surcharge_rate numeric DEFAULT 0,
  dap_markup_rate numeric DEFAULT 0.25,
  fob_rate numeric DEFAULT 0.03,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

ALTER TABLE shipping_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on shipping_settings" ON shipping_settings
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: bank_accounts
-- Description: Per-currency bank account information
-- ============================================================================

CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency text NOT NULL,
  bank_name text,
  account_holder text,
  account_number text,
  routing_number text,
  swift_code text,
  iban text,
  bank_address text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on bank_accounts" ON bank_accounts
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: exchange_rates
-- Description: Currency conversion rates with manual/API source tracking
-- ============================================================================

CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text DEFAULT 'USD',
  target_currency text NOT NULL,
  rate numeric NOT NULL,
  source text DEFAULT 'manual',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on exchange_rates" ON exchange_rates
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TABLE: generated_documents
-- Description: Generated documents (quotations, invoices, delivery notes)
-- ============================================================================

CREATE TABLE generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  account_id uuid,
  contact_id uuid,
  deal_id uuid,
  client_info jsonb DEFAULT '{}',
  items jsonb DEFAULT '[]',
  subtotal numeric,
  shipping numeric,
  total numeric,
  profit_total numeric,
  incoterm text,
  currency text DEFAULT 'USD',
  carrier text,
  service text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_generated_documents_doc_type ON generated_documents(doc_type);
CREATE INDEX idx_generated_documents_account_id ON generated_documents(account_id);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated on generated_documents" ON generated_documents
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- TRIGGER FUNCTION: update_updated_at_column
-- Description: Automatically updates updated_at timestamp on row modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: product_master updated_at
-- ============================================================================

CREATE TRIGGER trigger_product_master_updated_at
  BEFORE UPDATE ON product_master
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER: bank_accounts updated_at
-- ============================================================================

CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER: shipping_settings updated_at
-- ============================================================================

CREATE TRIGGER trigger_shipping_settings_updated_at
  BEFORE UPDATE ON shipping_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA: shipping_settings
-- Description: Default shipping configuration
-- ============================================================================

INSERT INTO shipping_settings (
  fuel_surcharge_rate,
  dap_markup_rate,
  fob_rate
) VALUES (
  0,
  0.25,
  0.03
);

-- ============================================================================
-- INITIAL DATA: bank_accounts
-- Description: Wise USD account for Global Stride Inc.
-- ============================================================================

INSERT INTO bank_accounts (
  currency,
  bank_name,
  account_holder,
  account_number,
  routing_number,
  bank_address,
  is_active
) VALUES (
  'USD',
  'Wise',
  'Global Stride Inc.',
  '8314169766',
  '026073150',
  'Community Federal Savings Bank, 89-16 Jamaica Ave, Woodhaven, NY, 11421, United States',
  true
);

-- ============================================================================
-- INITIAL DATA: exchange_rates
-- Description: Default currency conversion rates
-- ============================================================================

INSERT INTO exchange_rates (
  base_currency,
  target_currency,
  rate,
  source
) VALUES
  ('USD', 'JPY', 150, 'manual'),
  ('USD', 'EUR', 0.92, 'manual'),
  ('USD', 'GBP', 0.79, 'manual'),
  ('USD', 'CAD', 1.36, 'manual'),
  ('USD', 'AUD', 1.53, 'manual');
