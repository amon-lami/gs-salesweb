-- ============================================
-- GS Sales CRM - Migration v9
-- カテゴリ統一: リード・商談にcategory_ids追加
-- リード→取引先→商談の自動継承を可能にする
-- ============================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. リードにcategory_ids追加
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. 商談にcategory_ids追加（既存のcategoryカラムは残して互換性維持）
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE sales_deals ADD COLUMN IF NOT EXISTS category_ids JSONB DEFAULT '[]'::jsonb;

-- 既存データのマイグレーション:
-- 商談のcategory(TEXT)を持つ場合、category_idsにも反映
-- beauty → J-Beauty のID、matcha → 抹茶 のIDを検索して設定
DO $$
DECLARE
  beauty_id UUID;
  matcha_id UUID;
BEGIN
  SELECT id INTO beauty_id FROM sales_categories WHERE name = 'J-Beauty' LIMIT 1;
  SELECT id INTO matcha_id FROM sales_categories WHERE name = '抹茶' LIMIT 1;

  -- category = 'beauty' の商談にJ-BeautyのIDをセット
  IF beauty_id IS NOT NULL THEN
    UPDATE sales_deals
    SET category_ids = jsonb_build_array(beauty_id::text)
    WHERE category = 'beauty' AND (category_ids IS NULL OR category_ids = '[]'::jsonb);
  END IF;

  -- category = 'matcha' の商談に抹茶のIDをセット
  IF matcha_id IS NOT NULL THEN
    UPDATE sales_deals
    SET category_ids = jsonb_build_array(matcha_id::text)
    WHERE category = 'matcha' AND (category_ids IS NULL OR category_ids = '[]'::jsonb);
  END IF;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 商談作成時に取引先のカテゴリを自動継承するトリガー
--    商談のcategory_idsが空 & account_idがある場合、取引先のcategory_idsをコピー
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION fn_inherit_account_categories()
RETURNS TRIGGER AS $$
DECLARE
  acct_categories JSONB;
BEGIN
  -- category_idsが空で、account_idがある場合のみ継承
  IF (NEW.category_ids IS NULL OR NEW.category_ids = '[]'::jsonb) AND NEW.account_id IS NOT NULL THEN
    SELECT category_ids INTO acct_categories
    FROM sales_accounts
    WHERE id = NEW.account_id AND deleted_at IS NULL;

    IF acct_categories IS NOT NULL AND acct_categories != '[]'::jsonb THEN
      NEW.category_ids := acct_categories;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_categories_deals ON sales_deals;
CREATE TRIGGER trg_inherit_categories_deals
  BEFORE INSERT ON sales_deals
  FOR EACH ROW EXECUTE FUNCTION fn_inherit_account_categories();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. 取引先のカテゴリ変更時に関連商談にも反映するトリガー
--    取引先のcategory_idsが変わったら、
--    その取引先に紐づく商談のcategory_idsも更新
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION fn_propagate_categories_to_deals()
RETURNS TRIGGER AS $$
BEGIN
  -- category_idsが変更された場合のみ
  IF OLD.category_ids IS DISTINCT FROM NEW.category_ids THEN
    UPDATE sales_deals
    SET category_ids = NEW.category_ids,
        updated_at = now()
    WHERE account_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_categories ON sales_accounts;
CREATE TRIGGER trg_propagate_categories
  AFTER UPDATE ON sales_accounts
  FOR EACH ROW EXECUTE FUNCTION fn_propagate_categories_to_deals();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. インデックス
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_deals_category_ids ON sales_deals USING gin(category_ids);
CREATE INDEX IF NOT EXISTS idx_leads_category_ids ON sales_leads USING gin(category_ids);
