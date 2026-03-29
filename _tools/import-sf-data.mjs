/**
 * Salesforce → GS Sales インポートスクリプト
 * 
 * 使い方:
 *   cd gs-sales
 *   node import-sf-data.mjs
 * 
 * 事前にGS Salesアプリにログインしておくこと（Supabase設定済みであること）
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SF_DIR = join(__dirname, '..', 'Sales Force情報');

// ===== CONFIG =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

// ===== CSV Parser =====
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuote = false;
  let row = [];
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuote && text[i + 1] === '"') { current += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (c === ',' && !inQuote) {
      row.push(current); current = '';
    } else if ((c === '\n' || c === '\r') && !inQuote) {
      row.push(current); current = '';
      if (row.length > 1 || row[0]?.trim()) rows.push(row);
      row = [];
      if (c === '\r' && text[i + 1] === '\n') i++;
    } else {
      current += c;
    }
  }
  if (current || row.length) { row.push(current); rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
    return obj;
  });
}

// ===== MAIN =====
async function main() {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║  GS Sales - Salesforce データインポート  ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // Auth
  const email = await ask('GS Salesのメールアドレス: ');
  const password = await ask('パスワード: ');
  
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('❌ ログインエラー:', authErr.message);
    rl.close(); return;
  }
  console.log('✅ ログイン成功:', authData.user.email, '\n');
  const userId = authData.user.id;

  // Load users for owner mapping
  const { data: allUsers } = await sb.from('users').select('id,name,email');
  console.log('📋 登録ユーザー:');
  allUsers?.forEach(u => console.log(`  - ${u.name} (${u.email})`));

  const OWNER_MAP = {
    'Amon': allUsers?.find(u => u.name?.includes('Amon') || u.email?.includes('amon'))?.id,
    'Yuki': allUsers?.find(u => u.name?.includes('Yuki') || u.name?.includes('Nakagawa') || u.email?.includes('yuki'))?.id,
    'Yuta': allUsers?.find(u => u.name?.includes('Yuta') || u.name?.includes('Ito') || u.email?.includes('yuta'))?.id,
    'Chikaki': allUsers?.find(u => u.name?.includes('Chikaki') || u.name?.includes('Kosuke') || u.email?.includes('chikaki'))?.id,
    'Mark': allUsers?.find(u => u.name?.includes('Mark') || u.name?.includes('Martirossian') || u.email?.includes('mark'))?.id,
    'Tsumura': allUsers?.find(u => u.name?.includes('Tsumura') || u.name?.includes('Kota') || u.email?.includes('tsumura'))?.id,
    'Sarah': allUsers?.find(u => u.name?.includes('Sarah') || u.email?.includes('sarah'))?.id,
  };

  console.log('\n📋 オーナーマッピング:');
  Object.entries(OWNER_MAP).forEach(([name, id]) => {
    console.log(`  ${name}: ${id || '⚠ 未マッチ (デフォルトユーザーを使用)'}`);
  });

  const resolveOwner = (name) => OWNER_MAP[name] || userId;

  // ===== Check existing data =====
  const { data: existingAccounts } = await sb.from('sales_accounts').select('id,name');
  const { data: existingDeals } = await sb.from('sales_deals').select('id,name');
  if (existingAccounts?.length > 0 || existingDeals?.length > 0) {
    console.log(`\n⚠ 既存データあり: 取引先 ${existingAccounts?.length || 0}件, 商談 ${existingDeals?.length || 0}件`);
    const confirm = await ask('既存データに追加インポートしますか？ (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('中止しました。');
      rl.close(); return;
    }
  }

  // ===== STEP 1: Import Accounts =====
  console.log('\n━━━ STEP 1: 取引先インポート ━━━');
  const accountsCsv = readFileSync(join(SF_DIR, 'clean_accounts.csv'), 'utf-8');
  const accountRows = csvToObjects(accountsCsv);
  console.log(`${accountRows.length}件の取引先を処理中...`);

  const accountIdMap = {}; // name → id
  let acctOk = 0, acctErr = 0;

  for (const row of accountRows) {
    if (!row.name) continue;
    // Check for duplicate
    const existing = existingAccounts?.find(a => a.name === row.name);
    if (existing) {
      accountIdMap[row.name] = existing.id;
      console.log(`  ⏭ ${row.name} (既存)`);
      continue;
    }
    const ins = {
      name: row.name,
      owner_id: resolveOwner(row.owner),
      country: row.country || null,
      address_billing: row.state || null,
      lead_source: row.source || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await sb.from('sales_accounts').insert(ins).select('id').single();
    if (error) {
      console.log(`  ❌ ${row.name}: ${error.message}`);
      acctErr++;
    } else {
      accountIdMap[row.name] = data.id;
      acctOk++;
    }
  }
  console.log(`✅ 取引先: ${acctOk}件追加, ${acctErr}件エラー\n`);

  // Also map existing accounts
  const { data: allAccounts } = await sb.from('sales_accounts').select('id,name');
  allAccounts?.forEach(a => { if (!accountIdMap[a.name]) accountIdMap[a.name] = a.id; });

  // ===== STEP 2: Import Contacts =====
  console.log('━━━ STEP 2: コンタクトインポート ━━━');
  const contactsCsv = readFileSync(join(SF_DIR, 'clean_contacts.csv'), 'utf-8');
  const contactRows = csvToObjects(contactsCsv);
  console.log(`${contactRows.length}件のコンタクトを処理中...`);

  let contOk = 0, contErr = 0;
  for (const row of contactRows) {
    if (!row.name) continue;
    const acctId = accountIdMap[row.account_name] || null;
    const ins = {
      name: row.name,
      role: row.role || null,
      account_id: acctId,
      email: row.email || null,
      phone: row.phone || null,
    };
    const { error } = await sb.from('sales_contacts').insert(ins);
    if (error) {
      console.log(`  ❌ ${row.name}: ${error.message}`);
      contErr++;
    } else {
      contOk++;
    }
  }
  console.log(`✅ コンタクト: ${contOk}件追加, ${contErr}件エラー\n`);

  // ===== STEP 3: Import Deals =====
  console.log('━━━ STEP 3: 商談インポート ━━━');
  const dealsCsv = readFileSync(join(SF_DIR, 'clean_deals.csv'), 'utf-8');
  const dealRows = csvToObjects(dealsCsv);
  console.log(`${dealRows.length}件の商談を処理中...`);

  let dealOk = 0, dealErr = 0;
  for (const row of dealRows) {
    const name = row.clean_name;
    if (!name) continue;
    const acctId = accountIdMap[row.account_name] || null;
    const amount = row.amount ? Number(row.amount) : null;
    const confidence = row.confidence ? Number(row.confidence) : 50;
    const prepay = row.prepayment_percent ? Number(row.prepayment_percent) : 0;
    const supPaid = row.supplier_paid === 'True' || row.supplier_paid === 'true';

    // Parse dates (YYYY/MM/DD → YYYY-MM-DD)
    const created = row.created_date ? row.created_date.replace(/\//g, '-') : null;
    const close = row.close_date ? row.close_date.replace(/\//g, '-') : null;

    const ins = {
      name,
      account_id: acctId,
      owner_id: resolveOwner(row.owner),
      stage: row.stage || 'negotiation',
      amount,
      confidence,
      shipping_type: row.shipping_type || null,
      prepayment_percent: prepay,
      payment_status: prepay >= 100 ? 'full' : prepay > 0 ? 'partial' : 'none',
      supplier_paid: supPaid,
      incoterms: row.incoterms || null,
      lead_source: row.source || null,
      notes: row.notes || null,
      deal_date: created,
      close_date: close,
      updated_at: new Date().toISOString(),
    };

    // Auto-set payment_confirmed_date for post/done phase deals
    const postStages = ['order_pending', 'order_completed', 'goods_received', 'shipped', 'closed'];
    if (postStages.includes(row.stage) && created) {
      ins.payment_confirmed_date = created;
    }

    const { error } = await sb.from('sales_deals').insert(ins);
    if (error) {
      console.log(`  ❌ ${name}: ${error.message}`);
      dealErr++;
    } else {
      dealOk++;
    }
  }
  console.log(`✅ 商談: ${dealOk}件追加, ${dealErr}件エラー\n`);

  // ===== Summary =====
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 インポート完了サマリー:');
  console.log(`  取引先: ${acctOk}件`);
  console.log(`  コンタクト: ${contOk}件`);
  console.log(`  商談: ${dealOk}件`);
  if (acctErr || contErr || dealErr) {
    console.log(`  ⚠ エラー: 取引先${acctErr}, コンタクト${contErr}, 商談${dealErr}`);
  }
  console.log('\nGS Salesアプリを再起動してデータを確認してください。');
  
  rl.close();
}

main().catch(e => { console.error('エラー:', e); rl.close(); });
