require('dotenv').config();
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- CSV Parser ---
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

// --- Owner mapping ---
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

// --- Stage mapping ---
const STAGE_MAP = {
  "new": "new",
  "negotiation": "negotiation",
  "invoice_sent": "invoice_sent",
  "order_pending": "order_pending",
  "order_completed": "order_completed",
  "goods_received": "goods_received",
  "shipped": "shipped",
  "completed": "closed",
  "lost": "lost"
};
const POST_PHASES = ["order_pending","order_completed","goods_received","shipped","closed"];

async function main() {
  // Find CSV folder
  const sfDir = path.join(__dirname, "..", "Sales Force情報");
  if (!fs.existsSync(sfDir)) {
    console.error("Sales Force情報フォルダが見つかりません:", sfDir);
    process.exit(1);
  }

  // Load CSVs
  const accountsCSV = parseCSV(fs.readFileSync(path.join(sfDir, "clean_accounts.csv"), "utf8"));
  const contactsCSV = parseCSV(fs.readFileSync(path.join(sfDir, "clean_contacts.csv"), "utf8"));
  const dealsCSV = parseCSV(fs.readFileSync(path.join(sfDir, "clean_deals.csv"), "utf8"));
  console.log(`CSV読込: 取引先${accountsCSV.length}件, コンタクト${contactsCSV.length}件, 商談${dealsCSV.length}件`);

  // Get users
  const { data: users } = await sb.from("profiles").select("*");
  const userByEmail = {};
  (users || []).forEach(u => { userByEmail[u.email] = u; });
  console.log(`ユーザー: ${users?.length || 0}件`);

  // ===== STEP 1: 全データ削除 (順序: deals → contacts → accounts) =====
  console.log("\n===== STEP 1: 既存データ全削除 =====");
  
  // deals
  const { data: existingDeals } = await sb.from("sales_deals").select("id").limit(10000);
  if (existingDeals && existingDeals.length > 0) {
    for (let i = 0; i < existingDeals.length; i += 50) {
      const batch = existingDeals.slice(i, i+50).map(d => d.id);
      const { error } = await sb.from("sales_deals").delete().in("id", batch);
      if (error) console.error("deals削除エラー:", error.message);
    }
    console.log(`  deals: ${existingDeals.length}件削除`);
  } else {
    console.log("  deals: 0件");
  }

  // contacts
  const { data: existingContacts } = await sb.from("sales_contacts").select("id").limit(10000);
  if (existingContacts && existingContacts.length > 0) {
    for (let i = 0; i < existingContacts.length; i += 50) {
      const batch = existingContacts.slice(i, i+50).map(d => d.id);
      const { error } = await sb.from("sales_contacts").delete().in("id", batch);
      if (error) console.error("contacts削除エラー:", error.message);
    }
    console.log(`  contacts: ${existingContacts.length}件削除`);
  } else {
    console.log("  contacts: 0件");
  }

  // accounts
  const { data: existingAccounts } = await sb.from("sales_accounts").select("id").limit(10000);
  if (existingAccounts && existingAccounts.length > 0) {
    for (let i = 0; i < existingAccounts.length; i += 50) {
      const batch = existingAccounts.slice(i, i+50).map(d => d.id);
      const { error } = await sb.from("sales_accounts").delete().in("id", batch);
      if (error) console.error("accounts削除エラー:", error.message);
    }
    console.log(`  accounts: ${existingAccounts.length}件削除`);
  } else {
    console.log("  accounts: 0件");
  }

  // 確認
  const { data: checkD } = await sb.from("sales_deals").select("id").limit(1);
  const { data: checkC } = await sb.from("sales_contacts").select("id").limit(1);
  const { data: checkA } = await sb.from("sales_accounts").select("id").limit(1);
  console.log(`  確認 → deals:${checkD?.length||0} contacts:${checkC?.length||0} accounts:${checkA?.length||0}`);

  // ===== STEP 2: Accounts インポート =====
  console.log("\n===== STEP 2: 取引先インポート =====");
  const accountIdMap = {}; // CSV name → Supabase ID
  
  for (const a of accountsCSV) {
    const ownerEmail = OWNER_EMAIL_MAP[a.owner] || "alt@globalstride.jp";
    const ownerUser = userByEmail[ownerEmail];
    
    const row = {
      name: a.name,
      country: a.country || null,
      owner_id: ownerUser?.id || null,
      lead_source: a.lead_source || null,
      notes: a.notes || null
    };
    
    const { data: ins, error } = await sb.from("sales_accounts").insert(row).select("id,name").single();
    if (error) {
      console.error(`  ✗ ${a.name}: ${error.message}`);
    } else {
      accountIdMap[a.name] = ins.id;
    }
  }
  console.log(`  ${Object.keys(accountIdMap).length}/${accountsCSV.length}件完了`);

  // ===== STEP 3: Contacts インポート =====
  console.log("\n===== STEP 3: コンタクトインポート =====");
  let contactOK = 0;
  
  for (const c of contactsCSV) {
    const acctId = accountIdMap[c.account_name];
    if (!acctId) { console.log(`  ⚠ ${c.name}: 取引先「${c.account_name}」なし → スキップ`); continue; }
    
    const row = {
      name: c.name,
      email: c.email || null,
      phone: c.phone || null,
      role: c.role || null,
      account_id: acctId,
      notes: c.notes || null
    };
    
    const { error } = await sb.from("sales_contacts").insert(row);
    if (error) {
      console.error(`  ✗ ${c.name}: ${error.message}`);
    } else {
      contactOK++;
    }
  }
  console.log(`  ${contactOK}/${contactsCSV.length}件完了`);

  // ===== STEP 4: Deals インポート =====
  console.log("\n===== STEP 4: 商談インポート =====");
  
  // 商談名生成用: account別カウンター
  const dealCounters = {};
  // 日付順にソート
  const sortedDeals = [...dealsCSV].sort((a, b) => {
    const da = a.created_date || "9999"; const db = b.created_date || "9999";
    return da.localeCompare(db);
  });
  
  let dealOK = 0;
  for (const d of sortedDeals) {
    const acctName = d.account_name;
    const acctId = accountIdMap[acctName];
    if (!acctId) { console.log(`  ⚠ ${d.deal_name}: 取引先「${acctName}」なし → スキップ`); continue; }
    
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
    
    // 日付マッピング
    const dealDate = createdDate || null; // 商談開始日 = SF作成日
    const paymentDate = (POST_PHASES.includes(stage) && d.close_date) ? d.close_date : null; // 入金日 = SF完了予定日 (post-phase only)
    
    const row = {
      name: dealName,
      account_id: acctId,
      owner_id: ownerUser?.id || null,
      stage: stage,
      amount: parseFloat(d.amount) || 0,
      deal_date: dealDate,
      payment_confirmed_date: paymentDate,
      shipping_method: d.shipping_method || null,
      payment_status: d.payment_status || null,
      supplier_paid: d.supplier_paid === "true" || d.supplier_paid === "yes",
      incoterms: d.incoterms || null,
      notes: d.notes || null
    };
    
    const { error } = await sb.from("sales_deals").insert(row);
    if (error) {
      console.error(`  ✗ ${dealName}: ${error.message}`);
    } else {
      dealOK++;
    }
  }
  console.log(`  ${dealOK}/${dealsCSV.length}件完了`);

  // ===== 最終確認 =====
  console.log("\n===== 最終確認 =====");
  const { data: fA } = await sb.from("sales_accounts").select("id").limit(10000);
  const { data: fC } = await sb.from("sales_contacts").select("id").limit(10000);
  const { data: fD } = await sb.from("sales_deals").select("id").limit(10000);
  console.log(`取引先: ${fA?.length||0}件`);
  console.log(`コンタクト: ${fC?.length||0}件`);
  console.log(`商談: ${fD?.length||0}件`);
  console.log("\n✅ リセット＆インポート完了！");
}

main().catch(e => { console.error("エラー:", e); process.exit(1); });
