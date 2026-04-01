# GS Sales CRM

Global Stride 営業管理システム（Vite + React + TypeScript + Supabase）

---

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/amon-lami/gs-salesweb.git
cd gs-salesweb
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、Supabase の接続情報を記入します。

```bash
cp .env.example .env
```

`.env` を編集：

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **接続情報の確認場所：** Supabase ダッシュボード → 対象プロジェクト → Project Settings → API

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

---

## Claude Code Preview を使う場合（Windows）

Claude Code の Preview 機能でアプリをプレビューする場合、以下の点に注意してください。

### よくある問題

| 症状 | 原因 | 対処 |
|------|------|------|
| `spawn npm ENOENT` | Node.js が bash の PATH に入っていない | `.claude/start-dev.cmd` が自動対処（`C:\Program Files\nodejs` を追加） |
| 「読み込み中...」で止まる | `.env` が未設定 or Vite が間違ったディレクトリで起動している | 上記セットアップ手順を確認 |
| Supabase に接続できない | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が未設定 | `.env` ファイルを作成して設定 |

### Preview の起動方法

このリポジトリには `.claude/launch.json` と `.claude/start-dev.cmd` が含まれています。Claude Code 上で次のコマンドを実行するだけで起動できます：

```
preview_start: gs-sales-app
```

> **Node.js が `C:\Program Files\nodejs` 以外にインストールされている場合：**
> `.claude/start-dev.cmd` の `PATH` 設定を環境に合わせて修正してください。

---

## 技術スタック

- **フロントエンド：** React 18 + TypeScript + Vite
- **バックエンド：** Supabase（PostgreSQL + Auth + Storage）
- **スタイリング：** インラインスタイル（Noto Sans JP）

## 主な機能

- ダッシュボード
- リード管理
- 商談管理（カンバンボード）
- 顧客・取引先管理
- 連絡先管理
- 週次レポート
- ToDo管理
- 経費管理
- 見積・請求書作成
- チャット
