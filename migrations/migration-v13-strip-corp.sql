-- Migration v13: Remove corporate suffixes (LLC, Inc, Ltd, etc.) from account names and deal names

-- Clean account names
UPDATE sales_accounts SET name = trim(regexp_replace(
  name,
  '\s*,?\s*\m(LLC|Inc\.?|Corp\.?|Co\.?\s*,?\s*Ltd\.?|Ltd\.?|GmbH|S\.?A\.?|PLC|Pty\.?\s*Ltd\.?|Pte\.?\s*Ltd\.?|L\.?L\.?C\.?|Incorporated|Limited|Corporation)\M\.?\s*',
  '', 'gi'
))
WHERE name ~* '\m(LLC|Inc|Corp|Ltd|GmbH|PLC|Pty|Pte|Incorporated|Limited|Corporation)\M';

-- Clean deal names (they contain account names)
UPDATE sales_deals SET name = trim(regexp_replace(
  name,
  '\s*,?\s*\m(LLC|Inc\.?|Corp\.?|Co\.?\s*,?\s*Ltd\.?|Ltd\.?|GmbH|S\.?A\.?|PLC|Pty\.?\s*Ltd\.?|Pte\.?\s*Ltd\.?|L\.?L\.?C\.?|Incorporated|Limited|Corporation)\M\.?\s*',
  '', 'gi'
))
WHERE name ~* '\m(LLC|Inc|Corp|Ltd|GmbH|PLC|Pty|Pte|Incorporated|Limited|Corporation)\M';
