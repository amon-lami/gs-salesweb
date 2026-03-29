// ============================================
// GS Sales CRM - Contact Page
// コンタクト一覧（テーブル+詳細切替）
// ============================================

import { useState, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Contact, Deal, AppUser } from '@/types/database';
import { T, shortName, initial, countryToFlag } from '@/lib/constants';
import { ContactForm } from './ContactForm';
import { ContactDetail } from './ContactDetail';

interface ContactPageProps {
  contacts: Contact[];
  accounts: Account[];
  deals: Deal[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
  onReload: () => void;
}

export const ContactPage = memo(function ContactPage({
  contacts, accounts, deals, allUsers, client, user, onReload,
}: ContactPageProps) {
  const [search, setSearch] = useState('');
  const [acctFilter, setAcctFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);

  // Filtered contacts
  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.role || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q),
      );
    }
    if (acctFilter) list = list.filter(c => c.account_id === acctFilter);
    return list;
  }, [contacts, search, acctFilter]);

  // Sorted by name
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [filtered],
  );

  // Detail view
  if (detailContact) {
    const fresh = contacts.find(c => c.id === detailContact.id) || detailContact;
    return (
      <ContactDetail
        contact={fresh}
        accounts={accounts}
        contacts={contacts}
        deals={deals}
        client={client}
        user={user}
        allUsers={allUsers}
        onBack={() => setDetailContact(null)}
        onUpdated={onReload}
        onEdit={() => { setEditContact(fresh); setShowForm(true); }}
      />
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: '8px 14px', borderBottom: `1px solid ${T.border}`, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="氏名・役職・メールで検索..."
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 11, background: T.card, color: T.primary, fontFamily: 'inherit', width: 200 }}
          />
          <select value={acctFilter} onChange={e => setAcctFilter(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: T.card, color: T.primary, fontFamily: 'inherit' }}>
            <option value="">全取引先</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>
            コンタクト一覧 ({filtered.length})
          </span>
          <button
            onClick={() => { setEditContact(null); setShowForm(true); }}
            style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}
          >
            + 新規コンタクト
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>氏名</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>役職</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>取引先</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>GS責任者</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>メール</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>電話</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>WhatsApp</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>LinkedIn</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => {
              const acct = accounts.find(a => a.id === c.account_id);
              const ownerUser = allUsers.find(u => u.id === c.owner_id);
              return (
                <tr
                  key={c.id}
                  style={{ borderBottom: `1px solid ${T.borderLight}`, cursor: 'pointer' }}
                  onClick={() => setDetailContact(c)}
                  onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '7px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: '#e8e8e8', color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                        {initial(c.name)}
                      </div>
                      <span style={{ fontWeight: 600, color: T.primary }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '7px 8px', color: T.sub, fontSize: 11 }}>{c.role || '-'}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11 }}>
                    {acct ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 12 }}>{countryToFlag(acct.country)}</span>
                        <span style={{ color: T.primary }}>{acct.name}</span>
                      </span>
                    ) : <span style={{ color: T.muted }}>-</span>}
                  </td>
                  <td style={{ padding: '7px 8px', color: T.sub, fontSize: 11 }}>{shortName(ownerUser)}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11 }}>
                    {c.email ? (
                      <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} style={{ color: T.accent, textDecoration: 'none' }}>{c.email}</a>
                    ) : <span style={{ color: T.muted }}>-</span>}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11, color: T.sub }}>{c.phone || '-'}</td>
                  <td style={{ padding: '7px 8px', fontSize: 11 }}>
                    {c.whatsapp ? (
                      <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9+]/g, '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ color: '#25d366', textDecoration: 'none' }}>{c.whatsapp}</a>
                    ) : <span style={{ color: T.muted }}>-</span>}
                  </td>
                  <td style={{ padding: '7px 8px', fontSize: 11 }}>
                    {c.linkedin ? (
                      <a href={c.linkedin} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" style={{ color: '#0077b5', textDecoration: 'none' }}>View</a>
                    ) : <span style={{ color: T.muted }}>-</span>}
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <button
                      onClick={e => { e.stopPropagation(); setEditContact(c); setShowForm(true); }}
                      style={{ padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 9.5, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}
                    >
                      編集
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${T.border}`, background: '#f9f9f9' }}>
              <td colSpan={9} style={{ padding: 8, fontSize: 11, fontWeight: 700, color: T.primary }}>
                合計 {sorted.length}件
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <ContactForm
          client={client}
          user={user}
          accounts={accounts}
          contact={editContact}
          onClose={() => { setShowForm(false); setEditContact(null); }}
          onSaved={onReload}
        />
      )}
    </>
  );
});
