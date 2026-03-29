// ============================================
// GS Sales CRM - Contact Detail View
// コンタクト詳細画面（2カラムレイアウト）
// ============================================

import { useState, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Contact, Deal, AppUser } from '@/types/database';
import { T, fmtYen, shortName, initial, countryToFlag } from '@/lib/constants';

interface ContactDetailProps {
  contact: Contact;
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  onBack: () => void;
  onUpdated: () => void;
  onEdit: () => void;
}

export const ContactDetail = memo(function ContactDetail({
  contact, accounts, contacts, deals, client, allUsers,
  onBack, onUpdated, onEdit,
}: ContactDetailProps) {
  const acct = accounts.find(a => a.id === contact.account_id);
  const owner = allUsers.find(u => u.id === contact.owner_id);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Related deals (same account)
  const relatedDeals = useMemo(
    () => contact.account_id ? deals.filter(d => d.account_id === contact.account_id) : [],
    [deals, contact.account_id],
  );

  // Other contacts at the same account
  const otherContacts = useMemo(
    () => contact.account_id ? contacts.filter(c => c.account_id === contact.account_id && c.id !== contact.id) : [],
    [contacts, contact.account_id, contact.id],
  );

  const deleteContact = async () => {
    try {
      await client.from('sales_contacts').delete().eq('id', contact.id);
      onUpdated();
      onBack();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Back + Title + Edit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>戻る
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, marginLeft: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e8e8e8', color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>
            {initial(contact.name)}
          </div>
          <div>
            <div style={{ fontSize: 9.5, color: T.muted }}>コンタクト</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>{contact.name}</div>
            {contact.role && <div style={{ fontSize: 11, color: T.sub }}>{contact.role}</div>}
          </div>
        </div>
        <button onClick={onEdit} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>編集</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Left: Contact Info */}
        <div style={{ width: 300, minWidth: 300, overflowY: 'auto' }}>
          {/* Basic Info */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 10 }}>連絡先情報</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '5px 6px', fontSize: 11.5 }}>
              <span style={{ color: T.muted }}>取引先</span>
              <span style={{ fontWeight: 500 }}>
                {acct ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {countryToFlag(acct.country)} {acct.name}
                  </span>
                ) : '-'}
              </span>

              <span style={{ color: T.muted }}>メール</span>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} style={{ color: T.accent, textDecoration: 'none' }}>{contact.email}</a>
              ) : <span>-</span>}

              <span style={{ color: T.muted }}>電話</span>
              {contact.phone ? (
                <a href={`tel:${contact.phone}`} style={{ color: T.accent, textDecoration: 'none' }}>{contact.phone}</a>
              ) : <span>-</span>}

              <span style={{ color: T.muted }}>WhatsApp</span>
              {contact.whatsapp ? (
                <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>{contact.whatsapp}</a>
              ) : <span>-</span>}

              <span style={{ color: T.muted }}>LinkedIn</span>
              {contact.linkedin ? (
                <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.linkedin}</a>
              ) : <span>-</span>}

              <span style={{ color: T.muted }}>GS責任者</span>
              <span>{shortName(owner)}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>クイックアクション</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {contact.email && (
                <a href={`mailto:${contact.email}`} style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: T.accent + '15', color: T.accent, textDecoration: 'none' }}>
                  メール送信
                </a>
              )}
              {contact.whatsapp && (
                <a href={`https://wa.me/${contact.whatsapp.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: '#25d36615', color: '#25d366', textDecoration: 'none' }}>
                  WhatsApp
                </a>
              )}
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: '#0077b515', color: '#0077b5', textDecoration: 'none' }}>
                  LinkedIn
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} style={{ padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, background: T.green + '15', color: T.green, textDecoration: 'none' }}>
                  電話
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Related deals + Other contacts */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Related deals */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>関連商談 ({relatedDeals.length})</div>
            {relatedDeals.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: 9.5, color: T.muted }}>{d.stage}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, flexShrink: 0 }}>{fmtYen(d.amount)}</span>
              </div>
            ))}
            {relatedDeals.length === 0 && <div style={{ fontSize: 11, color: '#ccc' }}>関連商談なし</div>}
          </div>

          {/* Other contacts at same company */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>同じ取引先のコンタクト ({otherContacts.length})</div>
            {otherContacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, background: '#e8e8e8', color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {initial(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: T.muted }}>{[c.role, c.email].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
            {otherContacts.length === 0 && <div style={{ fontSize: 11, color: '#ccc' }}>他のコンタクトなし</div>}
          </div>
        </div>
      </div>

      {/* Delete button */}
      <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{ fontSize: 10.5, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            削除
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: T.primary }}>本当に削除しますか？</span>
            <button onClick={deleteContact} style={{ padding: '3px 8px', borderRadius: 3, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.red, color: '#fff', fontFamily: 'inherit' }}>削除する</button>
            <button onClick={() => setDeleteConfirm(false)} style={{ padding: '3px 8px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  );
});
