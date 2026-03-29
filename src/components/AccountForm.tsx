// ============================================
// GS Sales CRM - Account Form Modal
// 新規取引先 / 取引先編集フォーム
// ============================================

import { useState, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, AppUser, Category } from '@/types/database';
import { LEAD_SOURCES, T, shortName } from '@/lib/constants';

interface AccountFormProps {
  client: SupabaseClient;
  user: AppUser;
  account: Account | null;
  accounts: Account[];
  categories: Category[];
  allUsers: AppUser[];
  onClose: () => void;
  onSaved: () => void;
}

const PAY_PRESETS = ['前払い100%', '前払い50%', '前払い30%'] as const;

export const AccountForm = memo(function AccountForm({
  client, user, account, accounts: existingAccounts, categories, allUsers, onClose, onSaved,
}: AccountFormProps) {
  const isEdit = !!account?.id;
  const [name, setName] = useState(account?.name || '');
  const [website, setWebsite] = useState(account?.website || '');
  const [country, setCountry] = useState(account?.country || '');
  const [addrBill, setAddrBill] = useState(account?.address_billing || '');
  const [shippingAddrs, setShippingAddrs] = useState<string[]>(() => {
    const as = account?.address_shipping;
    if (Array.isArray(as)) return as;
    if (typeof as === 'string' && as) return [as];
    return [];
  });

  const initPT = account?.payment_terms || '';
  const [payTermsMode, setPayTermsMode] = useState(
    (PAY_PRESETS as readonly string[]).includes(initPT) ? initPT : initPT ? 'other' : '',
  );
  const [payTermsCustom, setPayTermsCustom] = useState(
    (PAY_PRESETS as readonly string[]).includes(initPT) ? '' : initPT,
  );
  const payTerms = payTermsMode === 'other' ? payTermsCustom : payTermsMode;

  const [notes, setNotes] = useState(account?.notes || '');
  const [categoryIds, setCategoryIds] = useState<string[]>(account?.category_ids || []);
  const [ownerId, setOwnerId] = useState(account?.owner_id || user.id);
  const [leadSource, setLeadSource] = useState(account?.lead_source || '');
  const [leadSourceOther, setLeadSourceOther] = useState(
    account?.lead_source && !['JBW', 'LinkedIn', 'WhatsApp', 'メール'].includes(account.lead_source)
      ? account.lead_source
      : '',
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const I: React.CSSProperties = {
    width: '100%', border: `1px solid ${T.border}`, borderRadius: 5,
    padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  };
  const L: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3, marginTop: 8,
  };

  const toggleCategory = (catId: string) => {
    setCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId],
    );
  };

  const removeShippingAddr = (idx: number) => {
    setShippingAddrs(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (!name.trim()) { setErr('会社名を入力'); return; }
    if (!isEdit && existingAccounts) {
      const dup = existingAccounts.find(
        a => a.name.toLowerCase().trim() === name.trim().toLowerCase(),
      );
      if (dup && !confirm(`「${dup.name}」は既に登録されています。それでも追加しますか？`)) return;
    }
    setSaving(true); setErr('');
    try {
      const finalLeadSource = leadSource === 'その他' ? leadSourceOther : leadSource;
      const row: Record<string, unknown> = {
        name: name.trim(),
        website: website || null,
        country: country || null,
        address_billing: addrBill || null,
        address_shipping: shippingAddrs.length > 0 ? shippingAddrs : null,
        payment_terms: payTerms || null,
        notes: notes || null,
        category_ids: categoryIds.length > 0 ? categoryIds : null,
        owner_id: ownerId || null,
        lead_source: finalLeadSource || null,
      };
      if (isEdit && account) {
        const { data: result, error: re } = await client.rpc('rpc_safe_update_account', {
          p_account_id: account.id,
          p_expected_updated_at: account.updated_at,
          p_updates: row,
        });
        if (re) throw re;
        if (result && !result.success) {
          setErr(result.message || '他のユーザーが先に更新しています。');
          setSaving(false);
          return;
        }
      } else {
        row.created_by = user.id;
        const { error: ie } = await client.from('sales_accounts').insert(row);
        if (ie) throw ie;
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', width: '90%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.primary }}>
          {isEdit ? '取引先を編集' : '新規取引先'}
        </div>

        <label style={L}>会社名 *</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Sleek Shop" style={I} />

        <label style={L}>国</label>
        <input value={country} onChange={e => setCountry(e.target.value)} placeholder="例: Japan, USA" style={I} />

        <label style={L}>Webサイト</label>
        <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." style={I} />

        <label style={L}>住所（請求先）</label>
        <input value={addrBill} onChange={e => setAddrBill(e.target.value)} placeholder="14251 Chambers Rd, Tustin CA" style={I} />

        {/* Shipping addresses (multiple) */}
        <label style={L}>納入先住所</label>
        <div style={{ marginBottom: 8 }}>
          {shippingAddrs.map((addr, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <input
                value={addr}
                onChange={e => {
                  const newAddrs = [...shippingAddrs];
                  newAddrs[idx] = e.target.value;
                  setShippingAddrs(newAddrs);
                }}
                style={{ ...I, flex: 1 }}
                placeholder="住所"
              />
              <button onClick={() => removeShippingAddr(idx)} style={{ padding: '5px 8px', borderRadius: 4, border: `1px solid ${T.border}`, background: '#fff', color: T.red, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 11 }}>
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setShippingAddrs([...shippingAddrs, ''])}
            style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${T.border}`, background: '#fff', color: T.accent, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600, width: '100%' }}
          >
            + 追加
          </button>
        </div>

        {/* Payment terms */}
        <label style={L}>入金ターム</label>
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          {PAY_PRESETS.map(pt => (
            <button
              key={pt}
              onClick={() => { setPayTermsMode(pt); setPayTermsCustom(''); }}
              style={{
                padding: '4px 8px', borderRadius: 10, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit',
                border: payTermsMode === pt ? 'none' : `1px solid ${T.border}`,
                fontWeight: payTermsMode === pt ? 600 : 400,
                background: payTermsMode === pt ? T.primary : '#fff',
                color: payTermsMode === pt ? '#fff' : T.sub,
              }}
            >
              {pt}
            </button>
          ))}
          <button
            onClick={() => setPayTermsMode('other')}
            style={{
              padding: '4px 8px', borderRadius: 10, fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit',
              border: payTermsMode === 'other' ? 'none' : `1px solid ${T.border}`,
              fontWeight: payTermsMode === 'other' ? 600 : 400,
              background: payTermsMode === 'other' ? T.primary : '#fff',
              color: payTermsMode === 'other' ? '#fff' : T.sub,
            }}
          >
            その他
          </button>
        </div>
        {payTermsMode === 'other' && (
          <input value={payTermsCustom} onChange={e => setPayTermsCustom(e.target.value)} placeholder="カスタム入金条件..." style={{ ...I, marginTop: 4 }} />
        )}

        {/* Categories */}
        <label style={L}>カテゴリ</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              style={{
                padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                border: categoryIds.includes(cat.id) ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                fontWeight: categoryIds.includes(cat.id) ? 600 : 400,
                background: categoryIds.includes(cat.id) ? T.primary : '#fff',
                color: categoryIds.includes(cat.id) ? '#fff' : T.sub,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Lead source */}
        <label style={L}>流入経路</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {LEAD_SOURCES.map(ls => (
            <button
              key={ls}
              onClick={() => { setLeadSource(ls); if (ls !== 'その他') setLeadSourceOther(''); }}
              style={{
                padding: '5px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                border: leadSource === ls ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
                fontWeight: leadSource === ls ? 700 : 400,
                background: leadSource === ls ? T.primary : '#fff',
                color: leadSource === ls ? '#fff' : T.sub,
              }}
            >
              {ls}
            </button>
          ))}
        </div>
        {leadSource === 'その他' && (
          <input type="text" value={leadSourceOther} onChange={e => setLeadSourceOther(e.target.value)} placeholder="その他の流入経路..." style={{ ...I, marginTop: 4 }} />
        )}

        {/* Owner */}
        <label style={L}>GS責任者</label>
        <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ ...I, background: '#fff' }}>
          {(allUsers || []).map(u => (
            <option key={u.id} value={u.id}>{shortName(u)}</option>
          ))}
        </select>

        {/* Notes */}
        <label style={L}>メモ</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="特記事項..." style={{ ...I, lineHeight: 1.4 }} />

        {err && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' }}>
            キャンセル
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '5px 14px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
            {saving ? '...' : isEdit ? '更新' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
});
