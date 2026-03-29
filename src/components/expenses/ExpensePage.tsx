// ============================================
// GS Sales CRM - Expense Page
// 経費管理（一覧・追加・編集・削除）
// Converted from web/index.html ExpensePage
// ============================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, shortName, fmt, fmtYen, exportCSV, EXPENSE_CATEGORIES_DEFAULT, AMAZON_REGIONS, IS_MOBILE } from '@/lib/constants';

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
}

export function ExpensePage({ client, user, allUsers, accounts }: Props) {
  const toast = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterUser, setFilterUser] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  });
  const [categories, setCategories] = useState<string[]>([...EXPENSE_CATEGORIES_DEFAULT]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);

  // Form state
  const [fCategory, setFCategory] = useState('BtoB');
  const [fProduct, setFProduct] = useState('');
  const [fMethod, setFMethod] = useState('Amex');
  const [fCustomMethod, setFCustomMethod] = useState('');
  const [fCustomCategory, setFCustomCategory] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fAmountDisplay, setFAmountDisplay] = useState('');
  const [fReceipt, setFReceipt] = useState<File | null>(null);
  const [fReceiptPreview, setFReceiptPreview] = useState<string | null>(null);
  const [fMemo, setFMemo] = useState('');
  const [fPurchaseLocation, setFPurchaseLocation] = useState('');
  const [fExpenseDate, setFExpenseDate] = useState(() => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  });
  const [fTaxCategory, setFTaxCategory] = useState('課税10%');
  const [fErr, setFErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // BtoB splits: [{accountId,accountName,amount,amountDisplay,search}]
  const [fSplits, setFSplits] = useState<any[]>([{ accountId: '', accountName: '', amount: '', amountDisplay: '', search: '' }]);
  // Amazon splits: [{region,amount,amountDisplay}]
  const [fAmazonSplits, setFAmazonSplits] = useState<any[]>([{ region: 'USA', amount: '', amountDisplay: '' }]);
  const receiptRef = useRef<HTMLInputElement>(null);

  const METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'];

  // ── レシートOCR ──
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const ocrConfigRef = useRef<any>(null);

  useEffect(() => {
    if (!client) return;
    (async () => {
      const { data } = await client.from('company_settings').select('*').eq('key', 'receipt_ocr_config').limit(1);
      if (data && data[0]) {
        try { ocrConfigRef.current = JSON.parse(data[0].value); } catch (e) { /* ignore */ }
      }
    })();
  }, [client]);

  const runReceiptOCR = async (file: File) => {
    const cfg = ocrConfigRef.current;
    if (!cfg || !cfg.enabled || !cfg.api_key) return;
    const isImage = file.type?.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    if (!isImage && !isPdf) return; // 画像またはPDFのみ
    setOcrLoading(true); setOcrStatus('AI読取中...');
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const mediaType = file.type || 'image/jpeg';
      // Supabase Edge Function経由でClaude APIを呼び出し（CORS回避）
      const edgeFnUrl = 'https://yzwrumeukjidsguixqxr.supabase.co/functions/v1/receipt-ocr';
      const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTcyMzAsImV4cCI6MjA4OTYzMzIzMH0.8KxvbsRnTXJsfB81PSfvszF6RMS5_S_9GoWkV10_41g';
      const resp = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY },
        body: JSON.stringify({ image_base64: b64, media_type: mediaType, api_key: cfg.api_key, categories: categories })
      });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.error || 'API error ' + resp.status); }
      const result = await resp.json();
      const text = (result.content || []).find((c: any) => c.type === 'text')?.text || '';
      // JSONを抽出（コードブロック対応）
      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      // 自動入力（BtoBの取引先は自動入力しない）
      if (parsed.category && categories.includes(parsed.category)) {
        setFCategory(parsed.category);
        setFSplits([{ accountId: '', accountName: '', amount: '', amountDisplay: '', search: '' }]);
        setFAmazonSplits([{ region: 'USA', amount: '', amountDisplay: '' }]);
      }
      if (parsed.purchase_location) setFPurchaseLocation(parsed.purchase_location);
      if (parsed.product) setFProduct(parsed.product);
      if (parsed.amount) {
        const a = String(Math.round(Number(parsed.amount)));
        setFAmount(a);
        setFAmountDisplay(Number(a).toLocaleString());
      }
      if (parsed.expense_date) setFExpenseDate(parsed.expense_date);
      if (parsed.tax_category) setFTaxCategory(parsed.tax_category);
      setOcrStatus('読取完了！ 内容を確認してください');
    } catch (e: any) {
      console.error('OCR error:', e);
      setOcrStatus('読取エラー: ' + e.message);
    } finally {
      setOcrLoading(false);
      setTimeout(() => setOcrStatus(''), 5000);
    }
  };

  const formatAmt = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    setFAmount(num);
    setFAmountDisplay(num ? Number(num).toLocaleString() : '');
  };
  const formatSplitAmt = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    return { amount: num, amountDisplay: num ? Number(num).toLocaleString() : '' };
  };

  const loadExpenses = useCallback(async () => {
    if (!client) return;
    const { data } = await client.from('expenses').select('*').order('created_at', { ascending: false });
    if (data) setExpenses(data);
    const { data: cs } = await client.from('company_settings').select('*').eq('key', 'expense_categories');
    if (cs && cs[0] && cs[0].value) {
      try { const arr = JSON.parse(cs[0].value); if (Array.isArray(arr)) setCategories(arr); } catch (e) { /* ignore */ }
    }
    setLoading(false);
  }, [client]);
  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  const saveCategories = async (cats: string[]) => {
    setCategories(cats);
    const val = JSON.stringify(cats);
    const { data: existing } = await client.from('company_settings').select('id').eq('key', 'expense_categories').limit(1);
    if (existing && existing.length > 0) {
      await client.from('company_settings').update({ value: val }).eq('id', existing[0].id);
    } else {
      await client.from('company_settings').insert({ key: 'expense_categories', value: val });
    }
  };

  const handleReceipt = (file: File) => {
    if (!file) return;
    setFReceipt(file);
    if (file.type?.startsWith('image/')) {
      const r = new FileReader();
      r.onload = (e: any) => setFReceiptPreview(e.target.result);
      r.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setFReceiptPreview('pdf');
    } else {
      setFReceiptPreview(null);
    }
    // OCR自動読取
    runReceiptOCR(file);
  };

  const TAX_CATEGORIES = ['課税10%', '課税8%（軽減）', '非課税', '不課税', '免税', '対象外'];

  const resetForm = () => {
    setFCategory('BtoB'); setFProduct(''); setFMethod('Amex'); setFCustomMethod(''); setFCustomCategory('');
    setFAmount(''); setFAmountDisplay(''); setFReceipt(null); setFReceiptPreview(null);
    setFMemo(''); setFPurchaseLocation(''); setFTaxCategory('課税10%'); setFErr(''); setEditTarget(null);
    const n = new Date();
    setFExpenseDate(n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'));
    setFSplits([{ accountId: '', accountName: '', amount: '', amountDisplay: '', search: '' }]);
    setFAmazonSplits([{ region: 'USA', amount: '', amountDisplay: '' }]);
  };

  const openForm = (expense: any) => {
    resetForm();
    if (expense) {
      setEditTarget(expense);
      if (categories.includes(expense.category)) { setFCategory(expense.category); } else { setFCategory('その他'); setFCustomCategory(expense.category || ''); }
      setFProduct(expense.product || '');
      setFMethod(METHODS.includes(expense.method) ? expense.method : 'その他');
      if (!METHODS.includes(expense.method)) setFCustomMethod(expense.method || '');
      setFAmount(String(expense.amount || ''));
      setFAmountDisplay(expense.amount ? Number(expense.amount).toLocaleString() : '');
      setFMemo(expense.memo || '');
      setFPurchaseLocation(expense.purchase_location || '');
      setFExpenseDate(expense.expense_date || '');
      setFTaxCategory(expense.tax_category || '課税10%');
      // Load splits
      (async () => {
        const { data: items } = await client.from('expense_items').select('*').eq('expense_id', expense.id).order('sort_order');
        if (items && items.length > 0) {
          if (expense.category === 'BtoB') {
            setFSplits(items.map((it: any) => ({ accountId: it.account_id || '', accountName: it.vendor || '', amount: String(it.amount || ''), amountDisplay: it.amount ? Number(it.amount).toLocaleString() : '', search: it.vendor || '' })));
          } else if (expense.category === 'Amazon') {
            setFAmazonSplits(items.map((it: any) => ({ region: it.vendor || 'USA', amount: String(it.amount || ''), amountDisplay: it.amount ? Number(it.amount).toLocaleString() : '' })));
          }
        }
      })();
    }
    setShowForm(true);
  };

  const buildItemRows = (expenseId: string) => {
    if (fCategory === 'BtoB' && fSplits.length >= 1) {
      return fSplits.map((sp: any, i: number) => ({
        expense_id: expenseId, category: 'BtoB', vendor: sp.accountName, account_id: sp.accountId || null,
        product: fProduct.trim(), amount: fSplits.length === 1 ? Number(fAmount) : Number(sp.amount), sort_order: i
      }));
    }
    if (fCategory === 'Amazon' && fAmazonSplits.length > 1) {
      return fAmazonSplits.map((sp: any, i: number) => ({
        expense_id: expenseId, category: 'Amazon', vendor: 'Amazon ' + sp.region, account_id: null,
        product: fProduct.trim(), amount: Number(sp.amount), sort_order: i
      }));
    }
    return [];
  };

  const submit = async () => {
    if (!fExpenseDate) { setFErr('発生日を入力してください'); return; }
    if (!fPurchaseLocation.trim()) { setFErr('購入先を入力してください'); return; }
    if (!fProduct.trim()) { setFErr('商品を入力してください'); return; }
    if (!fAmount || Number(fAmount) <= 0) { setFErr('金額を正しく入力してください'); return; }
    // Validate BtoB splits
    if (fCategory === 'BtoB') {
      for (let i = 0; i < fSplits.length; i++) {
        if (!fSplits[i].accountId && !fSplits[i].accountName) { setFErr('取引先' + (i + 1) + 'を選択してください'); return; }
      }
      if (fSplits.length > 1) {
        const splitTotal = fSplits.reduce((s: number, sp: any) => s + (Number(sp.amount) || 0), 0);
        if (splitTotal !== Number(fAmount)) { setFErr('内訳の合計（¥' + splitTotal.toLocaleString() + '）が合計金額（¥' + Number(fAmount).toLocaleString() + '）と一致しません'); return; }
      }
    }
    // Validate Amazon splits
    if (fCategory === 'Amazon' && fAmazonSplits.length > 1) {
      const splitTotal = fAmazonSplits.reduce((s: number, sp: any) => s + (Number(sp.amount) || 0), 0);
      if (splitTotal !== Number(fAmount)) { setFErr('内訳の合計（¥' + splitTotal.toLocaleString() + '）が合計金額（¥' + Number(fAmount).toLocaleString() + '）と一致しません'); return; }
    }
    setSaving(true); setFErr('');
    try {
      let receiptUrl: string | null = null, receiptName: string | null = null;
      if (fReceipt) {
        const ext = fReceipt.name.split('.').pop();
        const fp = 'receipts/expenses/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
        const { error: upErr } = await client.storage.from('chat-files').upload(fp, fReceipt);
        if (!upErr) { const { data: u } = client.storage.from('chat-files').getPublicUrl(fp); receiptUrl = u?.publicUrl || null; receiptName = fReceipt.name; }
      }
      const finalMethod = fMethod === 'その他' ? (fCustomMethod.trim() || 'その他') : fMethod;
      const finalCategory = fCategory === 'その他' ? (fCustomCategory.trim() || 'その他') : fCategory;
      // Build vendor string
      let vendorStr = '';
      if (fCategory === 'BtoB') {
        vendorStr = fSplits.map((sp: any) => sp.accountName || '').filter(Boolean).join(', ');
      } else if (fCategory === 'Amazon') {
        vendorStr = fAmazonSplits.length > 1 ? fAmazonSplits.map((sp: any) => 'Amazon ' + sp.region).join(', ') : 'Amazon';
      } else {
        vendorStr = finalCategory;
      }

      if (editTarget) {
        const updates: any = { category: finalCategory, vendor: vendorStr, product: fProduct.trim(), method: finalMethod, amount: Number(fAmount), memo: fMemo.trim() || null, purchase_location: fPurchaseLocation.trim() || null, expense_date: fExpenseDate || null, tax_category: fTaxCategory || null };
        if (receiptUrl) { updates.receipt_url = receiptUrl; updates.receipt_name = receiptName; }
        const { error: e1 } = await client.from('expenses').update(updates).eq('id', editTarget.id);
        if (e1) throw e1;
        // Replace items
        const { error: e2 } = await client.from('expense_items').delete().eq('expense_id', editTarget.id);
        if (e2) throw e2;
        const itemRows = buildItemRows(editTarget.id);
        if (itemRows.length > 0) {
          const { error: e3 } = await client.from('expense_items').insert(itemRows);
          if (e3) throw e3;
        }
      } else {
        const expRow: any = { user_id: user.id, category: finalCategory, vendor: vendorStr, product: fProduct.trim(), method: finalMethod, amount: Number(fAmount), memo: fMemo.trim() || null, receipt_url: receiptUrl, receipt_name: receiptName, purchase_location: fPurchaseLocation.trim() || null, expense_date: fExpenseDate || null, tax_category: fTaxCategory || null };
        const { data: inserted } = await client.from('expenses').insert(expRow).select().single();
        if (inserted) {
          const itemRows = buildItemRows(inserted.id);
          if (itemRows.length > 0) await client.from('expense_items').insert(itemRows);
        }
      }
      setShowForm(false); resetForm(); loadExpenses();
    } catch (e: any) { setFErr(e.message); } finally { setSaving(false); }
  };

  const deleteExpense = async (id: string) => {
    await client.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    setDeleteTarget(null); loadExpenses();
  };

  const filtered = useMemo(() => {
    return expenses.filter((e: any) => {
      if (e.deleted_at) return false;
      if (filterUser !== 'all' && e.user_id !== filterUser) return false;
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterMonth) {
        const d = new Date(e.created_at);
        const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (ym !== filterMonth) return false;
      }
      return true;
    });
  }, [expenses, filterUser, filterCategory, filterMonth]);

  const listTotal = filtered.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const getUserName = (uid: string) => { const u = allUsers.find((x: any) => x.id === uid); return shortName(u); };
  const getUserInitial = (uid: string) => { const n = getUserName(uid); return (n || '?').charAt(0).toUpperCase(); };

  const I: any = { width: '100%', border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', fontSize: IS_MOBILE ? 16 : 13, outline: 'none', fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' as const };
  const L: any = { display: 'block', fontSize: 10.5, fontWeight: 600, color: T.muted, marginBottom: 3, marginTop: 10 };

  // ── BtoB Account Search ──
  const AcctSearch = ({ split, idx }: { split: any; idx: number }) => {
    const [q, setQ] = useState(split.search || split.accountName || '');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const accts = (accounts || []).filter((a: any) => !a.deleted_at);
    const matches = q.trim() ? accts.filter((a: any) => (a.name || '').toLowerCase().includes(q.toLowerCase())).slice(0, 8) : accts.slice(0, 8);
    useEffect(() => {
      const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);
    const select = (a: any) => {
      setFSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], accountId: a.id, accountName: a.name, search: a.name }; return n; });
      setQ(a.name); setOpen(false);
    };
    return (
      <div ref={ref} style={{ position: 'relative', flex: 1 }}>
        <input value={q} onChange={(e: any) => { setQ(e.target.value); setOpen(true); if (!e.target.value) { setFSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], accountId: '', accountName: '', search: '' }; return n; }); } }}
          onFocus={() => setOpen(true)} placeholder="取引先を検索..." style={{ ...I, paddingRight: 24 }} />
        {split.accountId && <button onClick={() => { setQ(''); setFSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], accountId: '', accountName: '', search: '' }; return n; }); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14 }}>×</button>}
        {open && matches.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 50, maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
            {matches.map((a: any) => (
              <div key={a.id} onClick={() => select(a)}
                style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', borderBottom: `1px solid ${T.borderLight}` }}
                onMouseEnter={(e: any) => e.currentTarget.style.background = T.hover} onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontWeight: 600, color: T.primary }}>{a.name}</span>
                {a.country && <span style={{ fontSize: 10, color: T.muted, marginLeft: 6 }}>{a.country}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Split row for BtoB ──
  const renderBtoBSplit = (sp: any, idx: number) => (
    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <AcctSearch split={sp} idx={idx} />
      {fSplits.length > 1 && <input value={sp.amountDisplay} onChange={(e: any) => { const { amount, amountDisplay } = formatSplitAmt(e.target.value); setFSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], amount, amountDisplay }; return n; }); }} placeholder="¥" style={{ ...I, width: 100, flex: 'none', fontWeight: 700, textAlign: 'right' as const }} inputMode="numeric" />}
      {fSplits.length > 1 && <button onClick={() => setFSplits((prev: any[]) => prev.filter((_: any, i: number) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, padding: '0 2px', flexShrink: 0 }} onMouseEnter={(e: any) => e.currentTarget.style.color = T.red} onMouseLeave={(e: any) => e.currentTarget.style.color = T.muted}>×</button>}
    </div>
  );

  // ── Split row for Amazon ──
  const renderAmazonSplit = (sp: any, idx: number) => (
    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <select value={sp.region} onChange={(e: any) => { setFAmazonSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], region: e.target.value }; return n; }); }} style={{ ...I, flex: 1 }}>
        {AMAZON_REGIONS.map((r: string) => (<option key={r} value={r}>{r}</option>))}
      </select>
      {fAmazonSplits.length > 1 && <input value={sp.amountDisplay} onChange={(e: any) => { const { amount, amountDisplay } = formatSplitAmt(e.target.value); setFAmazonSplits((prev: any[]) => { const n = [...prev]; n[idx] = { ...n[idx], amount, amountDisplay }; return n; }); }} placeholder="¥" style={{ ...I, width: 100, flex: 'none', fontWeight: 700, textAlign: 'right' as const }} inputMode="numeric" />}
      {fAmazonSplits.length > 1 && <button onClick={() => setFAmazonSplits((prev: any[]) => prev.filter((_: any, i: number) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14, padding: '0 2px', flexShrink: 0 }} onMouseEnter={(e: any) => e.currentTarget.style.color = T.red} onMouseLeave={(e: any) => e.currentTarget.style.color = T.muted}>×</button>}
    </div>
  );

  return (<div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
    {/* Header */}
    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>経費管理</span>
        <span style={{ fontSize: 11, color: T.muted }}>{filtered.length}件</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>¥{listTotal.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <input type="month" value={filterMonth} onChange={(e: any) => setFilterMonth(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit' }} />
        <select value={filterUser} onChange={(e: any) => setFilterUser(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit', background: '#fff' }}>
          <option value="all">全員</option>
          {allUsers.map((u: any) => (<option key={u.id} value={u.id}>{shortName(u)}</option>))}
        </select>
        <select value={filterCategory} onChange={(e: any) => setFilterCategory(e.target.value)} style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 11, fontFamily: 'inherit', background: '#fff' }}>
          <option value="all">全カテゴリ</option>
          {categories.map((c: string) => (<option key={c} value={c}>{c}</option>))}
        </select>
        <button onClick={() => {
          const hdrs = ['発生日', '報告日', 'カテゴリ', '購入先', '取引先', '摘要（商品）', '税区分', '支払方法', '金額（税込）', 'メモ', '報告者', 'レシート'];
          const rows = filtered.map((e: any) => {
            const d = new Date(e.created_at);
            const expDate = e.expense_date ? new Date(e.expense_date + 'T00:00:00').toLocaleDateString('ja-JP') : d.toLocaleDateString('ja-JP');
            return [expDate, d.toLocaleDateString('ja-JP'), e.category || '', e.purchase_location || '', e.vendor || '', e.product || '', e.tax_category || '課税10%', e.method || '', e.amount || 0, e.memo || '', getUserName(e.user_id), e.receipt_url ? 'あり' : ''];
          });
          exportCSV('経費精算_' + filterMonth + '.csv', hdrs, rows);
        }} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.card, color: T.sub, fontFamily: 'inherit' }}>CSV</button>
        <button onClick={() => openForm(null)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>+ 経費報告</button>
      </div>
    </div>

    {/* Expense List */}
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
      {loading && <div style={{ padding: 40, textAlign: 'center', color: T.muted }}>読み込み中...</div>}
      {!loading && filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 12 }}>経費報告がありません</div>}
      {filtered.map((e: any) => {
        const d = new Date(e.created_at);
        const dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        const isOwn = e.user_id === user.id;
        return (<div key={e.id} onClick={() => { if (isOwn) openForm(e); }} style={{ padding: '12px 14px', marginBottom: 6, background: T.card, borderRadius: 8, border: `1px solid ${T.borderLight}`, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: isOwn ? 'pointer' : 'default' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{getUserInitial(e.user_id)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.primary }}>{getUserName(e.user_id)}</span>
              <span style={{ fontSize: 10, color: T.muted }}>{e.expense_date ? new Date(e.expense_date + 'T00:00:00').toLocaleDateString('ja-JP') : dateStr}</span>
              <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9.5, fontWeight: 600, background: '#f3f3f3', color: T.sub }}>{e.category || 'その他'}</span>
              {e.tax_category && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 500, background: '#eef2ff', color: '#4f46e5' }}>{e.tax_category}</span>}
            </div>
            {e.purchase_location && <div style={{ fontSize: 12, color: T.primary, marginBottom: 2, fontWeight: 600 }}>🏪 {e.purchase_location}</div>}
            {e.vendor && e.vendor !== e.category && <div style={{ fontSize: 11, color: T.sub, marginBottom: 2 }}>{e.vendor}</div>}
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={e.product}>{e.product && e.product.length > 40 ? e.product.slice(0, 40) + '…' : e.product}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>¥{(e.amount || 0).toLocaleString()}</span>
              <span style={{ fontSize: 10, color: T.muted, background: '#f3f3f3', padding: '1px 6px', borderRadius: 4 }}>{e.method}</span>
              {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" onClick={(ev: any) => ev.stopPropagation()} style={{ fontSize: 10, color: T.accent, textDecoration: 'none' }}>レシート</a>}
            </div>
            {e.memo && <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{e.memo}</div>}
          </div>
          {isOwn && <button onClick={(ev: any) => { ev.stopPropagation(); setDeleteTarget(e); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 11, fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }} onMouseEnter={(ev: any) => ev.currentTarget.style.color = T.red} onMouseLeave={(ev: any) => ev.currentTarget.style.color = T.muted}>削除</button>}
        </div>);
      })}
    </div>

    {/* Form Modal */}
    {showForm && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: IS_MOBILE ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 200 }} onMouseDown={(e: any) => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
      <div style={{ background: '#fff', borderRadius: IS_MOBILE ? '16px 16px 0 0' : 10, padding: IS_MOBILE ? '20px 20px 28px' : '20px 24px', width: IS_MOBILE ? '100%' : '90%', maxWidth: IS_MOBILE ? 'none' : 440, maxHeight: IS_MOBILE ? '90vh' : '85vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.primary }}>経費報告{editTarget ? ' (編集)' : ''}</span>
          <button onClick={() => { setShowForm(false); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: T.muted }}>×</button>
        </div>

        {/* Receipt */}
        <label style={{ ...L, marginTop: 0 }}>レシート添付（任意）</label>
        <input type="file" ref={receiptRef} accept="image/*,.pdf" style={{ display: 'none' }} onChange={(e: any) => { const f = e.target.files?.[0]; if (f) handleReceipt(f); e.target.value = ''; }} />
        {!fReceipt && !editTarget?.receipt_url ? <div style={{ border: `2px dashed ${dragOver ? '#f59e0b' : T.border}`, borderRadius: 8, padding: IS_MOBILE ? '14px' : '10px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#fffbeb' : '#fafafa' }}
          onClick={() => receiptRef.current?.click()}
          onDragOver={(e: any) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onDrop={(e: any) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleReceipt(f); }}>
          <div style={{ fontSize: IS_MOBILE ? 13 : 11, color: T.muted }}>{IS_MOBILE ? 'タップして撮影 or 選択' : 'クリック or ドラッグ&ドロップ'}</div>
        </div>
        : <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
          {fReceiptPreview === 'pdf' ? <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ef4444', borderRadius: 4, color: '#fff', fontSize: 10, fontWeight: 700 }}>PDF</div>
           : fReceiptPreview ? <img src={fReceiptPreview} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />
           : editTarget?.receipt_url && editTarget.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? <img src={editTarget.receipt_url} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : null}
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fReceipt ? fReceipt.name : editTarget?.receipt_name || 'レシート'}</div>{fReceipt && <div style={{ fontSize: 10, color: T.muted }}>{(fReceipt.size / 1024).toFixed(0)} KB</div>}</div>
          <button onClick={() => { setFReceipt(null); setFReceiptPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 14 }}>×</button>
        </div>}

        {/* OCR Status */}
        {(ocrLoading || ocrStatus) && (
          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: ocrLoading ? '#eef2ff' : ocrStatus.includes('エラー') ? '#fef2f2' : '#ecfdf5', color: ocrLoading ? '#4f46e5' : ocrStatus.includes('エラー') ? '#dc2626' : '#059669', display: 'flex', alignItems: 'center', gap: 6 }}>
            {ocrLoading && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
            <span>{ocrStatus}</span>
          </div>
        )}

        {/* Category */}
        <label style={L}>カテゴリ *</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {categories.map((c: string) => (<button key={c} onClick={() => { setFCategory(c); if (c !== 'その他') setFCustomCategory(''); setFSplits([{ accountId: '', accountName: '', amount: '', amountDisplay: '', search: '' }]); setFAmazonSplits([{ region: 'USA', amount: '', amountDisplay: '' }]); }} style={{ padding: '4px 10px', borderRadius: 12, border: fCategory === c ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`, fontSize: 11, fontWeight: fCategory === c ? 600 : 400, cursor: 'pointer', background: fCategory === c ? T.primary : '#fff', color: fCategory === c ? '#fff' : T.sub, fontFamily: 'inherit' }}>{c}</button>))}
        </div>
        {fCategory === 'その他' && (<input value={fCustomCategory} onChange={(e: any) => setFCustomCategory(e.target.value)} placeholder="カテゴリ名を入力..." style={{ ...I, marginTop: 4 }} />)}

        {/* BtoB: vendor search + splits */}
        {fCategory === 'BtoB' && (<>
          <label style={L}>取引先 *</label>
          {fSplits.map((sp: any, i: number) => renderBtoBSplit(sp, i))}
          <button onClick={() => setFSplits((prev: any[]) => [...prev, { accountId: '', accountName: '', amount: '', amountDisplay: '', search: '' }])} style={{ fontSize: 10.5, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '2px 0', marginTop: 2 }}>+ 取引先を追加（複数社の場合）</button>
          {fSplits.length > 1 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>※ 各取引先の金額内訳を入力してください（合計と一致させる必要があります）</div>}
        </>)}

        {/* Amazon: region splits */}
        {fCategory === 'Amazon' && (<>
          <label style={L}>地域</label>
          {fAmazonSplits.map((sp: any, i: number) => renderAmazonSplit(sp, i))}
          <button onClick={() => setFAmazonSplits((prev: any[]) => [...prev, { region: 'USA', amount: '', amountDisplay: '' }])} style={{ fontSize: 10.5, color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '2px 0', marginTop: 2 }}>+ 地域を追加（複数地域の場合）</button>
          {fAmazonSplits.length > 1 && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>※ 各地域の金額内訳を入力してください（合計と一致させる必要があります）</div>}
        </>)}

        {/* Expense Date */}
        <label style={L}>発生日 *</label>
        <input type="date" value={fExpenseDate} onChange={(e: any) => setFExpenseDate(e.target.value)} style={I} />

        {/* Purchase Location */}
        <label style={L}>購入先（店名・サイト名） *</label>
        <input value={fPurchaseLocation} onChange={(e: any) => setFPurchaseLocation(e.target.value)} placeholder="例: ビックカメラ梅田店、Amazon.co.jp、セブンイレブン" style={I} />

        {/* Product */}
        <label style={L}>商品 *</label>
        <input value={fProduct} onChange={(e: any) => setFProduct(e.target.value)} placeholder="備品、交通費 etc." style={I} />

        {/* Payment Method */}
        <label style={L}>支払方法</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {METHODS.map((m: string) => (<button key={m} onClick={() => setFMethod(m)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: fMethod === m ? 600 : 400, border: fMethod === m ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`, background: fMethod === m ? T.primary + '10' : '#fff', color: fMethod === m ? T.primary : T.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{m}</button>))}
        </div>
        {fMethod === 'その他' && <input value={fCustomMethod} onChange={(e: any) => setFCustomMethod(e.target.value)} placeholder="支払方法を入力..." style={{ ...I, marginTop: 4 }} />}

        {/* Amount */}
        <label style={L}>金額 (円) *</label>
        <input value={fAmountDisplay} onChange={(e: any) => formatAmt(e.target.value)} placeholder="1,000" style={{ ...I, fontSize: IS_MOBILE ? 18 : 15, fontWeight: 700 }} inputMode="numeric" />

        {/* Tax Category */}
        <label style={L}>税区分</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TAX_CATEGORIES.map((tc: string) => (<button key={tc} onClick={() => setFTaxCategory(tc)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: fTaxCategory === tc ? 600 : 400, border: fTaxCategory === tc ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`, background: fTaxCategory === tc ? T.primary + '10' : '#fff', color: fTaxCategory === tc ? T.primary : T.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{tc}</button>))}
        </div>

        {/* Memo */}
        <label style={L}>メモ（任意）</label>
        <input value={fMemo} onChange={(e: any) => setFMemo(e.target.value)} placeholder="補足メモ..." style={I} />

        {fErr && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>{fErr}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={() => { setShowForm(false); resetForm(); }} style={{ flex: 1, padding: IS_MOBILE ? '12px' : '8px', border: 'none', borderRadius: 6, fontSize: IS_MOBILE ? 14 : 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: T.sub }}>キャンセル</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, padding: IS_MOBILE ? '12px' : '8px', border: 'none', borderRadius: 6, fontSize: IS_MOBILE ? 14 : 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: T.primary, color: '#fff', opacity: saving ? 0.5 : 1 }}>{saving ? '送信中...' : (editTarget ? '更新する' : '報告する')}</button>
        </div>
      </div>
    </div>)}

    {/* Delete confirm */}
    {deleteTarget && (<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', width: 340, boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.primary, marginBottom: 8 }}>経費報告を削除しますか？</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 4 }}>{deleteTarget.vendor} — {deleteTarget.product}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.primary, marginBottom: 12 }}>¥{(deleteTarget.amount || 0).toLocaleString()}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: T.sub }}>キャンセル</button>
          <button onClick={() => deleteExpense(deleteTarget.id)} style={{ flex: 1, padding: '7px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: T.red, color: '#fff' }}>削除</button>
        </div>
      </div>
    </div>)}
  </div>);
}
