-- Migration v19: Update order statuses to match actual workflow
-- 発注管理ステータスの追加・更新

-- 新しいステータスを追加（既存と競合しないようにON CONFLICT）
INSERT INTO order_statuses (id, label, color, sort_order) VALUES
  ('pending',     '未発注',      '#9ca3af', 0),
  ('ub_arrived',  'UB到着',      '#f59e0b', 5),
  ('packed',      '梱包完了',    '#06b6d4', 7),
  ('shipped',     '出荷済',      '#f97316', 8),
  ('koike',       'コイケ到着',  '#f43f5e', 9)
ON CONFLICT (id) DO NOTHING;

-- 既存ステータスのsort_orderを更新して正しい順序にする
UPDATE order_statuses SET sort_order = 0  WHERE id = 'pending';
UPDATE order_statuses SET sort_order = 1  WHERE id = 'ordered';
UPDATE order_statuses SET sort_order = 2  WHERE id = 'paid';
UPDATE order_statuses SET sort_order = 3  WHERE id = 'shipping';
UPDATE order_statuses SET sort_order = 4  WHERE id = 'gs_arrived';
UPDATE order_statuses SET sort_order = 5  WHERE id = 'ub_arrived';
UPDATE order_statuses SET sort_order = 6  WHERE id = 'sg_arrived';
UPDATE order_statuses SET sort_order = 7  WHERE id = 'packed';
UPDATE order_statuses SET sort_order = 8  WHERE id = 'shipped';
UPDATE order_statuses SET sort_order = 9  WHERE id = 'koike';
UPDATE order_statuses SET sort_order = 10 WHERE id = 'delivered';

-- デフォルトステータスを'pending'（未発注）に変更
ALTER TABLE order_items ALTER COLUMN status SET DEFAULT 'pending';
