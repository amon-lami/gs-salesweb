-- Strip corporate suffixes from existing deal names
-- Patterns: LLC, Inc, Corp, Co., Ltd., GmbH, S.A., PLC, Pty Ltd, Pte Ltd, L.L.C., Incorporated, Limited, Corporation

-- Preview first (run this SELECT to see what will change):
-- SELECT id, name,
--   TRIM(REGEXP_REPLACE(name, '\s*,?\s*\y(LLC|Inc\.?|Corp\.?|Co\.?,?\s*Ltd\.?|Ltd\.?|GmbH|S\.?A\.?|PLC|Pty\.?\s*Ltd\.?|Pte\.?\s*Ltd\.?|L\.?L\.?C\.?|Incorporated|Limited|Corporation)\y\.?\s*', '', 'gi')) AS cleaned
-- FROM sales_deals
-- WHERE name ~ '\y(LLC|Inc|Corp|Ltd|GmbH|SA|PLC|Pty|Pte|Incorporated|Limited|Corporation)\y';

UPDATE sales_deals
SET name = TRIM(REGEXP_REPLACE(name, '\s*,?\s*\y(LLC|Inc\.?|Corp\.?|Co\.?,?\s*Ltd\.?|Ltd\.?|GmbH|S\.?A\.?|PLC|Pty\.?\s*Ltd\.?|Pte\.?\s*Ltd\.?|L\.?L\.?C\.?|Incorporated|Limited|Corporation)\y\.?\s*', '', 'gi')),
    updated_at = NOW()
WHERE name ~ '\y(LLC|Inc|Corp|Ltd|GmbH|SA|PLC|Pty|Pte|Incorporated|Limited|Corporation)\y'
  AND deleted_at IS NULL;
