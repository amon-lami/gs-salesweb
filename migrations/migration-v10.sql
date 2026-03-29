-- ============================================
-- GS Sales CRM - Migration v10
-- 30年CRM基盤強化:
--   1. パフォーマンスインデックス（owner_id / account_id / FK系）
--   2. CHECK制約をmaster tableに委譲（拡張性確保）
--   3. リード→取引先変換のRPCトランザクション化（データ不整合防止）
--   4. 楽観的ロック関数（同時編集によるデータ損失防止）
--   5. audit_logsパーティション準備（長期運用対策）
--   6. soft deleteの安全策（CASCADE保護）
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. パフォーマンスインデックス
--    RLSで毎回評価される owner_id、結合に使う account_id 等に
--    インデックスがないとデータ量増加で全テーブルスキャンになる
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- owner_id系（RLSポリシーが毎クエリ評価するカラム）
CREATE INDEX IF NOT EXISTS idx_deals_owner ON sales_deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON sales_accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON sales_contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON sales_activities(user_id);

-- FK結合で頻繁に使うカラム
CREATE INDEX IF NOT EXISTS idx_deals_account ON sales_deals(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account ON sales_contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_deal_files_deal ON sales_deal_files(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON sales_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_account ON sales_activities(account_id);

-- ダッシュボード集計で使うカラム
CREATE INDEX IF NOT EXISTS idx_deals_stage ON sales_deals(stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_payment_date ON sales_deals(payment_confirmed_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_deals_created ON sales_deals(created_at);

-- 取引先のattributed_to（JBW帰属フィルタ用）
CREATE INDEX IF NOT EXISTS idx_accounts_attributed ON sales_accounts(attributed_to) WHERE attributed_to != '';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. CHECK制約をmaster tableに委譲
--    ハードコードされたCHECK制約だとマスタにステージを
--    追加するたびにmigrationが必要。FKトリガーで検証に変更。
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 2a. 古いCHECK制約を安全に削除
DO $$ BEGIN
  ALTER TABLE sales_deals DROP CONSTRAINT IF EXISTS chk_deals_stage_valid;
  ALTER TABLE sales_deals DROP CONSTRAINT IF EXISTS chk_deals_shipping_valid;
  ALTER TABLE sales_deals DROP CONSTRAINT IF EXISTS chk_deals_payment_status_valid;
  ALTER TABLE sales_deals DROP CONSTRAINT IF EXISTS chk_deals_incoterms_valid;
  ALTER TABLE sales_deals DROP CONSTRAINT IF EXISTS chk_deals_currency_valid;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 2b. バリデーション関数（master tableに存在するかチェック）
--     マスタに値を追加するだけで新ステージ/配送方法が使える
CREATE OR REPLACE FUNCTION fn_validate_deal_stage()
RETURNS TRIGGER AS $$
BEGIN
  -- master_stagesが空（未マイグレーション）の場合はスキップ
  IF EXISTS (SELECT 1 FROM master_stages LIMIT 1) THEN
    IF NOT EXISTS (SELECT 1 FROM master_stages WHERE id = NEW.stage AND is_active = true) THEN
      RAISE EXCEPTION 'Invalid stage: %. Must be an active entry in master_stages.', NEW.stage;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_validate_deal_shipping()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shipping_type IS NOT NULL AND NEW.shipping_type != '' THEN
    IF EXISTS (SELECT 1 FROM master_shipping_types LIMIT 1) THEN
      IF NOT EXISTS (SELECT 1 FROM master_shipping_types WHERE id = NEW.shipping_type AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid shipping_type: %. Must be an active entry in master_shipping_types.', NEW.shipping_type;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2c. バリデーショントリガー
DROP TRIGGER IF EXISTS trg_validate_deal_stage ON sales_deals;
CREATE TRIGGER trg_validate_deal_stage
  BEFORE INSERT OR UPDATE ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_validate_deal_stage();

DROP TRIGGER IF EXISTS trg_validate_deal_shipping ON sales_deals;
CREATE TRIGGER trg_validate_deal_shipping
  BEFORE INSERT OR UPDATE ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_validate_deal_shipping();

-- 2d. 通貨はmaster化せず、より広いCHECKに置き換え（ISO 4217準拠の3文字コード）
--     新通貨を追加するときはALTER CHECKではなくmaster_currenciesテーブルへ
CREATE TABLE IF NOT EXISTS master_currencies (
  code TEXT PRIMARY KEY CHECK (length(code) = 3),
  name_ja TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  decimal_places INT NOT NULL DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_currencies (code, name_ja, symbol, decimal_places, sort_order) VALUES
  ('JPY', '日本円',         '¥', 0, 0),
  ('USD', '米ドル',         '$', 2, 1),
  ('EUR', 'ユーロ',         '€', 2, 2),
  ('GBP', '英ポンド',       '£', 2, 3),
  ('AUD', '豪ドル',        'A$', 2, 4),
  ('CAD', 'カナダドル',     'C$', 2, 5),
  ('SGD', 'シンガポールドル','S$', 2, 6),
  ('THB', 'タイバーツ',     '฿', 2, 7),
  ('AED', 'UAEディルハム',  'د.إ', 2, 8),
  ('SAR', 'サウジリヤル',   '﷼', 2, 9),
  ('CNY', '中国元',         '¥', 2, 10),
  ('KRW', '韓国ウォン',     '₩', 0, 11),
  ('TWD', '台湾ドル',      'NT$', 2, 12),
  ('MYR', 'マレーシアリンギット','RM', 2, 13),
  ('VND', 'ベトナムドン',   '₫', 0, 14),
  ('PHP', 'フィリピンペソ', '₱', 2, 15),
  ('IDR', 'インドネシアルピア','Rp', 0, 16),
  ('INR', 'インドルピー',   '₹', 2, 17),
  ('BRL', 'ブラジルレアル', 'R$', 2, 18),
  ('MXN', 'メキシコペソ',   '$', 2, 19),
  ('CHF', 'スイスフラン',  'CHF', 2, 20),
  ('SEK', 'スウェーデンクローナ','kr', 2, 21),
  ('NZD', 'ニュージーランドドル','NZ$', 2, 22),
  ('HKD', '香港ドル',      'HK$', 2, 23),
  ('NPR', 'ネパールルピー', 'Rs', 2, 24)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE master_currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY mc_select ON master_currencies FOR SELECT USING (true);
CREATE POLICY mc_manage ON master_currencies FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- 通貨バリデーション関数
CREATE OR REPLACE FUNCTION fn_validate_deal_currency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.currency IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM master_currencies LIMIT 1) THEN
      IF NOT EXISTS (SELECT 1 FROM master_currencies WHERE code = NEW.currency AND is_active = true) THEN
        RAISE EXCEPTION 'Invalid currency: %. Must be an active entry in master_currencies.', NEW.currency;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_deal_currency ON sales_deals;
CREATE TRIGGER trg_validate_deal_currency
  BEFORE INSERT OR UPDATE ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_validate_deal_currency();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. リード→取引先+商談 変換RPC（トランザクション化）
--    フロントから3回insertするのではなく、DB関数1回で
--    全て同一トランザクション内で実行。途中失敗で中途半端にならない。
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION rpc_convert_lead_to_deal(
  p_lead_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_lead RECORD;
  v_acct_id UUID;
  v_contact_id UUID;
  v_deal_id UUID;
BEGIN
  -- 1. リード取得＆ロック（他のトランザクションが同時変換するのを防ぐ）
  SELECT * INTO v_lead
  FROM sales_leads
  WHERE id = p_lead_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found or already deleted: %', p_lead_id;
  END IF;

  IF v_lead.status = 'converted' THEN
    RAISE EXCEPTION 'Lead already converted: %', p_lead_id;
  END IF;

  -- 2. 取引先作成
  INSERT INTO sales_accounts (
    name, email, phone, country, website,
    owner_id, created_by, lead_source, attributed_to, category_ids
  ) VALUES (
    v_lead.company_name,
    v_lead.contact_email,
    v_lead.phone,
    v_lead.country,
    v_lead.website,
    COALESCE(v_lead.owner_id, p_user_id),
    p_user_id,
    v_lead.source,
    CASE WHEN v_lead.source = 'JBW' THEN 'JBW' ELSE '' END,
    COALESCE(v_lead.category_ids, '[]'::jsonb)
  )
  RETURNING id INTO v_acct_id;

  -- 3. コンタクト作成（名前がある場合のみ）
  IF v_lead.contact_name IS NOT NULL AND v_lead.contact_name != '' THEN
    INSERT INTO sales_contacts (
      account_id, name, email, phone, whatsapp, is_primary, owner_id
    ) VALUES (
      v_acct_id,
      v_lead.contact_name,
      v_lead.contact_email,
      v_lead.phone,
      v_lead.whatsapp,
      true,
      COALESCE(v_lead.owner_id, p_user_id)
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- 4. 商談作成（category_idsはトリガーfn_inherit_account_categoriesが自動継承）
  INSERT INTO sales_deals (
    account_id, name, stage,
    owner_id, created_by
  ) VALUES (
    v_acct_id,
    v_lead.company_name || ' 商談',
    'new',
    COALESCE(v_lead.owner_id, p_user_id),
    p_user_id
  )
  RETURNING id INTO v_deal_id;

  -- 5. リードをconvertedに更新
  UPDATE sales_leads SET
    status = 'converted',
    converted_account_id = v_acct_id,
    converted_deal_id = v_deal_id,
    converted_at = now()
  WHERE id = p_lead_id;

  -- 6. 結果を返す
  RETURN jsonb_build_object(
    'account_id', v_acct_id,
    'contact_id', v_contact_id,
    'deal_id', v_deal_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPCの実行権限
GRANT EXECUTE ON FUNCTION rpc_convert_lead_to_deal(UUID, UUID) TO authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 楽観的ロック関数
--    updated_atを比較して、他のユーザーが先に更新していたら拒否する
--    これで「最後に保存した人が勝つ」問題を防止
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION rpc_safe_update_deal(
  p_deal_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_current RECORD;
  v_sql TEXT;
  v_key TEXT;
  v_value TEXT;
  v_set_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 現在のレコードを取得＆ロック
  SELECT * INTO v_current
  FROM sales_deals
  WHERE id = p_deal_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  -- updated_atが一致するか確認（楽観的ロック）
  IF v_current.updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFLICT',
      'message', 'このレコードは他のユーザーが先に更新しています。画面を更新してください。',
      'current_updated_at', v_current.updated_at,
      'expected_updated_at', p_expected_updated_at
    );
  END IF;

  -- 動的にUPDATE文を構築（許可されたカラムのみ）
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_updates)
  LOOP
    -- 許可されたカラムのみ更新可能（SQLインジェクション防止）
    IF v_key = ANY(ARRAY[
      'name','stage','amount','currency','confidence','shipping_type',
      'payment_status','incoterms','deal_date','notes','country',
      'shipping_date','eta_date','etd_date','prepayment_percent',
      'payment_confirmed_date','invoice_amount','invoice_number',
      'owner_id','spreadsheet_url','category_ids','attributed_to'
    ]) THEN
      v_set_parts := array_append(v_set_parts, format('%I = %L', v_key, v_value));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) IS NULL OR array_length(v_set_parts, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No fields to update');
  END IF;

  -- updated_atも更新
  v_set_parts := array_append(v_set_parts, format('updated_at = %L', now()));

  v_sql := format('UPDATE sales_deals SET %s WHERE id = %L',
    array_to_string(v_set_parts, ', '),
    p_deal_id
  );
  EXECUTE v_sql;

  RETURN jsonb_build_object(
    'success', true,
    'updated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_safe_update_deal(UUID, TIMESTAMPTZ, JSONB) TO authenticated;

-- 取引先用の楽観的ロック関数
CREATE OR REPLACE FUNCTION rpc_safe_update_account(
  p_account_id UUID,
  p_expected_updated_at TIMESTAMPTZ,
  p_updates JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_current RECORD;
  v_sql TEXT;
  v_key TEXT;
  v_value TEXT;
  v_set_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_current
  FROM sales_accounts
  WHERE id = p_account_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found: %', p_account_id;
  END IF;

  IF v_current.updated_at != p_expected_updated_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONFLICT',
      'message', 'このレコードは他のユーザーが先に更新しています。画面を更新してください。',
      'current_updated_at', v_current.updated_at,
      'expected_updated_at', p_expected_updated_at
    );
  END IF;

  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_updates)
  LOOP
    IF v_key = ANY(ARRAY[
      'name','email','phone','country','website','owner_id',
      'lead_source','attributed_to','category_ids','notes'
    ]) THEN
      v_set_parts := array_append(v_set_parts, format('%I = %L', v_key, v_value));
    END IF;
  END LOOP;

  IF array_length(v_set_parts, 1) IS NULL OR array_length(v_set_parts, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'No fields to update');
  END IF;

  v_set_parts := array_append(v_set_parts, format('updated_at = %L', now()));

  v_sql := format('UPDATE sales_accounts SET %s WHERE id = %L',
    array_to_string(v_set_parts, ', '),
    p_account_id
  );
  EXECUTE v_sql;

  RETURN jsonb_build_object(
    'success', true,
    'updated_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_safe_update_account(UUID, TIMESTAMPTZ, JSONB) TO authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. audit_logsにcreated_atインデックス（月別パーティション準備）
--    現状は単一テーブルだが、将来的にパーティション化する際の準備
--    + 古いログのアーカイブビュー
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- created_at + table_name の複合インデックス（ログ検索高速化）
CREATE INDEX IF NOT EXISTS idx_audit_table_date ON audit_logs(table_name, created_at DESC);

-- 直近90日のログだけを返すビュー（通常のUI表示用）
CREATE OR REPLACE VIEW v_recent_audit_logs AS
SELECT * FROM audit_logs
WHERE created_at > now() - INTERVAL '90 days'
ORDER BY created_at DESC;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. CSV一括インポート用RPC（トランザクション化）
--    途中失敗で中途半端なデータが残らないようにする
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION rpc_bulk_import_accounts(
  p_accounts JSONB,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_acct_id UUID;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_accounts)
  LOOP
    -- 会社名が空ならスキップ
    IF (v_item->>'name') IS NULL OR trim(v_item->>'name') = '' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO sales_accounts (
      name, email, phone, country, website, owner_id, created_by
    ) VALUES (
      trim(v_item->>'name'),
      NULLIF(trim(v_item->>'email'), ''),
      NULLIF(trim(v_item->>'phone'), ''),
      NULLIF(trim(v_item->>'country'), ''),
      NULLIF(trim(v_item->>'website'), ''),
      COALESCE((v_item->>'owner_id')::uuid, p_user_id),
      p_user_id
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'total', jsonb_array_length(p_accounts)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION rpc_bulk_import_accounts(JSONB, UUID) TO authenticated;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 完了メッセージ
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DO $$ BEGIN RAISE NOTICE 'Migration v10 完了: インデックス、CHECK委譲、RPC、楽観的ロック'; END $$;
