require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('\n━━━ 商談名一括更新: 会社名 YYMM-01 形式 ━━━\n');

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Fetch all deals with account info
  const { data: deals, error: de } = await sb.from('sales_deals').select('id,name,account_id,deal_date,created_at').order('deal_date', { ascending: true });
  if (de) { console.error('❌ 商談取得エラー:', de.message); return; }

  const { data: accounts } = await sb.from('sales_accounts').select('id,name');
  const acctMap = {};
  (accounts || []).forEach(a => { acctMap[a.id] = a.name; });

  console.log('商談: ' + deals.length + '件, 取引先: ' + accounts.length + '件\n');

  // Group by account + YYMM for sequential numbering
  const counters = {}; // "accountId_YYMM" → count
  let updated = 0, errors = 0;

  // Sort deals by date to ensure consistent numbering
  deals.sort((a, b) => {
    const da = a.deal_date || a.created_at || '';
    const db = b.deal_date || b.created_at || '';
    return da.localeCompare(db);
  });

  for (const deal of deals) {
    const acctName = acctMap[deal.account_id] || '';
    if (!acctName) {
      console.log('  ⏭ ' + deal.name + ' (取引先なし)');
      continue;
    }

    // Get YYMM from deal_date or created_at
    const dateStr = deal.deal_date || deal.created_at || '';
    let ym = '';
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        ym = String(d.getFullYear()).slice(-2) + String(d.getMonth() + 1).padStart(2, '0');
      }
    }

    if (!ym) {
      console.log('  ⏭ ' + deal.name + ' (日付なし)');
      continue;
    }

    const key = deal.account_id + '_' + ym;
    counters[key] = (counters[key] || 0) + 1;
    const seq = String(counters[key]).padStart(2, '0');
    const newName = acctName + ' ' + ym + '-' + seq;

    if (deal.name === newName) {
      continue; // Already correct
    }

    const { error } = await sb.from('sales_deals').update({ name: newName, updated_at: new Date().toISOString() }).eq('id', deal.id);
    if (error) {
      console.log('  ❌ ' + deal.name + ' → ' + newName + ': ' + error.message);
      errors++;
    } else {
      console.log('  ✓ ' + deal.name + ' → ' + newName);
      updated++;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 更新: ' + updated + '件, エラー: ' + errors + '件');
  console.log('GS Salesアプリを再起動してください。');
}

main().catch(e => console.error('エラー:', e.message));
