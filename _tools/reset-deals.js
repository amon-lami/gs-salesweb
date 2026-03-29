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
    else if (c === '\r' && !inQ) { /* skip */ }
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

const OWNER_EMAIL_MAP = {
  "Amon": "alt@globalstride.jp",
  "Yuki": "yuki.nakagawa@globalstride.jp",
  "Tsumura": "kota.tsumura@globalstride.jp",
  "Chikaki": "chikaki@globalstride.jp",
  "Yuta": "yuta.ito@globalstride.jp",
  "Mark": "mark.matiros@globalstride.jp",
  "Sarah": "sarah.azzouz@globalstride.jp",
  "Joseph": "joseph.mackay@globalstride.jp"
};

const STAGE_MAP = {
  "new": "new", "negotiation": "negotiation", "invoice_sent": "invoice_sent",
  "order_pending": "order_pending", "order_completed": "order_completed",
  "goods_received": "goods_received", "shipped": "shipped", "completed": "closed", "lost": "lost"
};
const POST_PHASES = ["order_pending","order_completed","goods_received","shipped","closed"];

async function main() {
  const sfDir = path.join(__dirname, "..", "Sales Force情報");
  const dealsCSV = parseCSV(fs.readFileSync(path.join(sfDir, "clean_deals.csv"), "utf8"));
  console.log(`CSV読込: 商談${dealsCSV.length}件`);

  // profiles取得
  const { data: profiles } = await sb.from("profiles").select("*");
  const userByEmail = {};
  (profiles || []).forEach(u => { userByEmail[u.email] = u; });
  // Amon has two emails - ensure both resolve
  if (userByEmail['amon.lami@globalstride.jp'] && !userByEmail['alt@globalstride.jp']) {
    userByEmail['alt@globalstride.jp'] = userByEmail['amon.lami@globalstride.jp'];
  }
  if (userByEmail['alt@globalstride.jp'] && !userByEmail['amon.lami@globalstride.jp']) {
    userByEmail['amon.lami@globalstride.jp'] = userByEmail['alt@globalstride.jp'];
  }
  console.log(`profiles: ${profiles?.length || 0}件`);
  console.log('Profile emails:', Object.keys(userByEmail).join(', '));

  // accounts取得 (名前→ID マッピング)
  const { data: accounts } = await sb.from("sales_accounts").select("id,name");
  const accountIdMap = {};
  (accounts || []).forEach(a => { accountIdMap[a.name] = a.id; });
  console.log(`accounts: ${accounts?.length || 0}件`);

  // ===== STEP 1: 商談を全削除 =====
  console.log("\n===== STEP 1: 商談全削除 =====");
  const { data: existing } = await sb.from("sales_deals").select("id").limit(10000);
  console.log(`現在の商談数: ${existing?.length || 0}件`);
  
  if (existing && existing.length > 0) {
    for (let i = 0; i < existing.length; i += 50) {
      const batch = existing.slice(i, i+50).map(d => d.id);
      const { error } = await sb.from("sales_deals").delete().in("id", batch);
      if (error) console.error("  削除エラー:", error.message);
    }
    // 確認
    const { data: check } = await sb.from("sales_deals").select("id").limit(1);
    console.log(`  削除後: ${check?.length || 0}件`);
  }

  // ===== STEP 2: 商談再インポート =====
  console.log("\n===== STEP 2: 商談インポート =====");
  const dealCounters = {};
  const sortedDeals = [...dealsCSV].sort((a, b) => {
    return (a.created_date || "9999").localeCompare(b.created_date || "9999");
  });

  let ok = 0, fail = 0;
  for (const d of sortedDeals) {
    const acctName = d.account_name;
    const acctId = accountIdMap[acctName];
    if (!acctId) { console.log(`  ⚠ スキップ: 取引先「${acctName}」なし`); fail++; continue; }

    const ownerEmail = OWNER_EMAIL_MAP[d.owner] || "alt@globalstride.jp";
    const ownerUser = userByEmail[ownerEmail];
    const stage = STAGE_MAP[d.stage] || "new";

    // 商談名: 会社名 YYMM-NN
    const createdDate = d.created_date || "";
    let dealName = acctName;
    if (createdDate) {
      const dt = new Date(createdDate);
      const yy = String(dt.getFullYear()).slice(2);
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const prefix = `${acctName} ${yy}${mm}`;
      dealCounters[prefix] = (dealCounters[prefix] || 0) + 1;
      dealName = `${prefix}-${String(dealCounters[prefix]).padStart(2, "0")}`;
    }

    const dealDate = createdDate || null;
    const paymentDate = (POST_PHASES.includes(stage) && d.close_date) ? d.close_date : null;

    const row = {
      name: dealName,
      account_id: acctId,
      owner_id: ownerUser?.id || null,
      stage: stage,
      amount: parseFloat(d.amount) || 0,
      deal_date: dealDate,
      payment_confirmed_date: paymentDate,
      notes: d.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from("sales_deals").insert(row);
    if (error) {
      console.error(`  ✗ ${dealName}: ${error.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  // 最終確認
  const { data: final } = await sb.from("sales_deals").select("id").limit(10000);
  console.log(`\n===== 完了 =====`);
  console.log(`インポート: ${ok}件成功, ${fail}件失敗`);
  console.log(`DB内の商談数: ${final?.length || 0}件`);
  console.log("✅ 商談リセット＆インポート完了");
}

main().catch(e => { console.error(e); process.exit(1); });
