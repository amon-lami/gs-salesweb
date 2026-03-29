-- expense_items: 経費報告の明細行テーブル
CREATE TABLE IF NOT EXISTS expense_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id uuid REFERENCES expenses(id) ON DELETE CASCADE,
  category text NOT NULL,
  vendor text,
  account_id uuid REFERENCES sales_accounts(id),
  product text,
  amount bigint NOT NULL DEFAULT 0,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_items_select" ON expense_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_items_insert" ON expense_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expense_items_update" ON expense_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "expense_items_delete" ON expense_items FOR DELETE TO authenticated USING (true);
