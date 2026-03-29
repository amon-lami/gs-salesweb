// ============================================
// GS Sales CRM - Constants
// ステージ・配送・テーマ等の定数定義
// ============================================

import type { DealStage, Phase, ShippingType, LeadStatus } from '@/types/database';

// ── ステージ定義（マスタ未ロード時のフォールバック） ──
export interface StageInfo {
  id: DealStage;
  en: string;
  ja: string;
  phase: Phase;
}

export const STAGES: StageInfo[] = [
  { id: 'new',             en: 'New',              ja: '新規',         phase: 'pre' },
  { id: 'negotiation',     en: 'Negotiation',      ja: '交渉中',       phase: 'pre' },
  { id: 'invoice_sent',    en: 'Invoice Sent',     ja: '請求書送付済',  phase: 'pre' },
  { id: 'order_pending',   en: 'Order Pending',    ja: '発注未完了',    phase: 'post' },
  { id: 'order_completed', en: 'Order Completed',  ja: '発注完了',      phase: 'post' },
  { id: 'goods_received',  en: 'Goods Received',   ja: '入荷済',       phase: 'post' },
  { id: 'shipped',         en: 'Shipped',          ja: '発送済',       phase: 'post' },
  { id: 'closed',          en: 'Completed',        ja: '完了',         phase: 'done' },
  { id: 'lost',            en: 'Lost',             ja: '失注',         phase: 'done' },
];

export const PHASES = [
  { id: 'all'  as const, label: '全フェーズ' },
  { id: 'pre'  as const, label: '入金前' },
  { id: 'post' as const, label: '発注〜発送' },
  { id: 'done' as const, label: '完了' },
];

// ── 配送タイプ ──
export interface ShippingInfo {
  label: string;
  icon: string;
  color: string;
}

export const SHIPPING: Record<ShippingType, ShippingInfo> = {
  sea:      { label: '船便',   icon: '🚢', color: '#2563eb' },
  air:      { label: '航空便', icon: '✈',  color: '#7c3aed' },
  domestic: { label: '国内',   icon: '🏠', color: '#059669' },
};

// ── インコタームズ ──
export const INCOTERMS_OPTIONS = ['EXW', 'FOB', 'CIF', 'DAP', 'Other'] as const;

// ── リードソース ──
export const LEAD_SOURCES = ['JBW', 'LinkedIn', 'WhatsApp', 'メール', 'その他'] as const;

// ── リードステータス ──
export interface LeadStatusInfo {
  id: LeadStatus;
  label: string;
  color: string;
}

export const LEAD_STATUSES: LeadStatusInfo[] = [
  { id: 'new',       label: '新規',        color: '#2d8cf0' },
  { id: 'contacted', label: 'コンタクト済', color: '#f59e0b' },
  { id: 'qualified', label: '見込みあり',   color: '#22c55e' },
  { id: 'converted', label: '商談化',       color: '#1a1a1a' },
  { id: 'lost',      label: '見送り',       color: '#ef4444' },
];

// ── 売上確定とみなすステージ ──
export const REV_STAGES: DealStage[] = [
  'order_pending', 'order_completed', 'goods_received', 'shipped', 'closed',
];

// ── 年間売上目標 ──
export const FY_TARGET = 1_000_000_000; // 10億円

// ── テーマカラー ──
export const T = {
  primary:     '#1a1a1a',
  sub:         '#666',
  muted:       '#999',
  border:      '#e5e5e5',
  borderLight: '#f0f0f0',
  bg:          '#fafafa',
  card:        '#fff',
  hover:       'rgba(0,0,0,0.03)',
  accent:      '#2d8cf0',
  green:       '#22c55e',
  orange:      '#f59e0b',
  red:         '#ef4444',
} as const;

// ── 国旗マッピング ──
const COUNTRY_FLAGS: Record<string, string> = {
  'US': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸', 'アメリカ': '🇺🇸',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'イギリス': '🇬🇧',
  'AU': '🇦🇺', 'Australia': '🇦🇺', 'オーストラリア': '🇦🇺',
  'CA': '🇨🇦', 'Canada': '🇨🇦', 'カナダ': '🇨🇦',
  'JP': '🇯🇵', 'Japan': '🇯🇵', '日本': '🇯🇵',
  'KR': '🇰🇷', 'Korea': '🇰🇷', '韓国': '🇰🇷',
  'CN': '🇨🇳', 'China': '🇨🇳', '中国': '🇨🇳',
  'TW': '🇹🇼', 'Taiwan': '🇹🇼', '台湾': '🇹🇼',
  'SG': '🇸🇬', 'Singapore': '🇸🇬', 'シンガポール': '🇸🇬',
  'TH': '🇹🇭', 'Thailand': '🇹🇭', 'タイ': '🇹🇭',
  'VN': '🇻🇳', 'Vietnam': '🇻🇳', 'ベトナム': '🇻🇳',
  'MY': '🇲🇾', 'Malaysia': '🇲🇾', 'マレーシア': '🇲🇾',
  'PH': '🇵🇭', 'Philippines': '🇵🇭', 'フィリピン': '🇵🇭',
  'IN': '🇮🇳', 'India': '🇮🇳', 'インド': '🇮🇳',
  'SA': '🇸🇦', 'Saudi Arabia': '🇸🇦', 'サウジ': '🇸🇦',
  'DE': '🇩🇪', 'Germany': '🇩🇪', 'ドイツ': '🇩🇪',
  'FR': '🇫🇷', 'France': '🇫🇷', 'フランス': '🇫🇷',
  'IT': '🇮🇹', 'Italy': '🇮🇹', 'イタリア': '🇮🇹',
  'NL': '🇳🇱', 'Netherlands': '🇳🇱', 'オランダ': '🇳🇱',
  'ES': '🇪🇸', 'Spain': '🇪🇸', 'スペイン': '🇪🇸',
  'SE': '🇸🇪', 'Sweden': '🇸🇪', 'スウェーデン': '🇸🇪',
  'NP': '🇳🇵', 'Nepal': '🇳🇵', 'ネパール': '🇳🇵',
  'AE': '🇦🇪', 'United Arab Emirates': '🇦🇪', 'UAE': '🇦🇪', 'アラブ': '🇦🇪',
  'BR': '🇧🇷', 'Brazil': '🇧🇷', 'ブラジル': '🇧🇷',
  'MX': '🇲🇽', 'Mexico': '🇲🇽', 'メキシコ': '🇲🇽',
  'NZ': '🇳🇿', 'New Zealand': '🇳🇿', 'ニュージーランド': '🇳🇿',
  'HK': '🇭🇰', 'Hong Kong': '🇭🇰', '香港': '🇭🇰',
  'ID': '🇮🇩', 'Indonesia': '🇮🇩', 'インドネシア': '🇮🇩',
  'CH': '🇨🇭', 'Switzerland': '🇨🇭', 'スイス': '🇨🇭',
  'RU': '🇷🇺', 'Russia': '🇷🇺', 'ロシア': '🇷🇺',
  'KG': '🇰🇬', 'Kyrgyzstan': '🇰🇬', 'キルギス': '🇰🇬',
  'BN': '🇧🇳', 'Brunei': '🇧🇳', 'ブルネイ': '🇧🇳',
  'SK': '🇸🇰', 'Slovakia': '🇸🇰', 'スロバキア': '🇸🇰',
  'RO': '🇷🇴', 'Romania': '🇷🇴', 'ルーマニア': '🇷🇴',
};

export function countryToFlag(country: string | null): string {
  if (!country) return '🌐';
  return COUNTRY_FLAGS[country] || '🌐';
}

// ── フォーマットユーティリティ ──
export function fmt(d: string | null | undefined): string {
  if (!d || d === '') return '-';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '-';
    return dt.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return '-';
  }
}

export function fmtYen(n: number | null | undefined): string {
  return '¥' + Number(n || 0).toLocaleString();
}

export function fmtDealAmt(n: number | null | undefined): string {
  return (!n || Number(n) === 0) ? '未定' : fmtYen(n);
}

// ── ユーザー名ユーティリティ ──
const SHORT_NAMES: Record<string, string> = {
  'Lamichhane Amon': 'Amon', 'Amon Lamichhane': 'Amon',
  'Yuki Nakagawa': 'Yuki', 'Nakagawa Yuki': 'Yuki',
  'Ito Yuta': 'Yuta', 'Yuta Ito': 'Yuta',
  'Chikaki Kosuke': 'Chikaki', 'Kosuke Chikaki': 'Chikaki',
  'Martirossian Mark': 'Mark', 'Mark Martirossian': 'Mark', 'Mark Matiros': 'Mark',
  'Tsumura Kota': 'Tsumura', 'Kota Tsumura': 'Tsumura',
  'Sarah Azzouz': 'Sarah', 'Azzouz Sarah': 'Sarah',
  'Joseph Mackay': 'Joseph', 'Mackay Joseph': 'Joseph',
};

const EMAIL_SHORT: Record<string, string> = {
  'alt@': 'Amon',
  'yuki.nakagawa@': 'Yuki',
  'kota.tsumura@': 'Tsumura',
  'chikaki@': 'Chikaki',
  'yuta.ito@': 'Yuta',
  'mark.matiros@': 'Mark',
  'sarah.azzouz@': 'Sarah',
  'joseph.mackay@': 'Joseph',
};

export function shortName(u: { name?: string; email?: string } | null | undefined): string {
  if (!u) return '-';
  const n = u.name || '';
  if (SHORT_NAMES[n]) return SHORT_NAMES[n];
  const e = u.email || '';
  for (const [k, v] of Object.entries(EMAIL_SHORT)) {
    if (e.startsWith(k)) return v;
  }
  return n || e.split('@')[0] || '-';
}

export function initial(name: string | undefined): string {
  return (name || '?')[0].toUpperCase();
}
