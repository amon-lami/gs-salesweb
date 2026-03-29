-- Migration v20: Shipments, Payments, Credit Notes
-- Supports: partial delivery, invoice splitting, damage/returns, multiple shipments

-- 1. Shipments table (出荷バッチ)
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  account_id UUID REFERENCES sales_accounts(id) ON DELETE SET NULL,
  shipment_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'packing',  -- packing / shipped / delivered
  tracking_number TEXT,
  carrier TEXT,
  shipped_date DATE,
  delivery_document_id UUID REFERENCES generated_documents(id),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Shipment items (出荷品目)
CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shipment_id, order_item_id)
);

-- 3. Invoice payments (入金記録)
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  document_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_date DATE,
  payment_method TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Credit notes (クレジットノート)
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES sales_deals(id) ON DELETE CASCADE,
  original_document_id UUID REFERENCES generated_documents(id),
  credit_number TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  reason TEXT,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  replacement_shipment_id UUID REFERENCES shipments(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add shipped_quantity and tracking_number to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS shipped_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_deal_id ON shipments(deal_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_order_item_id ON shipment_items(order_item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_deal_id ON invoice_payments(deal_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_document_id ON invoice_payments(document_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_deal_id ON credit_notes(deal_id);
CREATE INDEX IF NOT EXISTS idx_generated_documents_deal_id ON generated_documents(deal_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tracking ON order_items(tracking_number) WHERE tracking_number IS NOT NULL;

-- 7. RLS policies
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shipments_all" ON shipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "shipment_items_all" ON shipment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "invoice_payments_all" ON invoice_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "credit_notes_all" ON credit_notes FOR ALL USING (true) WITH CHECK (true);

-- 8. Auto-update timestamps
CREATE OR REPLACE FUNCTION update_shipments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_shipments_updated_at();
