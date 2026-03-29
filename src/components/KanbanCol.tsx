// ============================================
// GS Sales CRM - Kanban Column Component
// ドラッグ&ドロップ対応のステージ列
// ============================================

import { useState, memo, useMemo } from 'react';
import type { Deal, Account, DealStage } from '@/types/database';
import type { StageInfo } from '@/lib/constants';
import { T, fmtYen } from '@/lib/constants';
import { DealCard } from './DealCard';

interface KanbanColProps {
  stage: StageInfo;
  deals: Deal[];
  accounts: Account[];
  total: number;
  onDrop: (dealId: string, newStage: DealStage) => void;
  onDealClick: (deal: Deal) => void;
  sortKey: 'date' | 'amount';
}

export const KanbanCol = memo(function KanbanCol({
  stage, deals, accounts, total, onDrop, onDealClick, sortKey,
}: KanbanColProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('dealId');
    if (id) onDrop(id, stage.id);
  };

  const sorted = useMemo(() => [...deals].sort((a, b) => {
    if (sortKey === 'amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    const da = a.payment_confirmed_date || a.deal_date || '';
    const db = b.payment_confirmed_date || b.deal_date || '';
    return db.localeCompare(da);
  }), [deals, sortKey]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minWidth: 220, width: 220, display: 'flex', flexDirection: 'column',
        background: dragOver ? 'rgba(45,140,240,0.04)' : 'transparent',
        borderRadius: 8, transition: 'background .15s',
      }}
    >
      {/* Column header */}
      <div style={{ padding: '8px 8px 4px', position: 'sticky', top: 0, background: T.bg, zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>{stage.ja}</span>
            <span style={{ fontSize: 9.5, color: T.muted, fontWeight: 500 }}>({deals.length})</span>
          </div>
        </div>
        <div style={{ fontSize: 9, color: T.muted, marginBottom: 4 }}>{stage.en}</div>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: stage.phase === 'pre' ? T.accent : stage.phase === 'post' ? T.orange : T.green,
        }}>
          {fmtYen(total)}
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 4px' }}>
        {sorted.map(d => (
          <DealCard key={d.id} deal={d} accounts={accounts} onClick={onDealClick} />
        ))}
      </div>
    </div>
  );
});
