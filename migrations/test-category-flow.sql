-- ============================================
-- カテゴリ統一テスト
-- リード → 取引先 → 商談 の自動継承を検証
-- Supabase SQL Editor で実行
-- ============================================

DO $$
DECLARE
  v_cat_id UUID;
  v_user_id UUID;
  v_lead_id UUID;
  v_result JSONB;
  v_account_id UUID;
  v_deal_id UUID;
  v_acct_cats JSONB;
  v_deal_cats JSONB;
BEGIN
  -- テスト用ユーザーを取得
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'テストユーザーがありません';
  END IF;
  RAISE NOTICE '✓ テストユーザー: %', v_user_id;

  -- テスト用カテゴリを確認/作成
  SELECT id INTO v_cat_id FROM sales_categories WHERE name = '__test_category__' AND deleted_at IS NULL LIMIT 1;
  IF v_cat_id IS NULL THEN
    INSERT INTO sales_categories (name, color, sort_order)
    VALUES ('__test_category__', '#FF0000', 999)
    RETURNING id INTO v_cat_id;
    RAISE NOTICE '✓ テストカテゴリ作成: %', v_cat_id;
  ELSE
    RAISE NOTICE '✓ テストカテゴリ既存: %', v_cat_id;
  END IF;

  -- ② テスト用リードを作成（カテゴリ付き）
  INSERT INTO sales_leads (company_name, contact_name, contact_email, source, status, country, category_ids, owner_id, created_by)
  VALUES ('__TestCo_CatFlow__', 'テスト太郎', 'test@example.com', 'その他', 'new', 'Japan',
          jsonb_build_array(v_cat_id::TEXT), v_user_id, v_user_id)
  RETURNING id INTO v_lead_id;
  RAISE NOTICE '✓ テストリード作成: % (category_ids: [%])', v_lead_id, v_cat_id;

  -- ③ rpc_convert_lead_to_deal でリード→取引先+商談に変換
  SELECT rpc_convert_lead_to_deal(v_lead_id, v_user_id) INTO v_result;
  v_account_id := (v_result->>'account_id')::UUID;
  v_deal_id := (v_result->>'deal_id')::UUID;
  RAISE NOTICE '✓ リード変換完了: account_id=%, deal_id=%', v_account_id, v_deal_id;

  -- ④ 取引先のカテゴリを確認
  SELECT category_ids INTO v_acct_cats FROM sales_accounts WHERE id = v_account_id;
  IF v_acct_cats IS NOT NULL AND v_acct_cats @> jsonb_build_array(v_cat_id::TEXT) THEN
    RAISE NOTICE '✓ [PASS] 取引先にカテゴリが継承されました: %', v_acct_cats;
  ELSE
    RAISE WARNING '✗ [FAIL] 取引先のカテゴリが空または不一致: %', v_acct_cats;
  END IF;

  -- ⑤ 商談のカテゴリを確認（fn_propagate_categories_to_dealsトリガーで自動継承）
  SELECT category_ids INTO v_deal_cats FROM sales_deals WHERE id = v_deal_id;
  IF v_deal_cats IS NOT NULL AND v_deal_cats @> jsonb_build_array(v_cat_id::TEXT) THEN
    RAISE NOTICE '✓ [PASS] 商談にカテゴリが自動継承されました: %', v_deal_cats;
  ELSE
    RAISE WARNING '✗ [FAIL] 商談のカテゴリが空または不一致: % (手動テストが必要かもしれません)', v_deal_cats;
  END IF;

  -- ⑥ 取引先のカテゴリを更新して、商談にも伝播するか確認
  UPDATE sales_accounts
  SET category_ids = jsonb_build_array(v_cat_id::TEXT, 'dummy-cat-id')
  WHERE id = v_account_id;

  -- 商談のカテゴリを再確認
  SELECT category_ids INTO v_deal_cats FROM sales_deals WHERE id = v_deal_id;
  IF v_deal_cats IS NOT NULL AND v_deal_cats @> '"dummy-cat-id"'::JSONB THEN
    RAISE NOTICE '✓ [PASS] 取引先カテゴリ更新が商談に伝播しました: %', v_deal_cats;
  ELSE
    RAISE WARNING '✗ [NOTE] 取引先カテゴリ更新が商談に伝播しませんでした: % (トリガー未設定の場合は正常)', v_deal_cats;
  END IF;

  -- ⑦ テストデータクリーンアップ（外部キー順序に注意）
  -- まずリードの converted_deal_id 参照を外す
  UPDATE sales_leads SET converted_deal_id = NULL, converted_account_id = NULL WHERE id = v_lead_id;
  DELETE FROM sales_activities WHERE deal_id = v_deal_id;
  DELETE FROM sales_deal_files WHERE deal_id = v_deal_id;
  DELETE FROM sales_deals WHERE id = v_deal_id;
  DELETE FROM sales_contacts WHERE account_id = v_account_id;
  DELETE FROM sales_accounts WHERE id = v_account_id;
  DELETE FROM sales_leads WHERE id = v_lead_id;
  DELETE FROM sales_categories WHERE id = v_cat_id;
  RAISE NOTICE '✓ テストデータクリーンアップ完了';
  RAISE NOTICE '========== テスト完了 ==========';
END $$;
