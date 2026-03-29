-- ============================================================
-- Migration v16: Expense & DM room types
-- chat_rooms.type にexpense, dm を追加（既にtext型なら不要）
-- ============================================================

-- chat_rooms.type は既にtext型のため、'group', 'deal' に加え
-- 'expense', 'dm' を格納可能。追加のスキーマ変更は不要。

-- もし type カラムがenum型の場合のみ以下を実行:
-- ALTER TYPE chat_room_type ADD VALUE IF NOT EXISTS 'expense';
-- ALTER TYPE chat_room_type ADD VALUE IF NOT EXISTS 'dm';

-- 確認用クエリ:
-- SELECT DISTINCT type FROM chat_rooms;
