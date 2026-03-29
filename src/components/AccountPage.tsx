// ============================================
// GS Sales CRM - Account Page
// 取引先一覧（テーブル+詳細切替）
// ============================================

import { useState, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Contact, Deal, AppUser, Category } from '@/types/database';
import { T, fmtYen, shortName, countryToFlag } from '@/lib/constants';
import { AccountForm } from './AccountForm';
import { AccountDetail } from './AccountDetail';

interface AccountPageProps {
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
  categories: Category[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
  onReload: () => void;
}

type SortKey = 'name' | 'country' | 'deals' | 'amount';
type SortDir = 'asc' | 'desc';

export const AccountPage = memo(function AccountPage({
  accounts, contacts, deals, categories, allUsers, client, user, onReload,
}: AccountPageProps) {
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editAcct, setEditAcct] = useState<Account | null>(null);
  const [detailAcct, setDetailAcct] = useState<Account | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Unique countries
  const countries = useMemo(
    () => [...new Set(accounts.map(a => a.country).filter(Boolean))].sort() as string[],
    [accounts],
  );

  // Filtered accounts
  const filtered = useMemo(() => {
    let list = accounts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }
    if (countryFilter) list = list.filter(a => a.country === countryFilter);
    if (ownerFilter !== 'all') list = list.filter(a => a.owner_id === ownerFilter);
    return list;
  }, [accounts, search, countryFilter, ownerFilter]);

  // Deal counts and amounts per account
  const acctStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const d of deals) {
      if (!d.account_id) continue;
      const s = map.get(d.account_id) || { count: 0, total: 0 };
      s.count++; s.total += d.amount || 0;
      map.set(d.account_id, s);
    }
    return map;
  }, [deals]);

  // Sorted
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name, 'ja'); break;
        case 'country': cmp = (a.country || '').localeCompare(b.country || ''); break;
        case 'deals': cmp = (acctStats.get(a.id)?.count || 0) - (acctStats.get(b.id)?.count || 0); break;
        case 'amount': cmp = (acctStats.get(a.id)?.total || 0) - (acctStats.get(b.id)?.total || 0); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir, acctStats]);

  // Footer totals
  const totalDeals = useMemo(() => sorted.reduce((s, a) => s + (acctStats.get(a.id)?.count || 0), 0), [sorted, acctStats]);
  const grandTotal = useMemo(() => sorted.reduce((s, a) => s + (acctStats.get(a.id)?.total || 0), 0), [sorted, acctStats]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const thStyle = (key: SortKey): React.CSSProperties => ({
    padding: '6px 8px', textAlign: 'left' as const, fontSize: 10.5, fontWeight: 700, color: T.muted,
    cursor: 'pointer', userSelect: 'none' as const,
    borderBottom: sortKey === key ? `2px solid ${T.primary}` : `2px solid ${T.border}`,
  });

  // Detail view
  if (detailAcct) {
    const freshAcct = accounts.find(a => a.id === detailAcct.id) || detailAcct;
    return (
      <AccountDetail
        account={freshAcct}
        accounts={accounts}
        contacts={contacts}
        deals={deals}
        categories={categories}
        client={client}
        user={user}
        allUsers={allUsers}
        onBack={() => setDetailAcct(null)}
        onUpdated={onReload}
        onEdit={() => { setEditAcct(freshAcct); setShowForm(true); }}
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
            placeholder="会社名で検索..."
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 11, background: T.card, color: T.primary, fontFamily: 'inherit', width: 150 }}
          />
          <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: T.card, color: T.primary, fontFamily: 'inherit' }}>
            <option value="">全国</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: T.card, color: T.primary, fontFamily: 'inherit' }}>
            <option value="all">全責任者</option>
            {(allUsers || []).map(u => <option key={u.id} value={u.id}>{shortName(u)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>
            取引先一覧 ({filtered.length})
          </span>
          <button
            onClick={() => { setEditAcct(null); setShowForm(true); }}
            style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}
          >
            + 新規取引先
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle('country')} onClick={() => toggleSort('country')}>
                国 {sortKey === 'country' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle('name')} onClick={() => toggleSort('name')}>
                会社名 {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={{ ...thStyle('name'), cursor: 'default' }}>GS責任者</th>
              <th style={{ ...thStyle('name'), cursor: 'default' }}>流入経路</th>
              <th style={{ ...thStyle('name'), cursor: 'default' }}>入金ターム</th>
              <th style={thStyle('deals')} onClick={() => toggleSort('deals')}>
                商談数 {sortKey === 'deals' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th style={thStyle('amount')} onClick={() => toggleSort('amount')}>
                合計金額 {sortKey === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(a => {
              const stats = acctStats.get(a.id);
              const ownerUser = allUsers.find(u => u.id === a.owner_id);
              return (
                <tr
                  key={a.id}
                  style={{ borderBottom: `1px solid ${T.borderLight}`, cursor: 'pointer' }}
                  onClick={() => setDetailAcct(a)}
                  onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '7px 8px', fontSize: 14 }}>{countryToFlag(a.country)}</td>
                  <td style={{ padding: '7px 8px', fontWeight: 600, color: T.primary }}>{a.name}</td>
                  <td style={{ padding: '7px 8px', color: T.sub, fontSize: 11 }}>{shortName(ownerUser)}</td>
                  <td style={{ padding: '7px 8px', color: T.sub, fontSize: 11 }}>{a.lead_source || '-'}</td>
                  <td style={{ padding: '7px 8px', color: T.sub, fontSize: 11 }}>{a.payment_terms || '-'}</td>
                  <td style={{ padding: '7px 8px', color: T.primary, fontWeight: 600 }}>{stats?.count || 0}件</td>
                  <td style={{ padding: '7px 8px', color: T.primary, fontWeight: 700 }}>{fmtYen(stats?.total || 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${T.border}`, background: '#f9f9f9' }}>
              <td colSpan={5} style={{ padding: 8, fontSize: 11, fontWeight: 700, color: T.primary }}>合計 {sorted.length}社</td>
              <td style={{ padding: 8, fontSize: 11, fontWeight: 700, color: T.primary }}>{totalDeals}件</td>
              <td style={{ padding: 8, fontSize: 12, fontWeight: 700, color: T.primary }}>{fmtYen(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <AccountForm
          client={client}
          user={user}
          account={editAcct}
          accounts={accounts}
          categories={categories}
          allUsers={allUsers}
          onClose={() => { setShowForm(false); setEditAcct(null); }}
          onSaved={onReload}
        />
      )}
    </>
  );
});
