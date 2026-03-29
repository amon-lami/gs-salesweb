# GS Sales CRM - バックアップ自動化設計

## 現状
- Supabase Free/Pro プランの自動バックアップに依存
- 手動エクスポート機能なし

---

## 推奨バックアップ戦略（3層構造）

### Layer 1: Supabase ネイティブバックアップ
- **Pro プラン以上**: 自動日次バックアップ（7日間保持）
- **Point-in-Time Recovery (PITR)**: Pro プラン追加オプション
- **設定**: Supabase Dashboard → Database → Backups
- **コスト**: Pro プラン $25/月に含まれる

### Layer 2: アプリ内エクスポート機能（推奨・次フェーズ実装）
- CRM画面内の「設定」からCSV/JSONエクスポートボタンを設置
- 対象テーブル: sales_deals, sales_accounts, sales_contacts, sales_leads, sales_categories, sales_activities
- 実装方法:
  ```typescript
  // Supabaseから全件取得してJSON化
  const exportAll = async () => {
    const tables = ['sales_deals', 'sales_accounts', 'sales_contacts',
                    'sales_leads', 'sales_categories'];
    const backup: Record<string, unknown[]> = {};
    for (const t of tables) {
      const { data } = await client.from(t).select('*');
      backup[t] = data || [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    // Electron: window.api.saveFile(url, `gs-crm-backup-${date}.json`)
  };
  ```

### Layer 3: 定期自動バックアップスクリプト（pg_dump）
- サーバーまたはCI/CDから `pg_dump` を週次実行
- Google Drive または S3 に保存

```bash
#!/bin/bash
# backup-gs-crm.sh
# cron: 0 3 * * 0  (毎週日曜 AM3:00)

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/gs-crm"
DB_URL="postgresql://postgres.[project-ref]:[password]@[host]:5432/postgres"

mkdir -p $BACKUP_DIR

# テーブル単位でバックアップ
for TABLE in sales_deals sales_accounts sales_contacts sales_leads sales_categories sales_activities sales_deal_files master_stages master_shipping_types master_currencies; do
  pg_dump "$DB_URL" --table="public.$TABLE" --data-only --format=custom \
    -f "$BACKUP_DIR/${TABLE}_${DATE}.dump"
done

# 全体バックアップ（スキーマ込み）
pg_dump "$DB_URL" --schema=public --format=custom \
  -f "$BACKUP_DIR/full_${DATE}.dump"

# 30日以上古いバックアップを削除
find $BACKUP_DIR -name "*.dump" -mtime +30 -delete

echo "Backup completed: $DATE"
```

---

## 保持ポリシー

| 期間 | 頻度 | 保持期間 |
|------|------|---------|
| 日次 | Supabase自動 | 7日 |
| 週次 | pg_dump スクリプト | 30日 |
| 月次 | 手動 or 自動 | 1年 |

---

## 災害復旧手順

1. **Supabase側の障害**: Point-in-Time Recovery で任意の時点に復元
2. **データ破損**: pg_dump から `pg_restore` で該当テーブルのみ復元
3. **完全リストア**: full_*.dump からスキーマ + データを一括復元

```bash
# 単一テーブル復元
pg_restore -d "$DB_URL" --data-only --table=sales_deals backup_file.dump

# 全体復元（既存データを削除して復元）
pg_restore -d "$DB_URL" --clean --if-exists backup_file.dump
```

---

## 優先度

1. **即時**: Supabase Pro プランに移行（$25/月）→ 自動日次バックアップ有効化
2. **1週間以内**: アプリ内エクスポート機能を実装（設定画面に追加）
3. **1ヶ月以内**: pg_dump 定期スクリプトをGitHub ActionsまたはCronで自動化
