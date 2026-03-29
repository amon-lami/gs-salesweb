-- J-Beautyカテゴリを全取引先に一括付与
-- Supabase SQL Editorで実行してください

-- Step 1: J-Beautyカテゴリのidを確認
SELECT id, name FROM sales_categories WHERE name ILIKE '%J-Beauty%' AND deleted_at IS NULL;

-- Step 2: 上記で取得したIDを使って以下を実行（IDは適宜差し替え）
-- ※ 既にJ-Beautyが付与されている取引先はスキップされます

-- category_ids が NULL の取引先 → [J-Beauty ID] を設定
UPDATE sales_accounts
SET category_ids = jsonb_build_array(
  (SELECT id FROM sales_categories WHERE name ILIKE '%J-Beauty%' AND deleted_at IS NULL LIMIT 1)
)
WHERE (category_ids IS NULL OR category_ids = '[]'::jsonb)
  AND deleted_at IS NULL;

-- category_ids が既にある取引先 → J-Beautyを追加（重複なし）
UPDATE sales_accounts
SET category_ids = category_ids || jsonb_build_array(
  (SELECT id FROM sales_categories WHERE name ILIKE '%J-Beauty%' AND deleted_at IS NULL LIMIT 1)
)
WHERE category_ids IS NOT NULL
  AND category_ids != '[]'::jsonb
  AND NOT category_ids @> jsonb_build_array(
    (SELECT id FROM sales_categories WHERE name ILIKE '%J-Beauty%' AND deleted_at IS NULL LIMIT 1)
  )
  AND deleted_at IS NULL;

-- 確認: 更新された取引先数
SELECT count(*) as total_accounts,
       count(*) FILTER (WHERE category_ids @> jsonb_build_array(
         (SELECT id FROM sales_categories WHERE name ILIKE '%J-Beauty%' AND deleted_at IS NULL LIMIT 1)
       )) as with_jbeauty
FROM sales_accounts
WHERE deleted_at IS NULL;
