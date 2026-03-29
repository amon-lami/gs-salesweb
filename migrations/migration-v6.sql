-- ============================================
-- GS Sales CRM - Migration v6
-- ソフトデリート / CHECK制約 / 監査ログ / 通貨対応
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. ソフトデリート: 全テーブルに deleted_at を追加
--    物理削除を防ぎ、全データを永続保持する
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_deal_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_activities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE sales_weekly_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ソフトデリートのインデックス（NULLの行だけ高速に取れる部分インデックス）
CREATE INDEX IF NOT EXISTS idx_accounts_active ON sales_accounts(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active ON sales_contacts(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_active ON sales_deals(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deal_files_active ON sales_deal_files(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_activities_active ON sales_activities(id) WHERE deleted_at IS NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. CHECK制約: データ整合性を強制する
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 商談金額は0以上
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_amount_positive') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_amount_positive CHECK (amount >= 0);
  END IF;
END $$;

-- 請求書金額は0以上
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_invoice_amount_positive') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_invoice_amount_positive CHECK (invoice_amount IS NULL OR invoice_amount >= 0);
  END IF;
END $$;

-- confidenceは0-100
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_confidence_range') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_confidence_range CHECK (confidence >= 0 AND confidence <= 100);
  END IF;
END $$;

-- prepayment_percentは0-100
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_prepayment_range') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_prepayment_range CHECK (prepayment_percent >= 0 AND prepayment_percent <= 100);
  END IF;
END $$;

-- stageは有効な値のみ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_stage_valid') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_stage_valid
      CHECK (stage IN ('new', 'negotiation', 'invoice_sent', 'order_pending', 'order_completed', 'goods_received', 'shipped', 'closed', 'lost'));
  END IF;
END $$;

-- shipping_typeは有効な値のみ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_shipping_valid') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_shipping_valid
      CHECK (shipping_type IS NULL OR shipping_type IN ('sea', 'air', 'domestic'));
  END IF;
END $$;

-- payment_statusは有効な値のみ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_payment_status_valid') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_payment_status_valid
      CHECK (payment_status IS NULL OR payment_status IN ('none', 'partial', 'full'));
  END IF;
END $$;

-- incotermsは有効な値のみ
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_incoterms_valid') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_incoterms_valid
      CHECK (incoterms IS NULL OR incoterms IN ('', 'EXW', 'FOB', 'CIF', 'DAP', 'Other'));
  END IF;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 通貨対応: 商談に通貨コードを追加
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JPY';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_deals_currency_valid') THEN
    ALTER TABLE sales_deals ADD CONSTRAINT chk_deals_currency_valid
      CHECK (currency IN ('JPY', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'THB', 'AED', 'SAR', 'CNY', 'KRW', 'TWD', 'MYR', 'VND', 'PHP', 'IDR', 'INR', 'BRL', 'MXN', 'CHF', 'SEK', 'NZD', 'HKD', 'NPR'));
  END IF;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 監査ログテーブル: 全変更を自動記録
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON audit_logs FOR SELECT USING (true);
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. 監査トリガー関数
--    INSERT/UPDATE/DELETEを自動でaudit_logsに記録
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  changed TEXT[];
  old_json JSONB;
  new_json JSONB;
  rec_id UUID;
  k TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    rec_id := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, rec_id, 'INSERT', NULL, new_json, NULL, auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    -- 変更されたフィールドだけを抽出
    changed := ARRAY[]::TEXT[];
    FOR k IN SELECT jsonb_object_keys(new_json)
    LOOP
      IF old_json->k IS DISTINCT FROM new_json->k THEN
        changed := changed || k;
      END IF;
    END LOOP;
    -- updated_atだけの変更は記録しない
    IF changed = ARRAY['updated_at']::TEXT[] THEN
      RETURN NEW;
    END IF;
    rec_id := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, rec_id, 'UPDATE', old_json, new_json, changed, auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    rec_id := OLD.id;
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, rec_id, 'DELETE', old_json, NULL, NULL, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. 主要テーブルに監査トリガーをアタッチ
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP TRIGGER IF EXISTS trg_audit_accounts ON sales_accounts;
CREATE TRIGGER trg_audit_accounts
  AFTER INSERT OR UPDATE OR DELETE ON sales_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_contacts ON sales_contacts;
CREATE TRIGGER trg_audit_contacts
  AFTER INSERT OR UPDATE OR DELETE ON sales_contacts
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_deals ON sales_deals;
CREATE TRIGGER trg_audit_deals
  AFTER INSERT OR UPDATE OR DELETE ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_deal_files ON sales_deal_files;
CREATE TRIGGER trg_audit_deal_files
  AFTER INSERT OR UPDATE OR DELETE ON sales_deal_files
  FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. updated_at 自動更新トリガー（全テーブル共通）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_updated_at_accounts ON sales_accounts;
CREATE TRIGGER trg_updated_at_accounts
  BEFORE UPDATE ON sales_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_updated_at_deals ON sales_deals;
CREATE TRIGGER trg_updated_at_deals
  BEFORE UPDATE ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
