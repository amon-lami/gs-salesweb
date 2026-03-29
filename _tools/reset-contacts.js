require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function parseCSV(text) {
  const lines = []; let cur = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (inQ && text[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
    else if (c === '\n' && !inQ) { lines.push(cur); cur = ""; }
    else if (c === '\r' && !inQ) { }
    else { cur += c; }
  }
  if (cur.trim()) lines.push(cur);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = []; let v = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i+1] === '"') { v += '"'; i++; } else { q = !q; } }
      else if (c === ',' && !q) { vals.push(v); v = ""; }
      else { v += c; }
    }
    vals.push(v);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || "").trim(); });
    return obj;
  });
}

async function main() {
  const sfDir = path.join(__dirname, "..", "Sales Force情報");
  const csv = parseCSV(fs.readFileSync(path.join(sfDir, "clean_contacts.csv"), "utf8"));
  console.log("CSV読込: コンタクト" + csv.length + "件");

  const { data: accounts } = await sb.from("sales_accounts").select("id,name");
  const acctMap = {};
  (accounts || []).forEach(a => { acctMap[a.name] = a.id; });

  // 商談からaccount_id→owner_idのマッピングを取得
  const { data: deals } = await sb.from("sales_deals").select("account_id,owner_id").order("created_at", { ascending: false });
  const acctOwnerMap = {};
  (deals || []).forEach(d => {
    if (d.account_id && d.owner_id && !acctOwnerMap[d.account_id]) {
      acctOwnerMap[d.account_id] = d.owner_id;
    }
  });
  console.log("accounts: " + (accounts?.length || 0) + "件, deals: " + (deals?.length || 0) + "件");

  // STEP 1: 全削除
  console.log("\n===== STEP 1: コンタクト全削除 =====");
  const { data: existing } = await sb.from("sales_contacts").select("id").limit(10000);
  console.log("現在: " + (existing?.length || 0) + "件");
  if (existing && existing.length > 0) {
    for (let i = 0; i < existing.length; i += 50) {
      const batch = existing.slice(i, i+50).map(d => d.id);
      await sb.from("sales_contacts").delete().in("id", batch);
    }
    const { data: check } = await sb.from("sales_contacts").select("id").limit(1);
    console.log("削除後: " + (check?.length || 0) + "件");
  }

  // STEP 2: インポート
  console.log("\n===== STEP 2: コンタクトインポート =====");
  let ok = 0, fail = 0;
  for (const c of csv) {
    const acctId = acctMap[c.account_name];
    if (!acctId) { console.log("  ⚠ スキップ: 取引先「" + c.account_name + "」なし"); fail++; continue; }
    const ownerId = acctOwnerMap[acctId] || null;
    const row = {
      account_id: acctId,
      name: c.name || "",
      role: c.role || null,
      email: c.email || null,
      phone: c.phone || null,
      owner_id: ownerId
    };
    const { error } = await sb.from("sales_contacts").insert(row);
    if (error) { console.error("  ✗ " + c.name + ": " + error.message); fail++; }
    else { ok++; }
  }

  const { data: final } = await sb.from("sales_contacts").select("id").limit(10000);
  console.log("\n===== 完了 =====");
  console.log("インポート: " + ok + "件成功, " + fail + "件失敗");
  console.log("DB内コンタクト数: " + (final?.length || 0) + "件");
}

main().catch(e => { console.error(e); process.exit(1); });
