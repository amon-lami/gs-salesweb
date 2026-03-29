# GS Sales CRM - プロジェクト構成

最終更新: 2026-03-29

## 概要

Global Stride 営業管理CRM。Supabase + 単一HTML SPA として運用中。
Vercelでホスティング、GitHubリポジトリ: `amon-lami/gs-salesweb`

---

## 本番環境（現在稼働中）

本番で使用しているのは **`web/`ディレクトリ内のファイルのみ**。

```
web/
├── index.html          ← 本番SPA（7507行、全UIをこの1ファイルに含む）
├── chat-core.js        ← GS-Chat チャットエンジン（外部スクリプト）
├── vercel.json         ← Vercelルーティング設定（SPA fallback）
├── assets/             ← Viteビルド出力（現在未使用）
└── migration-*.sql     ← DB移行スクリプト（適用済み）
```

### Vercelデプロイ設定
- **Root Directory**: `web`
- **Framework Preset**: Other
- **Build Command**: なし（静的ファイルをそのまま配信）
- **Output Directory**: `.`（web/そのものが公開ディレクトリ）

---

## Supabase

### 接続情報
- **Project URL**: `https://yzwrumeukjidsguixqxr.supabase.co`
- **ANON KEY**: `web/index.html` 内にハードコード（L22付近）

### Edge Functions（`supabase/functions/`）
| 関数名 | 用途 |
|--------|------|
| `receipt-ocr` | レシート画像のOCR解析（経費管理） |
| `order-parse` | GS-AIによる注文メール解析（見積書/請求書作成） |
| `notion-tasks` | Notion連携でToDo同期 |

### DBスキーマ
- `migrations/schema.sql` にベーススキーマ
- `migrations/migration-v*.sql` に増分マイグレーション（v2〜v16）
- `migrations/migration-phase1-*.sql` に商品マスタ・配送関連

---

## web/index.html の主要機能（33コンポーネント）

| ページ | 機能 |
|--------|------|
| Dashboard | KPI、月次グラフ、ひとこと(Hitokoto)、アクティビティフィード |
| Deals（商談） | カンバンビュー、商談詳細、請求書アップロード+OCR |
| Accounts（取引先） | 一覧、詳細、関連商談・連絡先表示 |
| Contacts（連絡先） | 一覧、詳細、関連取引先・商談表示 |
| Leads（リード） | 一覧、詳細、アクション履歴、商談化変換 |
| Reports（週次レポート） | 週次売上レポート |
| ToDo | タスク管理、Notion連携 |
| Expenses（経費） | 経費入力、レシートOCR、BtoB/Amazon分割、CSV出力 |
| Documents（書類） | 見積書/請求書/納品書作成、商品マスタ管理 |
| GS-Chat | チーム内チャット（chat-core.js） |
| Settings | カテゴリ管理、マルチ事業管理、CSVインポート |

---

## 未使用（アーカイブ）ディレクトリ

以下は**本番では使用していない**。将来のVite移行用に保持。

```
src/                         ← Vite + React + TypeScript版（移行途中）
├── components/              ← 33コンポーネント（TypeScript化済み）
├── hooks/                   ← カスタムフック
├── lib/                     ← supabase.ts, constants.ts
├── types/                   ← database.ts（型定義）
├── App.tsx                  ← ルートコンポーネント
└── main.tsx                 ← エントリポイント

_archive-electron-app/       ← 旧Electronアプリ版（廃止済み）
_archive-electron-src/       ← 旧Electronソース（廃止済み）
_tools/                      ← データ移行・メンテナンスツール群
├── import-sf-data.mjs       ← Salesforceデータインポート
├── fix-profiles.js          ← プロフィール修正
├── normalize-phones.js      ← 電話番号正規化
└── ...

versions/                    ← index.htmlの過去バージョン保管
```

### Vite関連ファイル（現在未使用）
- `package.json` — Viteビルド設定（`npm run build` → `web/`に出力）
- `vite.config.ts` — Vite設定
- `tsconfig.json` — TypeScript設定
- `.env` — Supabase環境変数（Viteビルド用）

---

## 開発メモ

- **本番の修正は `web/index.html` を直接編集**してGitHubにプッシュ → Vercel自動デプロイ
- Vite版への再移行は `src/` のコードをベースに可能（ブラウザバック、モバイルナビ等の課題あり）
- `chat-core.js` は `web/` に配置し `<script>` タグで読み込み（npmパッケージではない）
