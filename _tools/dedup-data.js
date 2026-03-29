require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function dedup(table, keyFn, label) {
  console.log(`\n=== ${label} ===`);
  
  // 全件取得（1000件制限対策）
  const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: true }).limit(5000);
  if (error) { console.error("取得エラー:", error.message); return 0; }
  console.log(`現在の件数: ${data.length}`);

  // キーでグループ化
  const groups = {};
  for (const row of data) {
    const key = keyFn(row);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  const dupes = Object.entries(groups).filter(([, rows]) => rows.length > 1);
  console.log(`重複グループ: ${dupes.length}`);
  if (dupes.length === 0) { console.log("重複なし"); return 0; }

  // 削除対象のID一覧を作成
  const deleteIds = [];
  for (const [key, rows] of dupes) {
    // 古い順にソート済み → 最初を残す
    const toDelete = rows.slice(1);
    console.log(`  「${key.substring(0,40)}」: ${rows.length}件 → ${toDelete.length}件削除`);
    for (const d of toDelete) deleteIds.push(d.id);
  }

  console.log(`削除対象: ${deleteIds.length}件`);

  // 10件ずつバッチ削除
  let deleted = 0;
  for (let i = 0; i < deleteIds.length; i += 10) {
    const batch = deleteIds.slice(i, i + 10);
    const { error: delErr, data: delData } = await sb
      .from(table)
      .delete()
      .in("id", batch)
      .select("id");
    
    if (delErr) {
      console.error(`  バッチ削除エラー:`, delErr.message);
      // 1件ずつフォールバック
      for (const id of batch) {
        const { error: e2 } = await sb.from(table).delete().eq("id", id).select("id");
        if (e2) {
          console.error(`    ID ${id} 削除失敗: ${e2.message}`);
        } else {
          deleted++;
        }
      }
    } else {
      deleted += delData?.length || batch.length;
    }
  }

  // 確認
  const { data: after } = await sb.from(table).select("id").limit(5000);
  console.log(`✅ ${deleted}件削除 → 残り${after?.length || "?"}件`);
  return deleted;
}

async function main() {
  console.log("=== GS Sales 重複データ削除 ===");

  // 順序重要：外部キー制約のため deals → contacts → accounts の順で削除
  const d1 = await dedup("deals", 
    (r) => `${(r.name || "").trim().toLowerCase()}__${r.account_id || ""}`, 
    "① 商談（Deals）");

  const d2 = await dedup("contacts", 
    (r) => `${(r.name || "").trim().toLowerCase()}__${r.account_id || ""}`, 
    "② コンタクト（Contacts）");

  const d3 = await dedup("accounts", 
    (r) => (r.name || "").trim().toLowerCase(), 
    "③ 取引先（Accounts）");

  console.log(`\n=== 完了: 合計 ${d1+d2+d3}件の重複削除 ===`);
}

main().catch(e => { console.error("エラー:", e); process.exit(1); });
