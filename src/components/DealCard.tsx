// ============================================
// GS Sales CRM - Deal Card Component
// カンバン/グリッド用の商談カード
// ============================================

import { memo } from 'react';
import type { Deal, Account } from '@/types/database';
import { STAGES, T, countryToFlag, fmtDealAmt, fmt } from '@/lib/constants';
import { ShipBadge, IncoBadge } from './Badges';

interface DealCardProps {
  deal: Deal;
  accounts: Account[];
  onDragStart?: (dealId: string) => void;
  onClick: (deal: Deal) => void;
}

export const DealCard = memo(function DealCard({ deal, accounts, onDragStart, onClick }: DealCardProps) {
  const acct = accounts.find(a => a.id === deal.account_id);
  const stageObj = STAGES.find(s => s.id === deal.stage);
  const phase = stageObj?.phase || 'pre';
  const isPost = phase === 'post' || phase === 'done';
  const displayDate = isPost && deal.payment_confirmed_date ? deal.payment_confirmed_date : deal.deal_date;

  return (
    <div
      draggable
      onDragStart={e => {
        e.dataTransfer.setData('dealId', deal.id);
        onDragStart?.(deal.id);
      }}
      onClick={() => onClick(deal)}
      style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: '10px 12px', cursor: 'pointer', marginBottom: 6,
        transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Header: deal name + country flag */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {deal.name}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{countryToFlag(acct?.country ?? null)}</span>
      </div>

      {/* Amount + badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>{fmtDealAmt(deal.amount)}</div>
        <div style={{ display: 'flex', gap: 3 }}>
          <ShipBadge type={deal.shipping_type} />
          <IncoBadge incoterms={deal.incoterms} />
        </div>
      </div>

      {/* Company + phase-dependent slider */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: T.accent, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {acct?.name || '-'}
        </div>
        {phase !== 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {phase === 'pre' && <span style={{ fontSize: 9, color: T.muted }}>確度</span>}
            <div style={{ width: 30, height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: (phase === 'pre' ? (deal.confidence || 50) : (deal.prepayment_percent || 0)) + '%',
                height: '100%',
                background: phase === 'pre' ? T.primary : ((deal.prepayment_percent || 0) >= 100 ? T.green : T.orange),
                transition: 'width .3s',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Date + supplier paid dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <span style={{ fontSize: 10, color: T.muted }}>
          {isPost && deal.payment_confirmed_date ? '入金 ' : '開始 '}
          {fmt(displayDate)}
        </span>
        {isPost && deal.supplier_paid && (
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, flexShrink: 0 }} title="仕入入金済" />
        )}
      </div>
    </div>
  );
});
