// ============================================
// GS Sales CRM - Constants
// ステージ・配送・テーマ等の定数定義
// ============================================

import type { CSSProperties } from 'react';
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

// ── 法人格除去 ──
export function stripCorp(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/\s*,?\s*\b(LLC|Inc\.?|Corp\.?|Co\.?\s*,?\s*Ltd\.?|Ltd\.?|GmbH|S\.?A\.?|PLC|Pty\.?\s*Ltd\.?|Pte\.?\s*Ltd\.?|L\.?L\.?C\.?|Incorporated|Limited|Corporation)\b\.?\s*/gi, '')
    .trim();
}

// ── CSVエクスポート ──
export function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const bom = '\uFEFF';
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = bom + headers.map(esc).join(',') + '\n' + rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── フィールドラベル ──
export const FIELD_LABELS: Record<string, string> = {
  amount: '金額', stage: 'ステージ', confidence: '確度', shipping_type: '配送種別',
  incoterms: 'インコタームズ', notes: 'メモ', shipping_date: '配送日', owner_id: '担当者',
  prepayment_percent: '入金率', payment_confirmed_date: '入金日', spreadsheet_url: 'スプレッドシートURL',
  payment_terms: '支払条件', payment_status: '入金状況', supplier_paid: '仕入先支払',
  name: '名前', country: '国', website: 'ウェブサイト', address_billing: '請求先住所',
  address_shipping: '配送先住所', lead_source: 'リードソース', phone: '電話', email: 'メール',
  whatsapp: 'WhatsApp', linkedin: 'LinkedIn', role: '役職', status: 'ステータス',
  company: '会社名', source: 'ソース', priority: '優先度',
};

/** 変更フィールドの差分検出 */
export function diffFields(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>,
  keys: string[],
): string[] {
  if (!oldObj) return [];
  return keys
    .filter(k => String(oldObj[k] ?? null) !== String(newObj[k] ?? null))
    .map(k => FIELD_LABELS[k] || k)
    .filter(Boolean);
}

// ── アクションタイプ ──
export const ACTION_TYPES = ['WhatsApp', 'メール', 'LinkedIn', 'ミーティング', '電話', 'サンプル送付', '見積送付', 'その他'] as const;

// ── 失注理由 ──
export const LOST_REASONS = ['予算なし', '競合に流れた', '反応なし', 'タイミング合わず', 'その他'] as const;

// ── デフォルト事業一覧 ──
export const DEFAULT_BUSINESSES = [
  { id: 'jbeauty', label: 'J-Beauty', color: '#1a1a1a' },
  { id: 'matcha', label: 'Matcha', color: '#4a7c59' },
] as const;

// ── デフォルト為替レート ──
export const DEFAULT_JPY_RATE = 150;

// ── 経費カテゴリ ──
export const EXPENSE_CATEGORIES_DEFAULT = [
  'BtoB', 'Amazon', 'Shopee', 'KG', '雑費', '会議費・交際費', '交通費', '送料・物流費', 'その他',
] as const;

// ── Amazonリージョン ──
export const AMAZON_REGIONS = ['USA', 'Canada', 'Australia'] as const;

// ── 国番号マッピング ──
const COUNTRY_DIAL: Record<string, string> = {
  'US': '+1', 'USA': '+1', 'United States': '+1', 'アメリカ': '+1',
  'CA': '+1', 'Canada': '+1', 'カナダ': '+1',
  'UK': '+44', 'United Kingdom': '+44', 'イギリス': '+44',
  'AU': '+61', 'Australia': '+61', 'オーストラリア': '+61',
  'JP': '+81', 'Japan': '+81', '日本': '+81',
  'KR': '+82', 'Korea': '+82', '韓国': '+82',
  'CN': '+86', 'China': '+86', '中国': '+86',
  'TW': '+886', 'Taiwan': '+886', '台湾': '+886',
  'SG': '+65', 'Singapore': '+65', 'シンガポール': '+65',
  'TH': '+66', 'Thailand': '+66', 'タイ': '+66',
  'VN': '+84', 'Vietnam': '+84', 'ベトナム': '+84',
  'MY': '+60', 'Malaysia': '+60', 'マレーシア': '+60',
  'PH': '+63', 'Philippines': '+63', 'フィリピン': '+63',
  'IN': '+91', 'India': '+91', 'インド': '+91',
  'SA': '+966', 'Saudi Arabia': '+966', 'サウジ': '+966',
  'DE': '+49', 'Germany': '+49', 'ドイツ': '+49',
  'FR': '+33', 'France': '+33', 'フランス': '+33',
  'IT': '+39', 'Italy': '+39', 'イタリア': '+39',
  'NL': '+31', 'Netherlands': '+31', 'オランダ': '+31',
  'ES': '+34', 'Spain': '+34', 'スペイン': '+34',
  'SE': '+46', 'Sweden': '+46', 'スウェーデン': '+46',
  'NP': '+977', 'Nepal': '+977', 'ネパール': '+977',
  'KG': '+996', 'Kyrgyzstan': '+996', 'キルギス': '+996',
  'BN': '+673', 'Brunei': '+673', 'ブルネイ': '+673',
  'SK': '+421', 'Slovakia': '+421', 'スロバキア': '+421',
  'RO': '+40', 'Romania': '+40', 'ルーマニア': '+40',
  'CH': '+41', 'Switzerland': '+41', 'スイス': '+41',
  'AE': '+971', 'United Arab Emirates': '+971', 'UAE': '+971', 'アラブ': '+971',
  'BR': '+55', 'Brazil': '+55', 'ブラジル': '+55',
  'MX': '+52', 'Mexico': '+52', 'メキシコ': '+52',
  'RU': '+7', 'Russia': '+7', 'ロシア': '+7',
  'NZ': '+64', 'New Zealand': '+64', 'ニュージーランド': '+64',
  'HK': '+852', 'Hong Kong': '+852', '香港': '+852',
  'ID': '+62', 'Indonesia': '+62', 'インドネシア': '+62',
  'TR': '+90', 'Turkey': '+90', 'トルコ': '+90',
  'PK': '+92', 'Pakistan': '+92', 'パキスタン': '+92',
  'BD': '+880', 'Bangladesh': '+880', 'バングラデシュ': '+880',
  'LK': '+94', 'Sri Lanka': '+94', 'スリランカ': '+94',
  'IE': '+353', 'Ireland': '+353', 'アイルランド': '+353',
  'PT': '+351', 'Portugal': '+351', 'ポルトガル': '+351',
  'IL': '+972', 'Israel': '+972', 'イスラエル': '+972',
  'EG': '+20', 'Egypt': '+20', 'エジプト': '+20',
  'KE': '+254', 'Kenya': '+254', 'ケニア': '+254',
  'NG': '+234', 'Nigeria': '+234', 'ナイジェリア': '+234',
  'ZA': '+27', 'South Africa': '+27', '南アフリカ': '+27',
};

export function getDialCode(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRY_DIAL[country] || COUNTRY_DIAL[country.trim()] || null;
}

/** 電話番号フォーマット */
function fmtPhoneDash(phone: string): string {
  const m = phone.match(/^(\+\d{1,4})(\d+)$/);
  if (!m) return phone;
  const [, cc, num] = m;
  if (cc === '+81') {
    if (num.length === 10 && num[0] === '9') return `${cc} ${num.slice(0, 2)}-${num.slice(2, 6)}-${num.slice(6)}`;
    if (num.length === 10 && num[0] === '3') return `${cc} ${num.slice(0, 1)}-${num.slice(1, 5)}-${num.slice(5)}`;
    if (num.length === 9) return `${cc} ${num.slice(0, 1)}-${num.slice(1, 5)}-${num.slice(5)}`;
    return `${cc} ${num}`;
  }
  if (cc === '+1' && num.length === 10) return `${cc} ${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
  if (num.length > 6) {
    const p: string[] = [];
    for (let i = 0; i < num.length; i += 4) p.push(num.slice(i, i + 4));
    return `${cc} ${p.join('-')}`;
  }
  return `${cc} ${num}`;
}

export function fmtPhone(raw: string | null | undefined, country?: string | null): string {
  if (!raw || raw === '-' || raw === '不明') return '';
  let d = raw.replace(/[^0-9+]/g, '');
  if (!d || d.replace(/\+/g, '').length < 5) return raw;
  const cc = getDialCode(country ?? null);
  if (d.startsWith('+')) return fmtPhoneDash(d);
  if (d.startsWith('00')) return fmtPhoneDash('+' + d.slice(2));
  if (d.startsWith('0') && cc) return fmtPhoneDash(cc + d.slice(1));
  if (d.startsWith('0')) return fmtPhoneDash('+81' + d.slice(1));
  if (cc) return fmtPhoneDash(cc + d);
  return fmtPhoneDash('+' + d);
}

// ── 国リスト ──
export interface CountryInfo {
  en: string;
  ja: string;
  flag: string;
}

export const COUNTRIES: CountryInfo[] = [
  { en: 'Japan', ja: '日本', flag: '\u{1F1EF}\u{1F1F5}' },
  { en: 'United States', ja: 'アメリカ', flag: '\u{1F1FA}\u{1F1F8}' },
  { en: 'United Kingdom', ja: 'イギリス', flag: '\u{1F1EC}\u{1F1E7}' },
  { en: 'Canada', ja: 'カナダ', flag: '\u{1F1E8}\u{1F1E6}' },
  { en: 'Australia', ja: 'オーストラリア', flag: '\u{1F1E6}\u{1F1FA}' },
  { en: 'Germany', ja: 'ドイツ', flag: '\u{1F1E9}\u{1F1EA}' },
  { en: 'France', ja: 'フランス', flag: '\u{1F1EB}\u{1F1F7}' },
  { en: 'Italy', ja: 'イタリア', flag: '\u{1F1EE}\u{1F1F9}' },
  { en: 'Spain', ja: 'スペイン', flag: '\u{1F1EA}\u{1F1F8}' },
  { en: 'Netherlands', ja: 'オランダ', flag: '\u{1F1F3}\u{1F1F1}' },
  { en: 'Belgium', ja: 'ベルギー', flag: '\u{1F1E7}\u{1F1EA}' },
  { en: 'Switzerland', ja: 'スイス', flag: '\u{1F1E8}\u{1F1ED}' },
  { en: 'Austria', ja: 'オーストリア', flag: '\u{1F1E6}\u{1F1F9}' },
  { en: 'Sweden', ja: 'スウェーデン', flag: '\u{1F1F8}\u{1F1EA}' },
  { en: 'Norway', ja: 'ノルウェー', flag: '\u{1F1F3}\u{1F1F4}' },
  { en: 'Denmark', ja: 'デンマーク', flag: '\u{1F1E9}\u{1F1F0}' },
  { en: 'Finland', ja: 'フィンランド', flag: '\u{1F1EB}\u{1F1EE}' },
  { en: 'Portugal', ja: 'ポルトガル', flag: '\u{1F1F5}\u{1F1F9}' },
  { en: 'Poland', ja: 'ポーランド', flag: '\u{1F1F5}\u{1F1F1}' },
  { en: 'Ireland', ja: 'アイルランド', flag: '\u{1F1EE}\u{1F1EA}' },
  { en: 'China', ja: '中国', flag: '\u{1F1E8}\u{1F1F3}' },
  { en: 'South Korea', ja: '韓国', flag: '\u{1F1F0}\u{1F1F7}' },
  { en: 'Taiwan', ja: '台湾', flag: '\u{1F1F9}\u{1F1FC}' },
  { en: 'Hong Kong', ja: '香港', flag: '\u{1F1ED}\u{1F1F0}' },
  { en: 'Singapore', ja: 'シンガポール', flag: '\u{1F1F8}\u{1F1EC}' },
  { en: 'Malaysia', ja: 'マレーシア', flag: '\u{1F1F2}\u{1F1FE}' },
  { en: 'Thailand', ja: 'タイ', flag: '\u{1F1F9}\u{1F1ED}' },
  { en: 'Vietnam', ja: 'ベトナム', flag: '\u{1F1FB}\u{1F1F3}' },
  { en: 'Indonesia', ja: 'インドネシア', flag: '\u{1F1EE}\u{1F1E9}' },
  { en: 'Philippines', ja: 'フィリピン', flag: '\u{1F1F5}\u{1F1ED}' },
  { en: 'India', ja: 'インド', flag: '\u{1F1EE}\u{1F1F3}' },
  { en: 'Nepal', ja: 'ネパール', flag: '\u{1F1F3}\u{1F1F5}' },
  { en: 'UAE', ja: 'アラブ首長国連邦', flag: '\u{1F1E6}\u{1F1EA}' },
  { en: 'Saudi Arabia', ja: 'サウジアラビア', flag: '\u{1F1F8}\u{1F1E6}' },
  { en: 'Brazil', ja: 'ブラジル', flag: '\u{1F1E7}\u{1F1F7}' },
  { en: 'Mexico', ja: 'メキシコ', flag: '\u{1F1F2}\u{1F1FD}' },
  { en: 'Russia', ja: 'ロシア', flag: '\u{1F1F7}\u{1F1FA}' },
  { en: 'New Zealand', ja: 'ニュージーランド', flag: '\u{1F1F3}\u{1F1FF}' },
  { en: 'Turkey', ja: 'トルコ', flag: '\u{1F1F9}\u{1F1F7}' },
  { en: 'South Africa', ja: '南アフリカ', flag: '\u{1F1FF}\u{1F1E6}' },
  { en: 'Nigeria', ja: 'ナイジェリア', flag: '\u{1F1F3}\u{1F1EC}' },
  { en: 'Kenya', ja: 'ケニア', flag: '\u{1F1F0}\u{1F1EA}' },
  { en: 'Egypt', ja: 'エジプト', flag: '\u{1F1EA}\u{1F1EC}' },
];

// ── モバイル判定 ──
export const IS_MOBILE = typeof window !== 'undefined' && window.innerWidth <= 768;

/** モーダルスタイルヘルパー */
export function getModalContainerStyle(): CSSProperties {
  return IS_MOBILE
    ? { width: '100%', maxWidth: '100%', height: '100%', maxHeight: '100vh', borderRadius: 0 }
    : { width: '90%', maxWidth: 420, maxHeight: '85vh', borderRadius: 10 };
}
