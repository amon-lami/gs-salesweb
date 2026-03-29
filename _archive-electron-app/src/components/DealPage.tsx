// ============================================
// GS Sales CRM - Deal Page
// 商談一覧（カンバン + リスト + 詳細）
// ============================================

import { useState, useCallback, useMemo, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, Category, AppUser, DealStage } from '@/types/database';
import { STAGES, SHIPPING, T, countryToFlag, fmtYen, fmtDealAmt, fmt, shortName } from '@/lib/constants';
import { ShipBadge, PayBadge } from './Badges';
import { DealCard } from './DealCard';
import { KanbanCol } from './KanbanCol';
import { DealForm } from './DealForm';
import { DealDetail } from './DealDetail';

type ViewMode = 'kanban' | 'list';
type SortDir = 'asc' | 'desc';

interface DealPageProps {
  deals: Deal[];
  accounts: Account[];
  contacts: Contact[];
  categories: Category[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
  onReload: () => void;
}

export const DealPage = memo(function DealPage({
  deals, accounts, contacts, categories, allUsers, client, user, onReload,
}: DealPageProps) {
  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);

  // ── Filter state ──
  const [dealSearch, setDealSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [amountFilter, setAmountFilter] = useState('all');
  const [shipFilter, setShipFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('');

  // ── Sort state ──
  const [kanbanSort, setKanbanSort] = useState<'date' | 'amount'>('date');
  const [listSort, setListSort] = useState<{ key: string; dir: SortDir }>({ key: 'date', dir: 'desc' });

  // ── Filtered deals ──
  const filtered = useMemo(() => deals.filter(d => {
    if (dealSearch) {
      const q = dealSearch.toLowerCase();
      const acct = accounts.find(a => a.id === d.account_id);
      if (!d.name.toLowerCase().includes(q) && !(acct?.name || '').toLowerCase().includes(q)) return false;
    }
    if (selectedCategory && selectedCategory !== 'all') {
      const acct = accounts.find(a => a.id === d.account_id);
      if (!acct || !(acct.category_ids || []).includes(selectedCategory)) return false;
    }
    if (stageFilter !== 'all') {
      const s = STAGES.find(st => st.id === d.stage);
      if (stageFilter === 'pre' || stageFilter === 'post' || stageFilter === 'done') {
        if (s && s.phase !== stageFilter) return false;
      } else {
        if (d.stage !== stageFilter) return false;
      }
    }
    if (shipFilter !== 'all' && d.shipping_type !== shipFilter) return false;
    if (ownerFilter !== 'all' && d.owner_id !== ownerFilter) return false;
    if (amountFilter === 'over1m' && (Number(d.amount) || 0) < 1000000) return false;
    if (amountFilter === 'under1m' && (Number(d.amount) || 0) >= 1000000) return false;
    return true;
  }), [deals, dealSearch, stageFilter, ownerFilter, amountFilter, shipFilter, selectedCategory, accounts]);

  // ── Handlers ──
  const handleDrop = useCallback(async (dealId: string, newStage: DealStage) => {
    try {
      const deal = deals.find(d => d.id === dealId);
      if (!deal || deal.stage === newStage) return;
      const currentPhase = STAGES.find(s => s.id === deal.stage)?.phase || 'pre';
      const targetPhase = STAGES.find(s => s.id === newStage)?.phase;
      const updateData: Record<string, unknown> = { stage: newStage, updated_at: new Date().toISOString() };
      if (currentPhase === 'pre' && (targetPhase === 'post' || targetPhase === 'done') && !deal.payment_confirmed_date) {
        updateData.payment_confirmed_date = new Date().toISOString().split('T')[0];
      }
      const { error: ue } = await client.from('sales_deals').update(updateData).eq('id', dealId);
      if (ue) throw ue;
      const oldStage = STAGES.find(s => s.id === deal.stage);
      const newStageObj = STAGES.find(s => s.id === newStage);
      await client.from('sales_activities').insert({
        deal_id: dealId, account_id: deal.account_id, user_id: user.id, type: 'stage_change',
        content: `${oldStage?.ja} → ${newStageObj?.ja}`,
      });
      onReload();
    } catch (e) { console.error(e); }
  }, [deals, client, user.id, onReload]);

  const openDetail = useCallback((d: Deal) => setDetailDeal(d), []);
  const openEdit = useCallback((d: Deal) => { setEditDeal(d); setShowForm(true); }, []);
  const clearFilter = useCallback(() => {
    setStageFilter('all'); setOwnerFilter('all'); setAmountFilter('all');
    setShipFilter('all'); setSelectedCategory(''); setDealSearch('');
  }, []);

  const toggleSort = useCallback((key: string) => {
    setListSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  }, []);

  const activeFilterCount = [
    stageFilter !== 'all', ownerFilter !== 'all', amountFilter !== 'all',
    shipFilter !== 'all', selectedCategory && selectedCategory !== '', dealSearch,
  ].filter(Boolean).length;

  // ── Detail view ──
  if (detailDeal) {
    const freshDeal = deals.find(d => d.id === detailDeal.id) || detailDeal;
    return (
      <>
        <DealDetail
          deal={freshDeal}
          accounts={accounts}
          contacts={contacts}
          client={client}
          user={user}
          allUsers={allUsers}
          onBack={() => setDetailDeal(null)}
          onUpdated={onReload}
          onEdit={() => openEdit(freshDeal)}
        />
        {showForm && (
          <DealForm
            client={client} user={user} accounts={accounts}
            deal={editDeal} allUsers={allUsers} deals={deals}
            onClose={() => { setShowForm(false); setEditDeal(null); }}
            onSaved={onReload}
          />
        )}
      </>
    );
  }

  // ── Styles ──
  const FS: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 5, border: `1px solid ${T.border}`,
    fontSize: 10.5, fontWeight: 500, cursor: 'pointer',
    background: T.card, color: T.sub, fontFamily: 'inherit', outline: 'none',
  };
  const activeFS = (isActive: boolean): React.CSSProperties =>
    isActive ? { ...FS, borderColor: T.primary, color: T.primary, fontWeight: 600, background: T.primary + '08' } : FS;

  return (
    <>
      {/* ── Toolbar ── */}
      <div style={{ padding: '7px 14px', borderBottom: `1px solid ${T.border}`, background: T.card, display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Left: filters */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <input value={dealSearch} onChange={e => setDealSearch(e.target.value)} placeholder="検索..." style={{ ...FS, width: 140, fontWeight: 400 }} />
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={activeFS(stageFilter !== 'all')}>
            <option value="all">全フェーズ</option>
            <option value="pre">入金前</option>
            <option value="post">発注〜発送</option>
            <option value="done">完了</option>
            <optgroup label="────────">
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.ja}</option>)}
            </optgroup>
          </select>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={activeFS(ownerFilter !== 'all')}>
            <option value="all">全責任者</option>
            {(allUsers || []).map(u => <option key={u.id} value={u.id}>{shortName(u)}</option>)}
          </select>
          <select value={amountFilter} onChange={e => setAmountFilter(e.target.value)} style={activeFS(amountFilter !== 'all')}>
            <option value="all">全金額</option>
            <option value="over1m">100万以上</option>
            <option value="under1m">100万以下</option>
          </select>
          <select value={shipFilter} onChange={e => setShipFilter(e.target.value)} style={activeFS(shipFilter !== 'all')}>
            <option value="all">全配送</option>
            <option value="sea">船便</option>
            <option value="air">航空便</option>
            <option value="domestic">国内</option>
          </select>
          {categories.length > 0 && (
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={activeFS(!!selectedCategory && selectedCategory !== '')}>
              <option value="">全事業</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {activeFilterCount > 0 && (
            <button onClick={clearFilter} style={{ padding: '3px 8px', borderRadius: 10, border: 'none', fontSize: 9.5, fontWeight: 700, cursor: 'pointer', background: T.primary + '12', color: T.primary, fontFamily: 'inherit' }}>
              {activeFilterCount}件のフィルター ✕
            </button>
          )}
        </div>

        {/* Right: sort + view + add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {viewMode === 'kanban' && (
            <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 5, overflow: 'hidden' }}>
              <button onClick={() => setKanbanSort('date')} style={{ padding: '4px 8px', border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: kanbanSort === 'date' ? T.primary : T.card, color: kanbanSort === 'date' ? '#fff' : T.muted, fontFamily: 'inherit' }}>日付</button>
              <button onClick={() => setKanbanSort('amount')} style={{ padding: '4px 8px', border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: kanbanSort === 'amount' ? T.primary : T.card, color: kanbanSort === 'amount' ? '#fff' : T.muted, fontFamily: 'inherit' }}>金額</button>
            </div>
          )}
          <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 5, overflow: 'hidden' }}>
            <button onClick={() => setViewMode('kanban')} style={{ padding: '4px 10px', border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: viewMode === 'kanban' ? T.primary : T.card, color: viewMode === 'kanban' ? '#fff' : T.muted, fontFamily: 'inherit' }}>カンバン</button>
            <button onClick={() => setViewMode('list')} style={{ padding: '4px 10px', border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: viewMode === 'list' ? T.primary : T.card, color: viewMode === 'list' ? '#fff' : T.muted, fontFamily: 'inherit' }}>リスト</button>
          </div>
          <button onClick={() => { setEditDeal(null); setShowForm(true); }} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>
            + 新規
          </button>
        </div>
      </div>

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' ? (
        <KanbanView
          filtered={filtered}
          accounts={accounts}
          stageFilter={stageFilter}
          kanbanSort={kanbanSort}
          onDrop={handleDrop}
          onDealClick={openDetail}
        />
      ) : (
        <ListView
          filtered={filtered}
          accounts={accounts}
          allUsers={allUsers}
          listSort={listSort}
          toggleSort={toggleSort}
          onDealClick={openDetail}
        />
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <DealForm
          client={client} user={user} accounts={accounts}
          deal={editDeal} allUsers={allUsers} deals={deals}
          onClose={() => { setShowForm(false); setEditDeal(null); }}
          onSaved={onReload}
        />
      )}
    </>
  );
});


// ── Kanban Sub-component ──
function KanbanView({ filtered, accounts, stageFilter, kanbanSort, onDrop, onDealClick }: {
  filtered: Deal[];
  accounts: Account[];
  stageFilter: string;
  kanbanSort: 'date' | 'amount';
  onDrop: (dealId: string, newStage: DealStage) => void;
  onDealClick: (deal: Deal) => void;
}) {
  const isIndividualStage = stageFilter !== 'all' && stageFilter !== 'pre' && stageFilter !== 'post' && stageFilter !== 'done';

  if (isIndividualStage) {
    const stageObj = STAGES.find(s => s.id === stageFilter);
    const sortedDeals = [...filtered].sort((a, b) => {
      if (kanbanSort === 'amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      const da = a.payment_confirmed_date || a.deal_date || '';
      const db = b.payment_confirmed_date || b.deal_date || '';
      return db.localeCompare(da);
    });
    const total = sortedDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: T.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.primary }}>{stageObj?.ja}</span>
            <span style={{ fontSize: 11, color: T.muted }}>{sortedDeals.length}件</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.primary }}>{fmtYen(total)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
          {sortedDeals.map(d => <DealCard key={d.id} deal={d} accounts={accounts} onClick={onDealClick} />)}
        </div>
        {sortedDeals.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 12 }}>該当する商談がありません</div>}
      </div>
    );
  }

  // Phase/All kanban columns
  const visibleStages = STAGES.filter(s => {
    if (stageFilter === 'all') return true;
    return s.phase === stageFilter;
  });

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '8px 8px', display: 'flex', gap: 6, background: T.bg }}>
      {visibleStages.map(stage => {
        const stageDeals = filtered.filter(d => d.stage === stage.id);
        const total = stageDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0);
        return (
          <KanbanCol
            key={stage.id}
            stage={stage}
            deals={stageDeals}
            accounts={accounts}
            total={total}
            onDrop={onDrop}
            onDealClick={onDealClick}
            sortKey={kanbanSort}
          />
        );
      })}
    </div>
  );
}


// ── List Sub-component ──
function ListView({ filtered, accounts, allUsers, listSort, toggleSort, onDealClick }: {
  filtered: Deal[];
  accounts: Account[];
  allUsers: AppUser[];
  listSort: { key: string; dir: SortDir };
  toggleSort: (key: string) => void;
  onDealClick: (deal: Deal) => void;
}) {
  const sortedList = useMemo(() => [...filtered].sort((a, b) => {
    const dir = listSort.dir === 'asc' ? 1 : -1;
    if (listSort.key === 'amount') return ((Number(a.amount) || 0) - (Number(b.amount) || 0)) * dir;
    if (listSort.key === 'name') return (a.name || '').localeCompare(b.name || '') * dir;
    if (listSort.key === 'account') {
      const aa = accounts.find(x => x.id === a.account_id)?.name || '';
      const bb = accounts.find(x => x.id === b.account_id)?.name || '';
      return aa.localeCompare(bb) * dir;
    }
    if (listSort.key === 'stage') return (STAGES.findIndex(s => s.id === a.stage) - STAGES.findIndex(s => s.id === b.stage)) * dir;
    if (listSort.key === 'owner') {
      const aa = shortName(allUsers.find(u => u.id === a.owner_id));
      const bb = shortName(allUsers.find(u => u.id === b.owner_id));
      return aa.localeCompare(bb) * dir;
    }
    const da = a.payment_confirmed_date || a.deal_date || '';
    const db = b.payment_confirmed_date || b.deal_date || '';
    return da.localeCompare(db) * dir;
  }), [filtered, listSort, accounts, allUsers]);

  const totalAmt = filtered.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const sortIcon = (key: string) => listSort.key === key ? (listSort.dir === 'asc' ? '↑' : '↓') : '';
  const thStyle = (key: string): React.CSSProperties => ({
    padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700,
    color: listSort.key === key ? T.primary : T.muted, cursor: 'pointer', userSelect: 'none',
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${T.border}` }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>国</th>
            <th style={thStyle('name')} onClick={() => toggleSort('name')}>商談名 {sortIcon('name')}</th>
            <th style={thStyle('account')} onClick={() => toggleSort('account')}>取引先 {sortIcon('account')}</th>
            <th style={thStyle('amount')} onClick={() => toggleSort('amount')}>金額 {sortIcon('amount')}</th>
            <th style={thStyle('stage')} onClick={() => toggleSort('stage')}>ステージ {sortIcon('stage')}</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>配送</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>入金</th>
            <th style={thStyle('owner')} onClick={() => toggleSort('owner')}>責任者 {sortIcon('owner')}</th>
            <th style={thStyle('date')} onClick={() => toggleSort('date')}>日付 {sortIcon('date')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedList.map(d => {
            const acct = accounts.find(a => a.id === d.account_id);
            const s = STAGES.find(st => st.id === d.stage);
            const ow = allUsers.find(u => u.id === d.owner_id);
            const sp = s?.phase;
            const isPost = sp === 'post' || sp === 'done';
            return (
              <tr
                key={d.id}
                onClick={() => onDealClick(d)}
                style={{ cursor: 'pointer', borderBottom: `1px solid ${T.borderLight}` }}
                onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '6px 8px', fontSize: 14 }}>{countryToFlag(acct?.country ?? null)}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600, color: T.primary }}>{d.name}</td>
                <td style={{ padding: '6px 8px', color: T.accent }}>{acct?.name || '-'}</td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fmtDealAmt(d.amount)}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontSize: 10.5, padding: '2px 6px', borderRadius: 3, fontWeight: 600,
                    background: sp === 'pre' ? T.accent + '15' : sp === 'post' ? T.orange + '15' : T.green + '15',
                    color: sp === 'pre' ? T.accent : sp === 'post' ? T.orange : T.green,
                  }}>
                    {s?.ja}
                  </span>
                </td>
                <td style={{ padding: '6px 8px' }}><ShipBadge type={d.shipping_type} /></td>
                <td style={{ padding: '6px 8px' }}><PayBadge status={d.payment_status} /></td>
                <td style={{ padding: '6px 8px', fontSize: 11, color: T.sub, fontWeight: 500 }}>{shortName(ow)}</td>
                <td style={{ padding: '6px 8px', color: T.muted, fontSize: 11 }}>
                  {isPost && d.payment_confirmed_date ? fmt(d.payment_confirmed_date) : fmt(d.deal_date)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${T.border}`, background: '#f9f9f9' }}>
            <td colSpan={3} style={{ padding: '8px', fontSize: 11, fontWeight: 700, color: T.primary }}>合計 {filtered.length}件</td>
            <td style={{ padding: '8px', fontSize: 12, fontWeight: 700, color: T.primary }}>{fmtYen(totalAmt)}</td>
            <td colSpan={5}></td>
          </tr>
        </tfoot>
      </table>
      {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 12 }}>商談がありません</div>}
    </div>
  );
}
