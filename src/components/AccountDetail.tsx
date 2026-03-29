// ============================================
// GS Sales CRM - Account Detail View
// 取引先詳細画面（コンタクト管理・商談一覧含む）
// ============================================

import { useState, useCallback, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Contact, Deal, AppUser, Category } from '@/types/database';
import { T, fmtYen, shortName, countryToFlag, initial } from '@/lib/constants';

interface AccountDetailProps {
  account: Account;
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
  categories: Category[];
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  onBack: () => void;
  onUpdated: () => void;
  onEdit: () => void;
  onDealClick?: (deal: Deal) => void;
}

export const AccountDetail = memo(function AccountDetail({
  account, contacts, deals, categories, client, allUsers,
  onBack, onUpdated, onEdit, onDealClick,
}: AccountDetailProps) {
  const acctContacts = useMemo(() => contacts.filter(c => c.account_id === account.id), [contacts, account.id]);
  const acctDeals = useMemo(() => deals.filter(d => d.account_id === account.id), [deals, account.id]);
  const owner = allUsers.find(u => u.id === account.owner_id);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Inline contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [cName, setCName] = useState('');
  const [cRole, setCRole] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cWhatsapp, setCWhatsapp] = useState('');
  const [cLinkedin, setCLinkedin] = useState('');
  const [cSaving, setCSaving] = useState(false);

  const resetContactForm = () => {
    setCName(''); setCRole(''); setCEmail(''); setCPhone(''); setCWhatsapp(''); setCLinkedin('');
    setEditContact(null); setShowContactForm(false);
  };

  const openEditContact = (c: Contact) => {
    setEditContact(c);
    setCName(c.name); setCRole(c.role || ''); setCEmail(c.email || '');
    setCPhone(c.phone || ''); setCWhatsapp(c.whatsapp || ''); setCLinkedin(c.linkedin || '');
    setShowContactForm(true);
  };

  const saveContact = useCallback(async () => {
    if (!cName.trim()) return;
    setCSaving(true);
    const row: Record<string, unknown> = {
      account_id: account.id,
      name: cName.trim(),
      role: cRole || null,
      email: cEmail || null,
      phone: cPhone || null,
      whatsapp: cWhatsapp || null,
      linkedin: cLinkedin || null,
    };
    if (account.owner_id) row.owner_id = account.owner_id;

    try {
      if (editContact) {
        await client.from('sales_contacts').update(row).eq('id', editContact.id);
      } else {
        await client.from('sales_contacts').insert(row);
      }
      resetContactForm();
      onUpdated();
    } catch (e) {
      console.error(e);
    }
    setCSaving(false);
  }, [client, account.id, account.owner_id, cName, cRole, cEmail, cPhone, cWhatsapp, cLinkedin, editContact, onUpdated]);

  const deleteContact = useCallback(async (contactId: string) => {
    if (!confirm('このコンタクトを削除しますか？')) return;
    await client.from('sales_contacts').delete().eq('id', contactId);
    onUpdated();
  }, [client, onUpdated]);

  // Business metrics
  const ltv = useMemo(() => acctDeals.reduce((s, d) => s + (d.amount || 0), 0), [acctDeals]);
  const closedDeals = useMemo(() => acctDeals.filter(d => d.stage === 'closed'), [acctDeals]);
  const completionRate = acctDeals.length > 0 ? Math.round((closedDeals.length / acctDeals.length) * 100) : 0;
  const avgDealAmt = acctDeals.length > 0 ? Math.round(ltv / acctDeals.length) : 0;

  const deleteAccount = async () => {
    try {
      // Nullify related contacts and deals before deleting
      await client.from('sales_contacts').update({ account_id: null }).eq('account_id', account.id);
      await client.from('sales_deals').update({ account_id: null, updated_at: new Date().toISOString() }).eq('account_id', account.id);
      await client.from('sales_accounts').delete().eq('id', account.id);
      onUpdated();
      onBack();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const acctCategories = useMemo(() => {
    if (!account.category_ids?.length) return [];
    return categories.filter(c => account.category_ids.includes(c.id));
  }, [account.category_ids, categories]);

  const I: React.CSSProperties = {
    width: '100%', border: `1px solid ${T.border}`, borderRadius: 5,
    padding: '5px 8px', fontSize: 11.5, outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Back + Title + Edit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>戻る
        </button>
        <div style={{ flex: 1, marginLeft: 4 }}>
          <div style={{ fontSize: 9.5, color: T.muted }}>取引先</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{countryToFlag(account.country)}</span>
            {account.name}
          </div>
        </div>
        <button onClick={onEdit} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>編集</button>
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Left: Account Info + Metrics */}
        <div style={{ width: 300, minWidth: 300, overflowY: 'auto' }}>
          {/* Basic Info */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 10 }}>会社情報</div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '5px 6px', fontSize: 11.5 }}>
              <span style={{ color: T.muted }}>国</span>
              <span>{countryToFlag(account.country)} {account.country || '-'}</span>

              <span style={{ color: T.muted }}>Webサイト</span>
              {account.website ? (
                <a href={account.website} target="_blank" rel="noopener noreferrer" style={{ color: T.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.website}</a>
              ) : <span>-</span>}

              <span style={{ color: T.muted }}>請求先</span>
              <span style={{ fontSize: 11 }}>{account.address_billing || '-'}</span>

              <span style={{ color: T.muted }}>入金ターム</span>
              <span style={{ fontWeight: 500 }}>{account.payment_terms || '-'}</span>

              <span style={{ color: T.muted }}>流入経路</span>
              <span>{account.lead_source || '-'}</span>

              <span style={{ color: T.muted }}>GS責任者</span>
              <span>{shortName(owner)}</span>
            </div>

            {/* Categories */}
            {acctCategories.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {acctCategories.map(c => (
                  <span key={c.id} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: T.primary, color: '#fff' }}>{c.name}</span>
                ))}
              </div>
            )}

            {/* Notes */}
            {account.notes && (
              <div style={{ marginTop: 8, fontSize: 11, color: T.sub, borderTop: `1px solid ${T.borderLight}`, paddingTop: 8, lineHeight: 1.5 }}>{account.notes}</div>
            )}
          </div>

          {/* Business Metrics */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 10 }}>ビジネス指標</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.primary }}>{fmtYen(ltv)}</div>
                <div style={{ fontSize: 9.5, color: T.muted }}>LTV</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.green }}>{completionRate}%</div>
                <div style={{ fontSize: 9.5, color: T.muted }}>成約率</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.accent }}>{fmtYen(avgDealAmt)}</div>
                <div style={{ fontSize: 9.5, color: T.muted }}>平均単価</div>
              </div>
            </div>
          </div>

          {/* Deals List */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>商談 ({acctDeals.length})</div>
            {acctDeals.map(d => (
              <div
                key={d.id}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: `1px solid ${T.borderLight}`, cursor: onDealClick ? 'pointer' : 'default' }}
                onClick={() => onDealClick?.(d)}
                onMouseEnter={e => { if (onDealClick) e.currentTarget.style.background = T.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                  <div style={{ fontSize: 9.5, color: T.muted }}>{d.stage}</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, flexShrink: 0 }}>{fmtYen(d.amount)}</span>
              </div>
            ))}
            {acctDeals.length === 0 && <div style={{ fontSize: 11, color: '#ccc' }}>商談なし</div>}
          </div>
        </div>

        {/* Right: Contacts */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>コンタクト ({acctContacts.length})</div>
              <button
                onClick={() => { resetContactForm(); setShowContactForm(true); }}
                style={{ padding: '3px 10px', borderRadius: 5, border: 'none', fontSize: 10.5, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}
              >
                + 追加
              </button>
            </div>

            {/* Inline contact form */}
            {showContactForm && (
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.primary, marginBottom: 6 }}>
                  {editContact ? 'コンタクト編集' : '新規コンタクト'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>氏名 *</label>
                    <input value={cName} onChange={e => setCName(e.target.value)} style={I} placeholder="氏名" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>役職</label>
                    <input value={cRole} onChange={e => setCRole(e.target.value)} style={I} placeholder="役職" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>メール</label>
                    <input value={cEmail} onChange={e => setCEmail(e.target.value)} style={I} placeholder="メール" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>電話</label>
                    <input value={cPhone} onChange={e => setCPhone(e.target.value)} style={I} placeholder="電話" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>WhatsApp</label>
                    <input value={cWhatsapp} onChange={e => setCWhatsapp(e.target.value)} style={I} placeholder="WhatsApp" />
                  </div>
                  <div>
                    <label style={{ fontSize: 9.5, color: T.muted }}>LinkedIn</label>
                    <input value={cLinkedin} onChange={e => setCLinkedin(e.target.value)} style={I} placeholder="LinkedIn" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button onClick={resetContactForm} style={{ padding: '3px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
                  <button onClick={saveContact} disabled={cSaving} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: cSaving ? 0.5 : 1 }}>
                    {cSaving ? '...' : editContact ? '更新' : '追加'}
                  </button>
                </div>
              </div>
            )}

            {/* Contact list */}
            {acctContacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#e8e8e8', color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {initial(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[c.role, c.email, c.phone].filter(Boolean).join(' · ')}
                  </div>
                  {/* Quick action links */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    {c.email && (
                      <a href={`mailto:${c.email}`} style={{ fontSize: 9.5, color: T.accent, textDecoration: 'none' }}>メール</a>
                    )}
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp.replace(/[^0-9+]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9.5, color: '#25d366', textDecoration: 'none' }}>WhatsApp</a>
                    )}
                    {c.linkedin && (
                      <a href={c.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9.5, color: '#0077b5', textDecoration: 'none' }}>LinkedIn</a>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => openEditContact(c)} style={{ padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 9, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>編集</button>
                  <button onClick={() => deleteContact(c.id)} style={{ padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 9, cursor: 'pointer', background: '#fff', color: T.red, fontFamily: 'inherit' }}>削除</button>
                </div>
              </div>
            ))}
            {acctContacts.length === 0 && !showContactForm && (
              <div style={{ fontSize: 11, color: '#ccc', padding: '8px 0' }}>コンタクトなし</div>
            )}
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
            <span style={{ fontSize: 10.5, color: T.primary }}>関連する商談・コンタクトの紐付けが解除されます。本当に削除しますか？</span>
            <button onClick={deleteAccount} style={{ padding: '3px 8px', borderRadius: 3, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.red, color: '#fff', fontFamily: 'inherit' }}>削除する</button>
            <button onClick={() => setDeleteConfirm(false)} style={{ padding: '3px 8px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  );
});
