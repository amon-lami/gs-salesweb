require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const SF_DIR = path.join(__dirname, '..', 'Sales Force情報');
const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const TEAM = [
  { email: 'yuki.nakagawa@globalstride.jp', name: 'Yuki Nakagawa', mapKey: 'Yuki' },
  { email: 'kota.tsumura@globalstride.jp', name: 'Kota Tsumura', mapKey: 'Tsumura' },
  { email: 'chikaki@globalstride.jp', name: 'Chikaki Kosuke', mapKey: 'Chikaki' },
  { email: 'yuta.ito@globalstride.jp', name: 'Yuta Ito', mapKey: 'Yuta' },
  { email: 'mark.matiros@globalstride.jp', name: 'Mark Martirossian', mapKey: 'Mark' },
  { email: 'sarah.azzouz@globalstride.jp', name: 'Sarah Azzouz', mapKey: 'Sarah' },
  { email: 'joseph.mackay@globalstride.jp', name: 'Joseph Mackay', mapKey: 'Joseph' },
];
const TEAM_PASSWORD = process.env.TEAM_DEFAULT_PASSWORD || 'CHANGE_ME';

function parseCSV(text) {
  const rows = []; let current = ''; let inQuote = false; let row = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (inQuote && text[i+1] === '"') { current += '"'; i++; } else { inQuote = !inQuote; } }
    else if (c === ',' && !inQuote) { row.push(current); current = ''; }
    else if ((c === '\n' || c === '\r') && !inQuote) { row.push(current); current = ''; if (row.length > 1 || row[0]?.trim()) rows.push(row); row = []; if (c === '\r' && text[i+1] === '\n') i++; }
    else { current += c; }
  }
  if (current || row.length) { row.push(current); rows.push(row); }
  return rows;
}
function csvToObjects(text) {
  const rows = parseCSV(text); if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => { const obj = {}; headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); }); return obj; });
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  GS Sales - アカウント作成 & データインポート  ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  for (const f of ['clean_accounts.csv', 'clean_contacts.csv', 'clean_deals.csv']) {
    if (!fs.existsSync(path.join(SF_DIR, f))) { console.error('❌ ' + f + ' が見つかりません'); rl.close(); return; }
  }
  console.log('📁 CSVファイル確認OK\n');

  // Use service_role key for admin operations (bypasses RLS, can create users)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const OWNER_MAP = {};

  // ===== STEP 0: Create team accounts =====
  console.log('━━━ STEP 0: チームアカウント作成 ━━━');
  for (const member of TEAM) {
    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === member.email);
    if (existing) {
      OWNER_MAP[member.mapKey] = existing.id;
      console.log('  ✅ ' + member.name + ' (既存)');
      await admin.from('users').upsert({ id: existing.id, name: member.name, email: member.email }, { onConflict: 'id' });
      continue;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email: member.email,
      password: TEAM_PASSWORD,
      email_confirm: true,
      user_metadata: { name: member.name }
    });
    if (error) {
      console.log('  ❌ ' + member.name + ': ' + error.message);
    } else {
      OWNER_MAP[member.mapKey] = data.user.id;
      console.log('  ✅ ' + member.name + ' (新規作成)');
      await admin.from('users').upsert({ id: data.user.id, name: member.name, email: member.email }, { onConflict: 'id' });
    }
  }

  // Amon
  console.log('\n━━━ Amonアカウント確認 ━━━');
  const { data: allAuthUsers } = await admin.auth.admin.listUsers();
  const amon = allAuthUsers?.users?.find(u => u.email?.includes('amon') || u.email?.includes('alt@'));
  if (amon) {
    OWNER_MAP['Amon'] = amon.id;
    console.log('  ✅ Amon (' + amon.email + ')');
    await admin.from('users').upsert({ id: amon.id, name: 'Amon Lamichhane', email: amon.email }, { onConflict: 'id' });
  } else {
    console.log('  ⚠ Amonのアカウントが見つかりません。alt@globalstride.jpで検索中...');
    const amonAlt = allAuthUsers?.users?.find(u => u.email === 'alt@globalstride.jp');
    if (amonAlt) {
      OWNER_MAP['Amon'] = amonAlt.id;
      console.log('  ✅ Amon (' + amonAlt.email + ')');
      await admin.from('users').upsert({ id: amonAlt.id, name: 'Amon Lamichhane', email: amonAlt.email }, { onConflict: 'id' });
    }
  }

  console.log('\n📋 オーナーマッピング:');
  for (const [name, id] of Object.entries(OWNER_MAP)) {
    console.log('  ' + name + ': ' + (id ? '✓' : '⚠ 未マッチ'));
  }
  const fallbackId = OWNER_MAP['Amon'] || Object.values(OWNER_MAP).find(Boolean);
  const resolveOwner = (name) => OWNER_MAP[name] || fallbackId;

  const cont = await ask('\nインポートを開始しますか？ (y/n): ');
  if (cont.toLowerCase() !== 'y') { console.log('中止しました。'); rl.close(); return; }

  // Check existing
  const { data: existingAccounts } = await admin.from('sales_accounts').select('id,name');
  const existingMap = {};
  (existingAccounts || []).forEach(a => { existingMap[a.name] = a.id; });

  // ===== STEP 1: Accounts =====
  console.log('\n━━━ STEP 1/3: 取引先インポート ━━━');
  const accountRows = csvToObjects(fs.readFileSync(path.join(SF_DIR, 'clean_accounts.csv'), 'utf-8'));
  console.log(accountRows.length + '件の取引先...');
  const accountIdMap = { ...existingMap };
  let acctOk = 0, acctSkip = 0, acctErr = 0;
  for (const row of accountRows) {
    if (!row.name) continue;
    if (existingMap[row.name]) { accountIdMap[row.name] = existingMap[row.name]; acctSkip++; continue; }
    const ins = { name: row.name, owner_id: resolveOwner(row.owner), country: row.country || null, address_billing: row.state || null, lead_source: row.source || null, updated_at: new Date().toISOString() };
    const { data, error } = await admin.from('sales_accounts').insert(ins).select('id').single();
    if (error) { console.log('  ❌ ' + row.name + ': ' + error.message); acctErr++; }
    else { accountIdMap[row.name] = data.id; acctOk++; }
  }
  console.log('  ✅ 追加: ' + acctOk + ', スキップ: ' + acctSkip + ', エラー: ' + acctErr + '\n');

  const { data: refreshed } = await admin.from('sales_accounts').select('id,name');
  (refreshed || []).forEach(a => { accountIdMap[a.name] = a.id; });

  // ===== STEP 2: Contacts =====
  console.log('━━━ STEP 2/3: コンタクトインポート ━━━');
  const contactRows = csvToObjects(fs.readFileSync(path.join(SF_DIR, 'clean_contacts.csv'), 'utf-8'));
  console.log(contactRows.length + '件のコンタクト...');
  let contOk = 0, contErr = 0;
  for (const row of contactRows) {
    if (!row.name) continue;
    const acctId = accountIdMap[row.account_name] || null;
    const ins = { name: row.name, role: row.role || null, account_id: acctId, email: row.email || null, phone: row.phone || null };
    const { error } = await admin.from('sales_contacts').insert(ins);
    if (error) { console.log('  ❌ ' + row.name + ': ' + error.message); contErr++; }
    else { contOk++; }
  }
  console.log('  ✅ 追加: ' + contOk + ', エラー: ' + contErr + '\n');

  // ===== STEP 3: Deals =====
  console.log('━━━ STEP 3/3: 商談インポート ━━━');
  const dealRows = csvToObjects(fs.readFileSync(path.join(SF_DIR, 'clean_deals.csv'), 'utf-8'));
  console.log(dealRows.length + '件の商談...');
  let dealOk = 0, dealErr = 0;
  const dealNameCounts = {}; // "会社名_YYMM" → count (for sequential numbering)
  for (const row of dealRows) {
    if (!row.clean_name) continue;
    // Generate deal name: 会社名 YYMM-01
    const acctName = row.account_name || '';
    const created = row.created_date || '';
    let ym = '';
    if (created) {
      const parts = created.replace(/-/g, '/').split('/');
      if (parts.length >= 2) { ym = parts[0].slice(-2) + parts[1].padStart(2, '0'); }
    }
    const key = acctName + '_' + ym;
    dealNameCounts[key] = (dealNameCounts[key] || 0) + 1;
    const seq = String(dealNameCounts[key]).padStart(2, '0');
    const name = acctName + (ym ? ' ' + ym + '-' + seq : '');
    const acctId = accountIdMap[row.account_name] || null;
    const amount = row.amount ? Number(row.amount) : null;
    const confidence = row.confidence ? Number(row.confidence) : 50;
    const prepay = row.prepayment_percent ? Number(row.prepayment_percent) : 0;
    const supPaid = row.supplier_paid === 'True' || row.supplier_paid === 'true';
    const created = row.created_date ? row.created_date.replace(/\//g, '-') : null;
    const close = row.close_date ? row.close_date.replace(/\//g, '-') : null;
    const ins = {
      name, account_id: acctId, owner_id: resolveOwner(row.owner), stage: row.stage || 'negotiation',
      amount, confidence, shipping_type: row.shipping_type || null, prepayment_percent: prepay,
      payment_status: prepay >= 100 ? 'full' : prepay > 0 ? 'partial' : 'none',
      supplier_paid: supPaid, incoterms: row.incoterms || null, lead_source: row.source || null,
      notes: row.notes || null, deal_date: created, updated_at: new Date().toISOString()
    };
    // Order Pending以降: SF完了予定日 → 入金日
    const postStages = ['order_pending', 'order_completed', 'goods_received', 'shipped', 'closed'];
    if (postStages.includes(row.stage) && close) { ins.payment_confirmed_date = close; }
    const { error } = await admin.from('sales_deals').insert(ins);
    if (error) { console.log('  ❌ ' + name + ': ' + error.message); dealErr++; }
    else { dealOk++; }
  }
  console.log('  ✅ 追加: ' + dealOk + ', エラー: ' + dealErr + '\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 インポート完了:');
  console.log('  チームアカウント: ' + Object.keys(OWNER_MAP).length + '名');
  console.log('  取引先: ' + acctOk + '件 (' + acctSkip + '件スキップ)');
  console.log('  コンタクト: ' + contOk + '件');
  console.log('  商談: ' + dealOk + '件');
  if (acctErr || contErr || dealErr) { console.log('  ⚠ エラー: ' + (acctErr + contErr + dealErr) + '件'); }
  console.log('\n🎉 GS Salesアプリを再起動してデータを確認してください。');
  rl.close();
}

main().catch(e => { console.error('エラー:', e.message); rl.close(); });
