// ============================================
// GS Sales CRM - Contact Form Modal
// 新規コンタクト / コンタクト編集フォーム
// ============================================

import { useState, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Contact, AppUser } from '@/types/database';
import { T } from '@/lib/constants';

interface ContactFormProps {
  client: SupabaseClient;
  user: AppUser;
  accounts: Account[];
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}

/** LinkedIn URL正規化 */
function normLinkedIn(v: string | null): string {
  if (!v) return '';
  const s = v.trim();
  if (s.startsWith('http')) return s;
  if (s.startsWith('linkedin.com')) return 'https://' + s;
  if (s.startsWith('www.linkedin.com')) return 'https://' + s;
  return 'https://linkedin.com/in/' + s.replace(/^@/, '');
}

/** 電話番号フォーマット（簡易版） */
function fmtPhone(val: string, _country: string): string {
  // 基本的なクリーンアップ
  return val.replace(/[^\d+\-() ]/g, '').trim();
}

export const ContactForm = memo(function ContactForm({
  client, accounts, contact, onClose, onSaved,
}: ContactFormProps) {
  const isEdit = !!contact?.id;
  const [accountId, setAccountId] = useState(contact?.account_id || '');
  const [cName, setCName] = useState(contact?.name || '');
  const [cRole, setCRole] = useState(contact?.role || '');
  const [cEmail, setCEmail] = useState(contact?.email || '');
  const [cPhone, setCPhone] = useState(contact?.phone || '');
  const [cWhatsapp, setCWhatsapp] = useState(contact?.whatsapp || '');
  const [cLinkedin, setCLinkedin] = useState(contact?.linkedin || '');
  const [cNotes, setCNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const I: React.CSSProperties = {
    width: '100%', border: `1px solid ${T.border}`, borderRadius: 5,
    padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  };
  const L: React.CSSProperties = {
    display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3, marginTop: 8,
  };

  const selAcct = accounts.find(a => a.id === accountId);
  const acctCountry = selAcct?.country || '';

  const autoFmtPhone = (val: string, setter: (v: string) => void) => {
    const f = fmtPhone(val, acctCountry);
    if (f && f !== val) setter(f);
  };

  const copyPhoneToWA = () => {
    if (cPhone && !cWhatsapp) setCWhatsapp(cPhone);
  };

  const save = async () => {
    if (!cName.trim()) { setErr('氏名を入力してください'); return; }
    if (!accountId) { setErr('取引先を選択してください'); return; }
    setSaving(true); setErr('');

    const fPhone = cPhone ? fmtPhone(cPhone, acctCountry) : null;
    const fWhatsapp = cWhatsapp ? fmtPhone(cWhatsapp, acctCountry) : null;
    const fLinkedin = cLinkedin ? normLinkedIn(cLinkedin) : null;

    const row: Record<string, unknown> = {
      account_id: accountId || null,
      name: cName.trim(),
      role: cRole || null,
      email: cEmail || null,
      phone: fPhone || null,
      whatsapp: fWhatsapp || null,
      linkedin: fLinkedin || null,
    };
    if (cNotes) row.notes = cNotes;
    if (selAcct?.owner_id) row.owner_id = selAcct.owner_id;

    try {
      if (isEdit && contact) {
        const { error: ue } = await client.from('sales_contacts').update(row).eq('id', contact.id);
        if (ue) {
          // カラム不存在時のフォールバック
          if (ue.message?.includes('owner_id')) { delete row.owner_id; }
          if (ue.message?.includes('notes')) { delete row.notes; }
          const { error: ue2 } = await client.from('sales_contacts').update(row).eq('id', contact.id);
          if (ue2) throw ue2;
        }
      } else {
        const { error: ie } = await client.from('sales_contacts').insert(row);
        if (ie) {
          if (ie.message?.includes('owner_id')) { delete row.owner_id; }
          if (ie.message?.includes('notes')) { delete row.notes; }
          const { error: ie2 } = await client.from('sales_contacts').insert(row);
          if (ie2) throw ie2;
        }
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
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', width: '90%', maxWidth: 400, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.primary }}>
          {isEdit ? 'コンタクトを編集' : '新規コンタクト'}
        </div>

        <label style={L}>取引先 *</label>
        <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...I, background: '#fff' }}>
          <option value="">選択してください</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <label style={L}>氏名 *</label>
        <input value={cName} onChange={e => setCName(e.target.value)} placeholder="山田太郎" style={I} />

        <label style={L}>役職</label>
        <input value={cRole} onChange={e => setCRole(e.target.value)} placeholder="CEO, 購買担当 etc." style={I} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={L}>メール</label>
            <input value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder="info@..." style={I} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={L}>電話</label>
            <input
              value={cPhone}
              onChange={e => setCPhone(e.target.value)}
              onBlur={() => autoFmtPhone(cPhone, setCPhone)}
              placeholder="+1 234..."
              style={I}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={L}>WhatsApp</label>
            <input
              value={cWhatsapp}
              onChange={e => setCWhatsapp(e.target.value)}
              onBlur={() => autoFmtPhone(cWhatsapp, setCWhatsapp)}
              placeholder="+1 234..."
              style={I}
            />
          </div>
          {cPhone && !cWhatsapp && (
            <button
              onClick={copyPhoneToWA}
              style={{ padding: '4px 6px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 9, cursor: 'pointer', background: T.bg, color: T.sub, fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: 1 }}
              title="電話番号をWhatsAppにコピー"
            >
              ← 電話と同じ
            </button>
          )}
          <div style={{ flex: 1 }}>
            <label style={L}>LinkedIn</label>
            <input value={cLinkedin} onChange={e => setCLinkedin(e.target.value)} placeholder="ユーザー名 or URL" style={I} />
          </div>
        </div>

        <label style={L}>メモ/備考</label>
        <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} placeholder="連絡時の注意点、紹介経緯など..." rows={2} style={{ ...I, resize: 'vertical' }} />

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
