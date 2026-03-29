import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, AppUser, Account } from '@/types/database';
import { T, STAGES, SHIPPING, shortName, getModalContainerStyle } from '@/lib/constants';

interface Props {
  categories: Category[];
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  onClose: () => void;
  onUpdated: () => void;
  onOpenSupabaseSettings?: () => void;
  businesses: { id: string; label: string; color: string }[];
  onBusinessUpdated?: () => void;
  currentBiz?: string;
}

export function SettingsManager({ client, allUsers, accounts, onClose, onOpenSupabaseSettings, businesses }: Props) {
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [newExpCat, setNewExpCat] = useState('');
  const [showExpCatAdd, setShowExpCatAdd] = useState(false);

  // OCR設定
  const [ocrApiKey, setOcrApiKey] = useState('');
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ocrSaving, setOcrSaving] = useState(false);
  const [ocrMsg, setOcrMsg] = useState('');

  // Notion連携設定
  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('1c754070-f94f-440a-99b8-7e26ebc0560f');
  const [notionSaving, setNotionSaving] = useState(false);
  const [notionMsg, setNotionMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: cs } = await client.from('company_settings').select('*').eq('key', 'expense_categories');
        if (cs && cs.length > 0) {
          try { setExpenseCategories(JSON.parse(cs[0].value)); } catch { /* ignore */ }
        } else {
          setExpenseCategories(['BtoB', 'Amazon', 'Shopee', 'KG', '雑費', '会議費・交際費', '交通費', '送料・物流費', 'その他']);
        }
        const { data: ocrData } = await client.from('company_settings').select('*').eq('key', 'receipt_ocr_config');
        if (ocrData && ocrData[0]) {
          try { const cfg = JSON.parse(ocrData[0].value); setOcrApiKey(cfg.api_key || ''); setOcrEnabled(!!cfg.enabled); } catch { /* ignore */ }
        }
      } catch (ex) { console.error('SettingsManager init error:', ex); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await client.from('company_settings').select('*').eq('key', 'notion_config').limit(1);
      if (data && data[0]) {
        try { const cfg = JSON.parse(data[0].value); setNotionToken(cfg.token || ''); setNotionDbId(cfg.database_id || '1c754070-f94f-440a-99b8-7e26ebc0560f'); } catch { /* ignore */ }
      }
    })();
  }, []);

  const saveExpCat = async (cats: string[]) => {
    const val = JSON.stringify(cats);
    const { data: existing } = await client.from('company_settings').select('id').eq('key', 'expense_categories').limit(1);
    if (existing && existing.length > 0) { await client.from('company_settings').update({ value: val }).eq('id', existing[0].id); }
    else { await client.from('company_settings').insert({ key: 'expense_categories', value: val }); }
  };

  const saveOcrConfig = async () => {
    setOcrSaving(true); setOcrMsg('');
    try {
      const val = JSON.stringify({ api_key: ocrApiKey.trim(), enabled: ocrEnabled });
      const { data: existing } = await client.from('company_settings').select('id').eq('key', 'receipt_ocr_config').limit(1);
      if (existing && existing.length > 0) { await client.from('company_settings').update({ value: val }).eq('id', existing[0].id); }
      else { await client.from('company_settings').insert({ key: 'receipt_ocr_config', value: val }); }
      setOcrMsg('保存しました'); setTimeout(() => setOcrMsg(''), 2000);
    } catch (e: any) { setOcrMsg('保存エラー: ' + e.message); } finally { setOcrSaving(false); }
  };

  const saveNotionConfig = async () => {
    setNotionSaving(true); setNotionMsg('');
    try {
      const val = JSON.stringify({ token: notionToken.trim(), database_id: notionDbId.trim() });
      const { data: existing } = await client.from('company_settings').select('id').eq('key', 'notion_config').limit(1);
      if (existing && existing.length > 0) { await client.from('company_settings').update({ value: val }).eq('id', existing[0].id); }
      else { await client.from('company_settings').insert({ key: 'notion_config', value: val }); }
      setNotionMsg('保存しました'); setTimeout(() => setNotionMsg(''), 2000);
    } catch (e: any) { setNotionMsg('保存エラー: ' + e.message); } finally { setNotionSaving(false); }
  };

  const handleCSVExport = async (type: string) => {
    let csvContent = '';
    if (type === 'deals') {
      csvContent = '商談名,取引先,責任者,ステージ,金額,入金日,商談開始日,配送種別,インコタームズ,前払い%,メモ\n';
      const { data: allDeals } = await client.from('sales_deals').select('*');
      (allDeals || []).forEach((d: any) => {
        const acct = (accounts || []).find(a => a.id === d.account_id);
        const owner = (allUsers || []).find(u => u.id === d.owner_id);
        const st = STAGES.find(s => s.id === d.stage);
        csvContent += `"${(d.name || '').replace(/"/g, '""')}","${acct?.name || ''}","${shortName(owner)}","${st?.ja || d.stage}",${d.amount || 0},"${d.payment_confirmed_date || ''}","${d.deal_date || ''}","${SHIPPING[d.shipping_type as keyof typeof SHIPPING]?.label || ''}","${d.incoterms || ''}",${d.prepayment_percent || 0},"${(d.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"\n`;
      });
    } else if (type === 'accounts') {
      csvContent = '会社名,国,GS責任者,流入経路,入金ターム,Webサイト,請求先住所\n';
      (accounts || []).forEach(a => {
        const owner = (allUsers || []).find(u => u.id === a.owner_id);
        csvContent += `"${(a.name || '').replace(/"/g, '""')}","${a.country || ''}","${shortName(owner)}","${a.lead_source || ''}","${a.payment_terms || ''}","${a.website || ''}","${(a.address_billing || '').replace(/"/g, '""')}"\n`;
      });
    } else {
      csvContent = '氏名,役職,取引先,GS責任者,メール,電話,WhatsApp,LinkedIn\n';
      const { data: allContacts } = await client.from('sales_contacts').select('*');
      (allContacts || []).forEach((c: any) => {
        const acct = (accounts || []).find(a => a.id === c.account_id);
        const owner = (allUsers || []).find(u => u.id === c.owner_id);
        csvContent += `"${(c.name || '').replace(/"/g, '""')}","${c.role || ''}","${acct?.name || ''}","${shortName(owner)}","${c.email || ''}","${c.phone || ''}","${c.whatsapp || ''}","${c.linkedin || ''}"\n`;
      });
    }
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `gs-sales-${type}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const I: React.CSSProperties = { width: '100%', border: `1px solid ${T.border}`, borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', ...getModalContainerStyle(), padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,.12)', overflowY: 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.primary }}>設定</div>

        {/* CSVエクスポート */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary, marginBottom: 8 }}>CSVエクスポート</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {[{ id: 'deals', label: '商談' }, { id: 'accounts', label: '取引先' }, { id: 'contacts', label: 'コンタクト' }].map(t => (
              <button key={t.id} onClick={() => handleCSVExport(t.id)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 経費カテゴリ管理 */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary, marginBottom: 8 }}>経費カテゴリ管理</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
            {expenseCategories.map((ec, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#fafafa', borderRadius: 6, border: `1px solid ${T.borderLight}` }}>
                <span style={{ fontSize: 11, color: T.primary }}>{ec}</span>
                <button onClick={async () => { const nc = expenseCategories.filter(x => x !== ec); setExpenseCategories(nc); await saveExpCat(nc); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, padding: 0, lineHeight: 1 }}>x</button>
              </div>
            ))}
          </div>
          {showExpCatAdd ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input value={newExpCat} onChange={e => setNewExpCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newExpCat.trim()) { const nc = [...expenseCategories.filter(x => x !== 'その他'), newExpCat.trim(), 'その他']; setExpenseCategories(nc); saveExpCat(nc); setNewExpCat(''); setShowExpCatAdd(false); } }} placeholder="新規カテゴリ名" style={{ ...I, flex: 1 }} />
              <button onClick={async () => { if (newExpCat.trim()) { const nc = [...expenseCategories.filter(x => x !== 'その他'), newExpCat.trim(), 'その他']; setExpenseCategories(nc); await saveExpCat(nc); setNewExpCat(''); setShowExpCatAdd(false); } }} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>追加</button>
              <button onClick={() => setShowExpCatAdd(false)} style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 11, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>x</button>
            </div>
          ) : (
            <button onClick={() => setShowExpCatAdd(true)} style={{ padding: '4px 10px', borderRadius: 5, border: `1px dashed ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.accent, fontFamily: 'inherit' }}>+ カテゴリを追加</button>
          )}
        </div>

        {/* デフォルトフィルター */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary, marginBottom: 8 }}>デフォルトフィルター</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: T.sub }}>
            <input type="checkbox" checked={(() => { try { return localStorage.getItem('gs_default_owner_filter') === 'me'; } catch { return false; } })()} onChange={e => { try { localStorage.setItem('gs_default_owner_filter', e.target.checked ? 'me' : 'all'); } catch { /* ignore */ } onClose(); setTimeout(() => location.reload(), 100); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            デフォルトで自分が責任者のフィルターを適用
          </label>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>有効にすると商談・取引先・コンタクト・リードの初期表示フィルターが自分に設定されます</div>
        </div>

        {/* デフォルト事業 */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary, marginBottom: 8 }}>デフォルト事業</div>
          <select value={(() => { try { return localStorage.getItem('gs_default_business') || 'jbeauty'; } catch { return 'jbeauty'; } })()} onChange={e => { try { localStorage.setItem('gs_default_business', e.target.value); } catch { /* ignore */ } onClose(); setTimeout(() => location.reload(), 100); }} style={{ width: '100%', padding: '6px 10px', borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
            {(businesses || []).map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>ログイン時に最初に表示される事業を選択できます</div>
        </div>

        {/* レシートOCR設定 */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary }}>レシート自動読取（AI-OCR）</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="checkbox" checked={ocrEnabled} onChange={e => setOcrEnabled(e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
              <span style={{ fontSize: 10.5, color: ocrEnabled ? T.primary : T.muted, fontWeight: 600 }}>{ocrEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>レシート画像を添付するとClaude AIが自動入力します。</div>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3 }}>Anthropic APIキー</label>
          <input type="password" value={ocrApiKey} onChange={e => setOcrApiKey(e.target.value)} placeholder="sk-ant-api03-..." style={{ ...I, marginBottom: 6 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={saveOcrConfig} disabled={ocrSaving} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: ocrSaving ? 0.5 : 1 }}>{ocrSaving ? '保存中...' : 'OCR設定を保存'}</button>
            {ocrMsg && <span style={{ fontSize: 10.5, color: ocrMsg.includes('エラー') ? T.red : T.primary, fontWeight: 600 }}>{ocrMsg}</span>}
          </div>
        </div>

        {/* Notion連携設定 */}
        <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: T.primary, marginBottom: 8 }}>Notion連携（全員タスク）</div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.sub, display: 'block', marginBottom: 3 }}>Notion Internal Integration Token</label>
          <input type="password" value={notionToken} onChange={e => setNotionToken(e.target.value)} placeholder="ntn_..." style={{ ...I, marginBottom: 6 }} />
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.sub, display: 'block', marginBottom: 3 }}>Database ID</label>
          <input value={notionDbId} onChange={e => setNotionDbId(e.target.value)} placeholder="1c754070-f94f-440a-99b8-7e26ebc0560f" style={{ ...I, marginBottom: 6 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={saveNotionConfig} disabled={notionSaving} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: notionSaving ? 0.5 : 1 }}>{notionSaving ? '保存中...' : 'Notion設定を保存'}</button>
            {notionMsg && <span style={{ fontSize: 10.5, color: notionMsg.includes('エラー') ? T.red : T.primary, fontWeight: 600 }}>{notionMsg}</span>}
          </div>
        </div>

        {onOpenSupabaseSettings && (
          <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 12 }}>
            <button onClick={onOpenSupabaseSettings} style={{ width: '100%', padding: '6px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: T.primary, fontFamily: 'inherit' }}>Supabase設定を開く</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
