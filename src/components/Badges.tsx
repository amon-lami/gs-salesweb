// ============================================
// GS Sales CRM - Badge Components
// ShipBadge, IncoBadge, PayBadge
// ============================================

import { memo } from 'react';
import type { ShippingType, PaymentStatus } from '@/types/database';
import { SHIPPING, T } from '@/lib/constants';

/** 配送種別バッジ */
export const ShipBadge = memo(function ShipBadge({ type }: { type: ShippingType | null }) {
  if (!type || !SHIPPING[type]) return null;
  const s = SHIPPING[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 600,
      background: s.color + '15', color: s.color, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
});

/** インコタームズバッジ */
export const IncoBadge = memo(function IncoBadge({ incoterms }: { incoterms: string | null }) {
  if (!incoterms) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 600,
      background: '#d9770615', color: '#d97706', whiteSpace: 'nowrap',
    }}>
      {incoterms}
    </span>
  );
});

/** 入金ステータスバッジ */
export const PayBadge = memo(function PayBadge({ status }: { status: PaymentStatus | undefined }) {
  const m: Record<string, { label: string; color: string }> = {
    full: { label: '入金済', color: T.green },
    partial: { label: '一部入金', color: T.orange },
    none: { label: '未入金', color: T.muted },
  };
  const s = m[status || 'none'] || m.none;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 600, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  );
});
