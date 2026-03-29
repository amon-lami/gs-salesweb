// ============================================
// GS Sales CRM - Database Types
// 全テーブルの型定義（スキーマ v10 対応）
// ============================================

/** 通貨コード（master_currenciesで管理） */
export type Currency = string; // ISO 4217 3-letter code

/** 商談ステージ（master_stagesで管理） */
export type DealStage =
  | 'new'
  | 'negotiation'
  | 'invoice_sent'
  | 'order_pending'
  | 'order_completed'
  | 'goods_received'
  | 'shipped'
  | 'closed'
  | 'lost';

/** フェーズ（ステージの上位グループ） */
export type Phase = 'pre' | 'post' | 'done';

/** 配送タイプ（master_shipping_typesで管理） */
export type ShippingType = 'sea' | 'air' | 'domestic';

/** 支払いステータス */
export type PaymentStatus = 'none' | 'partial' | 'full';

/** インコタームズ */
export type Incoterms = '' | 'EXW' | 'FOB' | 'CIF' | 'DAP' | 'Other';

/** リードソース */
export type LeadSource = 'JBW' | 'LinkedIn' | 'WhatsApp' | 'メール' | 'その他';

/** リードステータス */
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

/** アクティビティタイプ */
export type ActivityType = 'stage_change' | 'note' | 'file_upload' | 'payment_update' | 'weekly_report';

/** ユーザーロール */
export type UserRole = 'admin' | 'manager' | 'member';

// ────────────────────────────────
// テーブル行の型定義
// ────────────────────────────────

/** ソフトデリート + タイムスタンプ共通フィールド */
interface BaseRow {
  id: string;
  created_at: string;
  deleted_at: string | null;
}

interface Owned {
  owner_id: string | null;
  created_by: string | null;
}

/** 取引先（顧客/会社） */
export interface Account extends BaseRow, Owned {
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_billing: string | null;
  address_shipping: string | null;
  payment_terms: string | null;
  notes: string | null;
  updated_at: string;
  country: string | null;
  category_ids: string[];
  lead_source: string | null;
  attributed_to: string;
}

/** 取引先担当者 */
export interface Contact extends BaseRow {
  account_id: string | null;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  owner_id: string | null;
  whatsapp: string | null;
  linkedin: string | null;
}

/** 商談 */
export interface Deal extends BaseRow, Owned {
  deal_number: number;
  account_id: string | null;
  name: string;
  amount: number;
  stage: DealStage;
  shipping_type: ShippingType | null;
  category: string | null;
  category_ids: string[];
  payment_status: PaymentStatus;
  supplier_paid: boolean;
  payment_date: string | null;
  close_date: string | null;
  deal_date: string | null;
  invoice_url: string | null;
  spreadsheet_url: string | null;
  chat_room_id: string | null;
  notes: string | null;
  updated_at: string;
  incoterms: Incoterms;
  confidence: number;
  payment_confirmed_date: string | null;
  shipping_date: string | null;
  eta_date: string | null;
  etd_date: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  invoice_number: string | null;
  invoice_file_url: string | null;
  prepayment_percent: number;
  currency: Currency;
}

/** リード */
export interface Lead extends BaseRow, Owned {
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  source: LeadSource | string;
  status: LeadStatus;
  phone: string | null;
  whatsapp: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  category_ids: string[];
  converted_account_id: string | null;
  converted_deal_id: string | null;
  converted_at: string | null;
  updated_at: string;
}

/** 商談添付ファイル */
export interface DealFile extends BaseRow {
  deal_id: string;
  name: string;
  url: string;
  file_type: string | null;
  size: number | null;
  uploaded_by: string | null;
}

/** アクティビティログ */
export interface Activity extends BaseRow {
  deal_id: string | null;
  account_id: string | null;
  user_id: string | null;
  type: ActivityType;
  content: string | null;
  metadata: Record<string, unknown> | null;
  is_todo: boolean;
  is_completed: boolean;
  due_date: string | null;
  assigned_to: string | null;
}

/** カテゴリ */
export interface Category extends BaseRow {
  name: string;
  color: string;
  sort_order: number;
  owner_id: string | null;
}

/** マスターステージ */
export interface MasterStage {
  id: string;
  label_en: string;
  label_ja: string;
  phase: Phase;
  color: string;
  sort_order: number;
  is_active: boolean;
}

/** マスター配送タイプ */
export interface MasterShippingType {
  id: string;
  label_ja: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

/** マスター通貨 */
export interface MasterCurrency {
  code: string;
  name_ja: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
  sort_order: number;
}

/** マスターリードステータス */
export interface MasterLeadStatus {
  id: LeadStatus;
  label_ja: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

/** ユーザーロールマッピング */
export interface UserRoleRow {
  user_id: string;
  role: UserRole;
}

/** 監査ログ */
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  user_id: string | null;
  created_at: string;
}

/** ユーザープロフィール（profilesテーブル） */
export interface AppUser {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
}

/** RPC: リード変換結果 */
export interface ConvertLeadResult {
  account_id: string;
  contact_id: string | null;
  deal_id: string;
}

/** RPC: 楽観的ロック結果 */
export interface SafeUpdateResult {
  success: boolean;
  error?: string;
  message?: string;
  updated_at?: string;
  current_updated_at?: string;
  expected_updated_at?: string;
}

// ────────────────────────────────
// 追加テーブル型定義（web/index.html 移植分）
// ────────────────────────────────

/** 経費 */
export interface Expense extends BaseRow {
  user_id: string;
  business_id: string | null;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  currency: Currency;
  receipt_url: string | null;
  account_id: string | null;
  deal_id: string | null;
  region: string | null;
  notes: string | null;
}

/** 経費明細 */
export interface ExpenseItem extends BaseRow {
  expense_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

/** 事業 */
export interface Business {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  owner_id: string | null;
  created_at: string;
}

/** チャットルーム */
export interface ChatRoom extends BaseRow {
  name: string | null;
  deal_id: string | null;
}

/** チャットルームメンバー */
export interface ChatRoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

/** チャットメッセージ */
export interface ChatMessage extends BaseRow {
  room_id: string;
  user_id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
}

/** リードアクション */
export interface LeadAction extends BaseRow {
  lead_id: string;
  type: string;
  content: string | null;
  user_id: string | null;
}

/** リード添付ファイル */
export interface LeadFile extends BaseRow {
  lead_id: string;
  name: string;
  url: string;
  file_type: string | null;
  size: number | null;
  uploaded_by: string | null;
}

/** 商品マスタ */
export interface ProductMaster extends BaseRow {
  name: string;
  sku: string | null;
  category: string | null;
  unit_price: number | null;
  currency: Currency;
  description: string | null;
  image_url: string | null;
  owner_id: string | null;
}

/** 生成書類（見積書・請求書） */
export interface GeneratedDocument extends BaseRow {
  type: 'quotation' | 'invoice';
  deal_id: string | null;
  account_id: string | null;
  doc_number: string;
  data: Record<string, unknown>;
  pdf_url: string | null;
  created_by: string | null;
}

/** 会社設定 */
export interface CompanySettings {
  id: string;
  key: string;
  value: string;
  updated_at: string;
}

/** 為替レート */
export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  updated_at: string;
}

/** 配送設定 */
export interface ShippingSettings {
  id: string;
  key: string;
  value: string;
}

/** 配送ゾーン */
export interface ShippingZone extends BaseRow {
  name: string;
  countries: string[];
}

/** 配送料金 */
export interface ShippingRate extends BaseRow {
  zone_id: string;
  shipping_type: ShippingType;
  weight_min: number;
  weight_max: number;
  price: number;
  currency: Currency;
}

/** 銀行口座 */
export interface BankAccount extends BaseRow {
  name: string;
  bank_name: string;
  branch: string | null;
  account_number: string;
  account_type: string | null;
  swift_code: string | null;
  owner_id: string | null;
}

/** ひとこと履歴 */
export interface HitokotoHistory {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}
