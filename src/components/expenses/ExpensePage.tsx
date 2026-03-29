// ============================================
// GS Sales CRM - Expense Page
// 経費管理（一覧・追加・編集・削除）
// ============================================

import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, shortName, fmt, fmtYen, EXPENSE_CATEGORIES_DEFAULT, AMAZON_REGIONS } from '@/lib/constants';

// ── Constants ──

const METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'] as const;
const TAX_CATEGORIES = ['課税10%', '課税8%', '非課税', '不課税'] as const;
const RECEIPT_OCR_URL = 'https://yzwrumeukjidsguixqxr.supabase.co/functions/v1/receipt-ocr';

const CATEGORY_COLORS: Record<string, string> = {
  BtoB: '#1a1a1a',
  Amazon: '#ff9900',
  Shopee: '#ee4d2d',
  KG: '#2d8cf0',
  '雑費': '#999',
  '会議費・交際費': '#7c3aed',
  '交通費': '#059669',
  '送料・物流費': '#d97706',
  'その他': '#6b7280',
};

// ── Types ──

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
}

interface Expense {
  id: string;
  user_id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
  // extended fields stored in the row or via metadata
  product_name?: string;
  payment_method?: string;
  purchase_location?: string;
  tax_category?: string;
  memo?: string;
  btob_splits?: any[];
  amazon_splits?: any[];
  account_id?: string | null;
  region?: string | null;
}

interface FormState {
  id: string | null;
  category: string;
  product_name: string;
  payment_method: string;
  amount: string;
  receipt_url: string;
  memo: string;
  purchase_location: string;
  expense_date: string;
  tax_category: string;
  user_id: string;
  btob_splits: any[];
  amazon_splits: any[];
}

const emptyForm = (userId: string): FormState => ({
  id: null,
  category: 'BtoB',
  product_name: '',
  payment_method: 'Amex',
  amount: '',
  receipt_url: '',
  memo: '',
  purchase_location: '',
  expense_date: new Date().toISOString().slice(0, 10),
  tax_category: '課税10%',
  user_id: userId,
  btob_splits: [{ account_id: '', amount: '' }],
  amazon_splits: [{ region: 'USA', amount: '' }],
});

// ── Component ──

export function ExpensePage({ client, user, allUsers, accounts }: Props) {
  const toast = useToast();

  // ── List state ──
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([...EXPENSE_CATEGORIES_DEFAULT]);

  // ── Filter state ──
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(user.id));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // ── Load data ──

  useEffect(() => {
    loadExpenses();
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth]);

  async function loadExpenses() {
    setLoading(true);
    try {
      const startDate = `${filterMonth}-01`;
      const endDate = filterMonth + '-31'; // safe overshooting

      let query = client
        .from('expenses')
        .select('*')
        .is('deleted_at', null)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err: any) {
      toast(err.message || '経費の読み込みに失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await client
        .from('company_settings')
        .select('value')
        .eq('key', 'expense_categories')
        .single();
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
          }
        } catch {
          // keep defaults
        }
      }
    } catch {
      // keep defaults
    }
  }

  // ── Filtered expenses ──

  const filtered = expenses.filter(exp => {
    if (filterUser !== 'all' && exp.user_id !== filterUser) return false;
    if (filterCategory !== 'all' && exp.category !== filterCategory) return false;
    return true;
  });

  const monthlyTotal = filtered.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // ── Form helpers ──

  function openNewForm() {
    setForm(emptyForm(user.id));
    setShowForm(true);
  }

  function openEditForm(exp: Expense) {
    setForm({
      id: exp.id,
      category: exp.category || 'BtoB',
      product_name: exp.product_name || exp.description || '',
      payment_method: exp.payment_method || 'Amex',
      amount: String(exp.amount || ''),
      receipt_url: exp.receipt_url || '',
      memo: exp.memo || exp.notes || '',
      purchase_location: exp.purchase_location || '',
      expense_date: exp.date || new Date().toISOString().slice(0, 10),
      tax_category: exp.tax_category || '課税10%',
      user_id: exp.user_id || user.id,
      btob_splits: exp.btob_splits?.length ? exp.btob_splits : [{ account_id: '', amount: '' }],
      amazon_splits: exp.amazon_splits?.length ? exp.amazon_splits : [{ region: 'USA', amount: '' }],
    });
    setShowForm(true);
  }

  function updateForm(key: keyof FormState, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // ── BtoB splits ──

  function addBtobSplit() {
    setForm(prev => ({
      ...prev,
      btob_splits: [...prev.btob_splits, { account_id: '', amount: '' }],
    }));
  }

  function removeBtobSplit(idx: number) {
    setForm(prev => ({
      ...prev,
      btob_splits: prev.btob_splits.filter((_: any, i: number) => i !== idx),
    }));
  }

  function updateBtobSplit(idx: number, field: string, value: string) {
    setForm(prev => ({
      ...prev,
      btob_splits: prev.btob_splits.map((s: any, i: number) =>
        i === idx ? { ...s, [field]: value } : s,
      ),
    }));
  }

  // ── Amazon splits ──

  function addAmazonSplit() {
    setForm(prev => ({
      ...prev,
      amazon_splits: [...prev.amazon_splits, { region: 'USA', amount: '' }],
    }));
  }

  function removeAmazonSplit(idx: number) {
    setForm(prev => ({
      ...prev,
      amazon_splits: prev.amazon_splits.filter((_: any, i: number) => i !== idx),
    }));
  }

  function updateAmazonSplit(idx: number, field: string, value: string) {
    setForm(prev => ({
      ...prev,
      amazon_splits: prev.amazon_splits.map((s: any, i: number) =>
        i === idx ? { ...s, [field]: value } : s,
      ),
    }));
  }

  // ── Receipt upload ──

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `receipts/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await client.storage
        .from('expenses')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = client.storage.from('expenses').getPublicUrl(path);
      const publicUrl = urlData?.publicUrl || '';
      updateForm('receipt_url', publicUrl);
      toast('レシート画像をアップロードしました');
    } catch (err: any) {
      toast(err.message || 'アップロードに失敗しました', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Receipt OCR ──

  async function runReceiptOCR() {
    if (!form.receipt_url) {
      toast('先にレシート画像をアップロードしてください', 'warn');
      return;
    }
    setOcrLoading(true);
    try {
      const { data: { session } } = await client.auth.getSession();
      const token = session?.access_token || '';

      const res = await fetch(RECEIPT_OCR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image_url: form.receipt_url }),
      });

      if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
      const result = await res.json();

      if (result.amount) updateForm('amount', String(result.amount));
      if (result.date) updateForm('expense_date', result.date);
      if (result.store || result.vendor) updateForm('purchase_location', result.store || result.vendor);
      if (result.description || result.product) updateForm('product_name', result.description || result.product);

      toast('OCR結果を反映しました');
    } catch (err: any) {
      toast(err.message || 'OCR処理に失敗しました', 'error');
    } finally {
      setOcrLoading(false);
    }
  }

  // ── Save expense ──

  async function handleSave() {
    if (!form.product_name.trim()) {
      toast('品名を入力してください', 'warn');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('金額を正しく入力してください', 'warn');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        user_id: form.user_id,
        date: form.expense_date,
        category: form.category,
        description: form.product_name,
        product_name: form.product_name,
        amount: amt,
        receipt_url: form.receipt_url || null,
        notes: form.memo || null,
        memo: form.memo || null,
        payment_method: form.payment_method,
        purchase_location: form.purchase_location || null,
        tax_category: form.tax_category,
      };

      // Attach splits for BtoB
      if (form.category === 'BtoB') {
        const validSplits = form.btob_splits.filter(
          (s: any) => s.account_id && s.amount,
        );
        if (validSplits.length > 0) {
          payload.btob_splits = validSplits.map((s: any) => ({
            account_id: s.account_id,
            amount: parseFloat(s.amount) || 0,
          }));
        }
      }

      // Attach splits for Amazon
      if (form.category === 'Amazon') {
        const validSplits = form.amazon_splits.filter(
          (s: any) => s.region && s.amount,
        );
        if (validSplits.length > 0) {
          payload.amazon_splits = validSplits.map((s: any) => ({
            region: s.region,
            amount: parseFloat(s.amount) || 0,
          }));
        }
      }

      if (form.id) {
        // Update
        const { error } = await client
          .from('expenses')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
        toast('経費を更新しました');
      } else {
        // Insert
        const { error } = await client
          .from('expenses')
          .insert(payload);
        if (error) throw error;
        toast('経費を追加しました');
      }

      setShowForm(false);
      loadExpenses();
    } catch (err: any) {
      toast(err.message || '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete expense ──

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await client
        .from('expenses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast('経費を削除しました');
      setDeleteTarget(null);
      loadExpenses();
    } catch (err: any) {
      toast(err.message || '削除に失敗しました', 'error');
    }
  }

  // ── Helpers ──

  function getUserName(userId: string): string {
    const u = allUsers.find(u => u.id === userId);
    return u ? shortName(u) : '-';
  }

  function getCategoryColor(cat: string): string {
    return CATEGORY_COLORS[cat] || '#6b7280';
  }

  // ── Styles ──

  const S = {
    page: {
      padding: 20,
      maxWidth: 960,
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } as React.CSSProperties,
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      flexWrap: 'wrap' as const,
      gap: 8,
    } as React.CSSProperties,
    title: {
      fontSize: 20,
      fontWeight: 700,
      color: T.primary,
      margin: 0,
    } as React.CSSProperties,
    addBtn: {
      padding: '8px 16px',
      background: T.primary,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    } as React.CSSProperties,
    filterRow: {
      display: 'flex',
      gap: 8,
      marginBottom: 12,
      flexWrap: 'wrap' as const,
      alignItems: 'center',
    } as React.CSSProperties,
    select: {
      padding: '6px 10px',
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 12,
      background: '#fff',
      color: T.primary,
    } as React.CSSProperties,
    monthInput: {
      padding: '6px 10px',
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 12,
      background: '#fff',
      color: T.primary,
    } as React.CSSProperties,
    totalBar: {
      padding: '10px 14px',
      background: T.bg,
      borderRadius: 8,
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 13,
    } as React.CSSProperties,
    list: {
      background: '#fff',
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      overflow: 'hidden',
    } as React.CSSProperties,
    row: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      borderBottom: `1px solid ${T.borderLight}`,
      cursor: 'pointer',
      transition: 'background .15s',
    } as React.CSSProperties,
    badge: (color: string) => ({
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      color: '#fff',
      background: color,
      whiteSpace: 'nowrap' as const,
    }),
    userBadge: {
      display: 'inline-block',
      padding: '2px 6px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      color: T.sub,
      background: T.bg,
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    // Form styles
    overlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.4)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: 40,
      overflowY: 'auto' as const,
    } as React.CSSProperties,
    formCard: {
      background: '#fff',
      borderRadius: 12,
      width: '90%',
      maxWidth: 540,
      maxHeight: '85vh',
      overflowY: 'auto' as const,
      padding: 24,
      boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
    } as React.CSSProperties,
    formTitle: {
      fontSize: 16,
      fontWeight: 700,
      marginBottom: 16,
      color: T.primary,
    } as React.CSSProperties,
    field: {
      marginBottom: 12,
    } as React.CSSProperties,
    label: {
      display: 'block',
      fontSize: 11,
      fontWeight: 600,
      color: T.sub,
      marginBottom: 4,
    } as React.CSSProperties,
    input: {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 13,
      boxSizing: 'border-box' as const,
      color: T.primary,
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 13,
      boxSizing: 'border-box' as const,
      minHeight: 60,
      resize: 'vertical' as const,
      color: T.primary,
    } as React.CSSProperties,
    formSelect: {
      width: '100%',
      padding: '8px 10px',
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 13,
      boxSizing: 'border-box' as const,
      background: '#fff',
      color: T.primary,
    } as React.CSSProperties,
    splitRow: {
      display: 'flex',
      gap: 6,
      alignItems: 'center',
      marginBottom: 6,
    } as React.CSSProperties,
    splitBtn: {
      padding: '4px 10px',
      fontSize: 11,
      border: `1px solid ${T.border}`,
      borderRadius: 4,
      background: '#fff',
      cursor: 'pointer',
      color: T.sub,
    } as React.CSSProperties,
    btnRow: {
      display: 'flex',
      gap: 8,
      marginTop: 16,
    } as React.CSSProperties,
    saveBtn: {
      flex: 1,
      padding: '10px 0',
      background: T.primary,
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    } as React.CSSProperties,
    cancelBtn: {
      flex: 1,
      padding: '10px 0',
      background: '#fff',
      color: T.sub,
      border: `1px solid ${T.border}`,
      borderRadius: 6,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    } as React.CSSProperties,
    deleteBtn: {
      padding: '4px 8px',
      fontSize: 11,
      color: T.red,
      background: 'none',
      border: `1px solid ${T.red}`,
      borderRadius: 4,
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    } as React.CSSProperties,
    // Delete modal
    modalOverlay: {
      position: 'fixed' as const,
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    modalCard: {
      background: '#fff',
      borderRadius: 10,
      padding: 24,
      width: '90%',
      maxWidth: 360,
      textAlign: 'center' as const,
    } as React.CSSProperties,
  };

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={S.title}>経費管理</h2>
        <button style={S.addBtn} onClick={openNewForm}>
          + 経費を追加
        </button>
      </div>

      {/* Filters */}
      <div style={S.filterRow}>
        <input
          type="month"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={S.monthInput}
        />
        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          style={S.select}
        >
          <option value="all">全ユーザー</option>
          {allUsers.map(u => (
            <option key={u.id} value={u.id}>
              {shortName(u)}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          style={S.select}
        >
          <option value="all">全カテゴリ</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly total */}
      <div style={S.totalBar}>
        <span style={{ color: T.sub }}>
          {filterMonth} 合計（{filtered.length}件）
        </span>
        <span style={{ fontWeight: 700, fontSize: 16, color: T.primary }}>
          {fmtYen(monthlyTotal)}
        </span>
      </div>

      {/* Expense list */}
      <div style={S.list}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>
            読み込み中...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 13 }}>
            経費データがありません
          </div>
        ) : (
          filtered.map(exp => (
            <div
              key={exp.id}
              style={S.row}
              onClick={() => openEditForm(exp)}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = T.hover)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '')}
            >
              {/* Date */}
              <span style={{ fontSize: 11, color: T.muted, minWidth: 56, whiteSpace: 'nowrap' }}>
                {fmt(exp.date)}
              </span>

              {/* Category badge */}
              <span style={S.badge(getCategoryColor(exp.category))}>
                {exp.category}
              </span>

              {/* Product info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {exp.product_name || exp.description || '-'}
                </div>
                {(exp.memo || exp.notes || exp.purchase_location) && (
                  <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[exp.purchase_location, exp.memo || exp.notes].filter(Boolean).join(' / ')}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div style={{ fontWeight: 700, fontSize: 14, color: T.primary, whiteSpace: 'nowrap' }}>
                {fmtYen(exp.amount)}
              </div>

              {/* User badge */}
              <span style={S.userBadge}>
                {getUserName(exp.user_id)}
              </span>

              {/* Receipt icon */}
              {exp.receipt_url && (
                <a
                  href={exp.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 16, textDecoration: 'none' }}
                  title="レシート"
                >
                  📎
                </a>
              )}

              {/* Delete button */}
              <button
                style={S.deleteBtn}
                onClick={e => {
                  e.stopPropagation();
                  setDeleteTarget(exp);
                }}
              >
                削除
              </button>
            </div>
          ))
        )}
      </div>

      {/* ─── Add / Edit Form Modal ─── */}
      {showForm && (
        <div style={S.overlay} onClick={() => setShowForm(false)}>
          <div style={S.formCard} onClick={e => e.stopPropagation()}>
            <div style={S.formTitle}>
              {form.id ? '経費を編集' : '経費を追加'}
            </div>

            {/* Category */}
            <div style={S.field}>
              <label style={S.label}>カテゴリ</label>
              <select
                style={S.formSelect}
                value={form.category}
                onChange={e => updateForm('category', e.target.value)}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Product name */}
            <div style={S.field}>
              <label style={S.label}>品名</label>
              <input
                style={S.input}
                value={form.product_name}
                onChange={e => updateForm('product_name', e.target.value)}
                placeholder="品名を入力"
              />
            </div>

            {/* Payment method */}
            <div style={S.field}>
              <label style={S.label}>支払方法</label>
              <select
                style={S.formSelect}
                value={form.payment_method}
                onChange={e => updateForm('payment_method', e.target.value)}
              >
                {METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div style={S.field}>
              <label style={S.label}>金額 (円)</label>
              <input
                style={S.input}
                type="number"
                value={form.amount}
                onChange={e => updateForm('amount', e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Expense date */}
            <div style={S.field}>
              <label style={S.label}>経費日</label>
              <input
                style={S.input}
                type="date"
                value={form.expense_date}
                onChange={e => updateForm('expense_date', e.target.value)}
              />
            </div>

            {/* Tax category */}
            <div style={S.field}>
              <label style={S.label}>税区分</label>
              <select
                style={S.formSelect}
                value={form.tax_category}
                onChange={e => updateForm('tax_category', e.target.value)}
              >
                {TAX_CATEGORIES.map(tc => (
                  <option key={tc} value={tc}>{tc}</option>
                ))}
              </select>
            </div>

            {/* Purchase location */}
            <div style={S.field}>
              <label style={S.label}>購入先</label>
              <input
                style={S.input}
                value={form.purchase_location}
                onChange={e => updateForm('purchase_location', e.target.value)}
                placeholder="購入先を入力"
              />
            </div>

            {/* Memo */}
            <div style={S.field}>
              <label style={S.label}>メモ</label>
              <textarea
                style={S.textarea}
                value={form.memo}
                onChange={e => updateForm('memo', e.target.value)}
                placeholder="メモを入力"
              />
            </div>

            {/* User (admin can assign) */}
            <div style={S.field}>
              <label style={S.label}>担当者</label>
              <select
                style={S.formSelect}
                value={form.user_id}
                onChange={e => updateForm('user_id', e.target.value)}
              >
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {shortName(u)}
                  </option>
                ))}
              </select>
            </div>

            {/* Receipt upload */}
            <div style={S.field}>
              <label style={S.label}>レシート画像</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptUpload}
                  style={{ fontSize: 12 }}
                />
                {uploading && (
                  <span style={{ fontSize: 11, color: T.muted }}>アップロード中...</span>
                )}
              </div>
              {form.receipt_url && (
                <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a
                    href={form.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: T.accent }}
                  >
                    📎 レシートを表示
                  </a>
                  <button
                    type="button"
                    style={{
                      ...S.splitBtn,
                      color: ocrLoading ? T.muted : T.accent,
                      borderColor: T.accent,
                    }}
                    onClick={runReceiptOCR}
                    disabled={ocrLoading}
                  >
                    {ocrLoading ? 'OCR処理中...' : 'OCR読取'}
                  </button>
                </div>
              )}
            </div>

            {/* BtoB splits */}
            {form.category === 'BtoB' && (
              <div style={S.field}>
                <label style={S.label}>BtoB 内訳（取引先 / 金額）</label>
                {form.btob_splits.map((split: any, idx: number) => (
                  <div key={idx} style={S.splitRow}>
                    <select
                      style={{ ...S.formSelect, flex: 1 }}
                      value={split.account_id}
                      onChange={e => updateBtobSplit(idx, 'account_id', e.target.value)}
                    >
                      <option value="">取引先を選択</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <input
                      style={{ ...S.input, width: 100, flex: 'none' }}
                      type="number"
                      value={split.amount}
                      onChange={e => updateBtobSplit(idx, 'amount', e.target.value)}
                      placeholder="金額"
                    />
                    {form.btob_splits.length > 1 && (
                      <button
                        type="button"
                        style={{ ...S.splitBtn, color: T.red, borderColor: T.red }}
                        onClick={() => removeBtobSplit(idx)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" style={S.splitBtn} onClick={addBtobSplit}>
                  + 内訳を追加
                </button>
              </div>
            )}

            {/* Amazon splits */}
            {form.category === 'Amazon' && (
              <div style={S.field}>
                <label style={S.label}>Amazon 内訳（リージョン / 金額）</label>
                {form.amazon_splits.map((split: any, idx: number) => (
                  <div key={idx} style={S.splitRow}>
                    <select
                      style={{ ...S.formSelect, flex: 1 }}
                      value={split.region}
                      onChange={e => updateAmazonSplit(idx, 'region', e.target.value)}
                    >
                      {AMAZON_REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <input
                      style={{ ...S.input, width: 100, flex: 'none' }}
                      type="number"
                      value={split.amount}
                      onChange={e => updateAmazonSplit(idx, 'amount', e.target.value)}
                      placeholder="金額"
                    />
                    {form.amazon_splits.length > 1 && (
                      <button
                        type="button"
                        style={{ ...S.splitBtn, color: T.red, borderColor: T.red }}
                        onClick={() => removeAmazonSplit(idx)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" style={S.splitBtn} onClick={addAmazonSplit}>
                  + 内訳を追加
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div style={S.btnRow}>
              <button
                style={S.cancelBtn}
                onClick={() => setShowForm(false)}
              >
                キャンセル
              </button>
              <button
                style={{ ...S.saveBtn, opacity: saving ? 0.6 : 1 }}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '保存中...' : form.id ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteTarget && (
        <div style={S.modalOverlay} onClick={() => setDeleteTarget(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: T.primary }}>
              経費を削除しますか？
            </div>
            <div style={{ fontSize: 13, color: T.sub, marginBottom: 8 }}>
              {deleteTarget.product_name || deleteTarget.description || '-'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.red, marginBottom: 16 }}>
              {fmtYen(deleteTarget.amount)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.cancelBtn}
                onClick={() => setDeleteTarget(null)}
              >
                キャンセル
              </button>
              <button
                style={{ ...S.saveBtn, background: T.red }}
                onClick={handleDelete}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
