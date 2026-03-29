// ============================================
// GS Sales CRM - Deal Form Modal
// 新規商談 / 商談編集フォーム
// ============================================

import { useState, useEffect, useRef, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, AppUser, DealStage } from '@/types/database';
import { STAGES, SHIPPING, INCOTERMS_OPTIONS, T, countryToFlag, shortName } from '@/lib/constants';

interface DealFormProps {
  client: SupabaseClient;
  user: AppUser;
  accounts: Account[];
  deal: Deal | null;
  allUsers: AppUser[];
  deals: Deal[];
  onClose: () => void;
  onSaved: () => void;
}

export const DealForm = memo(function DealForm({
  client, user, accounts, deal, allUsers, deals, onClose, onSaved,
}: DealFormProps) {
  const isEdit = !!deal?.id;
  const [accountId, setAccountId] = useState(deal?.account_id || '');
  const [amount, setAmount] = useState(String(deal?.amount || ''));
  const [amountDisplay, setAmountDisplay] = useState(
    deal?.amount ? Number(deal.amount).toLocaleString() : '',
  );
  const [confidence, setConfidence] = useState(deal?.confidence || 50);
  const [shipping, setShipping] = useState<string>(deal?.shipping_type || '');
  const [incoterms, setIncoterms] = useState(deal?.incoterms || '');
  const [incotermsOther, setIncotermsOther] = useState('');
  const [notes, setNotes] = useState(deal?.notes || '');
  const [shippingDate, setShippingDate] = useState(deal?.shipping_date || '');
  const [stage, setStage] = useState<DealStage>(deal?.stage || 'new');
  const [ownerId, setOwnerId] = useState(deal?.owner_id || user.id);
  const [prepaymentPercent, setPrepaymentPercent] = useState(deal?.prepayment_percent || 0);
  const [paymentConfirmedDate, setPaymentConfirmedDate] = useState(deal?.payment_confirmed_date || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(deal?.spreadsheet_url || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [acctSearch, setAcctSearch] = useState(
    deal?.account_id ? accounts.find(a => a.id === deal.account_id)?.name || '' : '',
  );
  const [showAcctDropdown, setShowAcctDropdown] = useState(false);
  const acctDropdownRef = useRef<HTMLDivElement>(null);

  const filteredAccts = useMemo(
    () => accounts.filter(a => !acctSearch || a.name.toLowerCase().includes(acctSearch.toLowerCase())),
    [accounts, acctSearch],
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (acctDropdownRef.current && !acctDropdownRef.current.contains(e.target as Node)) {
        setShowAcctDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const I: React.CSSProperties = {
    width: '100%', border: `1px solid ${T.border}`, borderRadius: 5,
    padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  };
  const L: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3, marginTop: 8,
  };

  const handleAmountChange = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    setAmount(num);
    setAmountDisplay(num ? Number(num).toLocaleString() : '');
  };

  const save = async () => {
    if (!accountId) { setErr('取引先を選択してください'); return; }
    setSaving(true); setErr('');
    try {
      const acct = accounts.find(a => a.id === accountId);
      const finalIncoterms = incoterms === 'Other' ? incotermsOther : incoterms;

      if (isEdit && deal) {
        const updates: Record<string, unknown> = {
          account_id: accountId,
          amount: String(Number(amount) || 0),
          confidence: String(Number(confidence) || 50),
          shipping_type: shipping || null,
          incoterms: finalIncoterms || null,
          payment_status: Number(prepaymentPercent) >= 100 ? 'full' : Number(prepaymentPercent) > 0 ? 'partial' : 'none',
          notes,
          shipping_date: shippingDate || null,
          stage,
          owner_id: ownerId,
          prepayment_percent: String(Number(prepaymentPercent) || 0),
          payment_confirmed_date: paymentConfirmedDate || null,
          spreadsheet_url: spreadsheetUrl,
        };
        const { data: result, error: re } = await client.rpc('rpc_safe_update_deal', {
          p_deal_id: deal.id,
          p_expected_updated_at: deal.updated_at,
          p_updates: updates,
        });
        if (re) throw re;
        if (result && !result.success) {
          setErr(result.message || '他のユーザーが先に更新しています。');
          setSaving(false);
          return;
        }
        // 責任者変更時: 取引先+コンタクトも更新
        if (deal.owner_id !== ownerId && accountId) {
          await client.from('sales_contacts').update({ owner_id: ownerId }).eq('account_id', accountId);
          await client.from('sales_accounts').update({ owner_id: ownerId, updated_at: new Date().toISOString() }).eq('id', accountId);
        }
      } else {
        const now = new Date();
        const ym = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
        const existingCount = deals?.filter(d => d.account_id === accountId && d.name?.includes(ym)).length || 0;
        const seq = String(existingCount + 1).padStart(2, '0');
        const dealName = `${acct?.name || ''} ${ym}-${seq}`;
        const today = new Date().toISOString().split('T')[0];
        const { error: ie } = await client.from('sales_deals').insert({
          deal_number: 0,
          account_id: accountId,
          name: dealName,
          amount: Number(amount) || 0,
          confidence: Number(confidence) || 50,
          shipping_type: shipping || null,
          incoterms: finalIncoterms || null,
          stage: 'new',
          owner_id: user.id,
          created_by: user.id,
          deal_date: today,
          prepayment_percent: Number(prepaymentPercent) || 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (ie) throw ie;
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const stagePhase = STAGES.find(s => s.id === stage)?.phase;
  const isPostPhase = stagePhase === 'post' || stagePhase === 'done';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', width: '90%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: T.primary }}>
          {isEdit ? '商談を編集' : '新規商談'}
        </div>
        {!isEdit && (
          <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 8 }}>
            取引先を選ぶだけで基本情報が自動入力されます
          </div>
        )}

        {/* Account selector */}
        <label style={L}>取引先 *</label>
        <div ref={acctDropdownRef} style={{ position: 'relative' }}>
          <input
            type="text"
            value={acctSearch}
            onChange={e => {
              setAcctSearch(e.target.value);
              setShowAcctDropdown(true);
              if (!e.target.value) setAccountId('');
            }}
            onFocus={() => setShowAcctDropdown(true)}
            placeholder="取引先名を検索..."
            style={I}
          />
          {showAcctDropdown && filteredAccts.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: 180, overflowY: 'auto', background: '#fff', border: `1px solid ${T.border}`, borderRadius: 5, boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 10, marginTop: 2 }}>
              {filteredAccts.map(a => (
                <div
                  key={a.id}
                  onClick={() => {
                    setAccountId(a.id);
                    setAcctSearch(a.name);
                    setShowAcctDropdown(false);
                    if (!isEdit && a.owner_id) setOwnerId(a.owner_id);
                  }}
                  style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${T.borderLight}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <span>{countryToFlag(a.country)}</span>
                  <span style={{ fontWeight: accountId === a.id ? 700 : 400, color: T.primary }}>{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Amount */}
        <label style={L}>予想取引金額</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted }}>¥</span>
          <input type="text" value={amountDisplay} onChange={e => handleAmountChange(e.target.value)} placeholder="0" style={{ ...I, fontSize: 13, fontWeight: 600, paddingLeft: 20 }} />
        </div>

        {/* Confidence / Prepayment slider */}
        {isPostPhase ? (
          <>
            <label style={L}>入金状況</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <input type="range" min="0" max="100" step="10" value={prepaymentPercent} onChange={e => setPrepaymentPercent(Number(e.target.value))} style={{ flex: 1, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, minWidth: 30 }}>{prepaymentPercent}%</span>
            </div>
            <div style={{ width: '100%', height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: prepaymentPercent + '%', height: '100%', background: T.primary, transition: 'width .3s' }} />
            </div>
          </>
        ) : (
          <>
            <label style={L}>確度</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <input type="range" min="0" max="100" step="10" value={confidence} onChange={e => setConfidence(Number(e.target.value))} style={{ flex: 1, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, minWidth: 30 }}>{confidence}%</span>
            </div>
            <div style={{ width: '100%', height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: confidence + '%', height: '100%', background: T.primary, transition: 'width .3s' }} />
            </div>
          </>
        )}

        {/* Shipping type */}
        <label style={L}>配送種別（オプション）</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setShipping('')} style={{
            flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
            border: !shipping ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
            fontSize: 11, fontWeight: !shipping ? 700 : 400,
            background: !shipping ? T.primary + '10' : '#fff', color: !shipping ? T.primary : T.sub,
          }}>なし</button>
          {Object.entries(SHIPPING).map(([k, v]) => (
            <button key={k} onClick={() => setShipping(k)} style={{
              flex: 1, padding: '6px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
              border: shipping === k ? `2px solid ${v.color}` : `1px solid ${T.border}`,
              fontSize: 11, fontWeight: shipping === k ? 700 : 400,
              background: shipping === k ? v.color + '10' : '#fff', color: shipping === k ? v.color : T.sub,
            }}>{v.label}</button>
          ))}
        </div>

        {/* Incoterms */}
        <label style={L}>インコタームズ（オプション）</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button onClick={() => { setIncoterms(''); setIncotermsOther(''); }} style={{
            padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
            border: !incoterms ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
            fontSize: 11, fontWeight: !incoterms ? 700 : 400,
            background: !incoterms ? T.primary : '#fff', color: !incoterms ? '#fff' : T.sub,
          }}>なし</button>
          {INCOTERMS_OPTIONS.map(opt => (
            <button key={opt} onClick={() => { setIncoterms(opt); if (opt !== 'Other') setIncotermsOther(''); }} style={{
              padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
              border: incoterms === opt ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
              fontSize: 11, fontWeight: incoterms === opt ? 700 : 400,
              background: incoterms === opt ? T.primary : '#fff', color: incoterms === opt ? '#fff' : T.sub,
            }}>{opt}</button>
          ))}
        </div>
        {incoterms === 'Other' && (
          <input type="text" value={incotermsOther} onChange={e => setIncotermsOther(e.target.value)} placeholder="カスタムインコタームズ" style={{ ...I, marginTop: 4 }} />
        )}

        {/* Edit-only fields */}
        {isEdit && (
          <>
            <label style={L}>入金日</label>
            <input type="date" value={paymentConfirmedDate} onChange={e => setPaymentConfirmedDate(e.target.value)} style={I} />

            <label style={L}>配送日</label>
            <input type="date" value={shippingDate} onChange={e => setShippingDate(e.target.value)} style={I} />

            <label style={L}>ステージ</label>
            <select value={stage} onChange={e => setStage(e.target.value as DealStage)} style={{ ...I, background: '#fff' }}>
              {STAGES.map(s => (<option key={s.id} value={s.id}>{s.ja}</option>))}
            </select>

            <label style={L}>商談担当者</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={{ ...I, background: '#fff' }}>
              {(allUsers || []).map(u => (<option key={u.id} value={u.id}>{shortName(u)}</option>))}
            </select>

            <label style={L}>スプレッドシートURL</label>
            <input type="text" value={spreadsheetUrl} onChange={e => setSpreadsheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." style={I} />

            <label style={L}>メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="特記事項..." style={{ ...I, lineHeight: 1.4 }} />
          </>
        )}

        {err && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' }}>
            キャンセル
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '5px 14px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
            {saving ? '保存中...' : isEdit ? '更新' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
});
