// ============================================
// GS Sales CRM - Documents Page
// 書類メニュー（商品マスタ管理・見積書/請求書ビルダーリンク）
// Converted from web/index.html (2b40a9b) to TypeScript
// ============================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, AppUser } from '@/types/database';
import { T, IS_MOBILE, DEFAULT_JPY_RATE } from '@/lib/constants';
import { QuotationInvoiceBuilder } from './QuotationInvoiceBuilder';

// ── Types ──

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
}

type DocPage = 'menu' | 'quotation' | 'invoice' | 'delivery' | 'master';

// ── Component ──

export default function DocumentsPage({ client, user, allUsers, accounts, contacts, deals }: Props) {
  const BLUE = '#3b82f6';

  const [docPage, setDocPage] = useState<DocPage>('menu');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [origProduct, setOrigProduct] = useState<any>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [subBrands, setSubBrands] = useState<string[]>([]);
  const [saveErr, setSaveErr] = useState('');
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvData, setCsvData] = useState<any>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const LIMIT = 50;
  const searchTimer = useRef<any>(null);

  // Debounce search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchTerm]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError('');
    try {
      let q = client.from('product_master').select('*', { count: 'exact' }) as any;
      if (debouncedSearch) {
        const s = `%${debouncedSearch}%`;
        q = q.or(`name_ja.ilike.${s},name_en.ilike.${s},jan.ilike.${s},brand.ilike.${s}`);
      }
      if (filterBrand) q = q.eq('brand', filterBrand);
      if (filterStatus) q = q.eq('status', filterStatus);
      const { data, count, error: e } = await q.order('updated_at', { ascending: false }).range(currentPage * LIMIT, (currentPage + 1) * LIMIT - 1);
      if (e) throw e;
      setProducts(data || []);
      setTotalCount(count || 0);
    } catch (e: any) {
      setError(e.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [client, debouncedSearch, filterBrand, filterStatus, currentPage]);

  useEffect(() => {
    if (docPage === 'master') fetchProducts();
  }, [fetchProducts, docPage]);

  // Load brands, suppliers, subBrands
  useEffect(() => {
    if (!client || docPage !== 'master') return;
    const load = async (col: string, setter: (v: string[]) => void) => {
      const { data } = await client.from('product_master').select(col);
      if (data) {
        const u = [...new Set(data.map((r: any) => r[col]).filter(Boolean))].sort() as string[];
        setter(u);
      }
    };
    load('brand', setBrands);
    load('supplier', setSuppliers);
    load('sub_brand', setSubBrands);
  }, [client, docPage]);

  const openEdit = (p: any) => {
    const obj = p
      ? { ...p }
      : { name_ja: '', name_en: '', jan: '', brand: '', sub_brand: '', supplier: '', image_url: '', cost_price: null, list_price: null, selling_price: null, case_quantity: null, weight_g: null, price_break_qty: null, status: 'active', ingredients_en: '', is_discontinued: false };
    setEditProduct(obj);
    setOrigProduct(p ? { ...p } : null);
    setSaveErr('');
    setShowEdit(true);
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditProduct(null);
    setOrigProduct(null);
  };

  const saveProduct = async () => {
    setSaveErr('');
    if (!editProduct.name_ja && !editProduct.name_en) {
      setSaveErr('商品名(日本語または英語)は必須です');
      return;
    }
    if (!editProduct.jan) {
      setSaveErr('JANコードは必須です');
      return;
    }
    try {
      if (editProduct.id) {
        const updates: any = {};
        const auditEntries: any[] = [];
        const fields = ['name_ja', 'name_en', 'jan', 'brand', 'sub_brand', 'supplier', 'image_url', 'cost_price', 'list_price', 'selling_price', 'case_quantity', 'weight_g', 'price_break_qty', 'status', 'ingredients_en', 'is_discontinued'];
        fields.forEach(f => {
          if (JSON.stringify(editProduct[f]) !== JSON.stringify(origProduct[f])) {
            updates[f] = editProduct[f];
            auditEntries.push({
              product_id: editProduct.id,
              changed_by: user.id,
              field_name: f,
              old_value: String(origProduct[f] ?? ''),
              new_value: String(editProduct[f] ?? ''),
              changed_at: new Date().toISOString(),
            });
          }
        });
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          const { error: e } = await client.from('product_master').update(updates).eq('id', editProduct.id);
          if (e) throw e;
          if (auditEntries.length > 0) await client.from('product_master_audit').insert(auditEntries);
        }
      } else {
        const ins = { ...editProduct };
        delete ins.id;
        const { error: e } = await client.from('product_master').insert([ins]);
        if (e) throw e;
      }
      closeEdit();
      fetchProducts();
    } catch (e: any) {
      setSaveErr(e.message);
    }
  };

  const openAudit = async (pid: string) => {
    const { data } = await client.from('product_master_audit').select('*').eq('product_id', pid).order('changed_at', { ascending: false });
    setAuditLog(data || []);
    setShowAudit(true);
  };

  const handleCsvFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter((l: string) => l.trim());
    if (lines.length < 2) {
      setSaveErr('CSVが空です');
      return;
    }
    const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map((line: string) => {
      const vals = line.split(',').map((v: string) => v.trim().replace(/^"|"$/g, ''));
      const obj: any = {};
      headers.forEach((h: string, i: number) => { obj[h] = vals[i] || ''; });
      return obj;
    }).filter((r: any) => r.jan || r.JAN);
    setCsvData({ headers, rows });
    setShowCsvImport(true);
  };

  const importCsv = async () => {
    if (!csvData?.rows?.length) return;
    setCsvImporting(true);
    try {
      const fieldMap: Record<string, string> = {
        jan: 'jan', JAN: 'jan', '商品名': 'name_ja', name_ja: 'name_ja', name_en: 'name_en', '英語名': 'name_en',
        'ブランド': 'brand', brand: 'brand', '仕入先': 'supplier', supplier: 'supplier',
        '定価': 'list_price', list_price: 'list_price', '下代': 'cost_price', cost_price: 'cost_price',
        '重量': 'weight_g', weight_g: 'weight_g', 'ケース入数': 'case_quantity', case_quantity: 'case_quantity',
        '販売価格USD': 'selling_price', selling_price: 'selling_price', '成分': 'ingredients_en', ingredients_en: 'ingredients_en',
        'ステータス': 'status', status: 'status', 'サブブランド': 'sub_brand', sub_brand: 'sub_brand',
      };
      const numFields = ['list_price', 'cost_price', 'selling_price', 'weight_g', 'case_quantity', 'price_break_qty'];
      const inserts = csvData.rows.map((row: any) => {
        const obj: any = {};
        Object.entries(row).forEach(([k, v]) => {
          const mapped = fieldMap[k];
          if (mapped && v) {
            if (numFields.includes(mapped)) {
              obj[mapped] = Number(v) || null;
            } else {
              obj[mapped] = v;
            }
          }
        });
        return obj;
      }).filter((o: any) => o.jan);
      const batch = 50;
      for (let i = 0; i < inserts.length; i += batch) {
        const chunk = inserts.slice(i, i + batch);
        await client.from('product_master').upsert(chunk, { onConflict: 'jan' });
      }
      setShowCsvImport(false);
      setCsvData(null);
      fetchProducts();
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setCsvImporting(false);
    }
  };

  const topBrands = useMemo(() => {
    const _counts: Record<string, number> = {};
    products.forEach((p: any) => { if (p.brand) _counts[p.brand] = (_counts[p.brand] || 0) + 1; });
    return brands.slice(0, 6);
  }, [brands, products]);

  const startIdx = currentPage * LIMIT;
  const endIdx = Math.min(startIdx + LIMIT, totalCount);

  const sn = (uid: string): string => {
    const u = (allUsers || []).find((x: any) => x.id === uid);
    return u ? (u as any).display_name || (u as any).email?.split('@')[0] || '不明' : '不明';
  };

  // ── Menu ──
  if (docPage === 'menu') {
    return (
      <div style={{ padding: 16, background: T.bg, minHeight: '100%' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: T.primary, margin: '0 0 20px' }}>書類作成</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([
            {
              id: 'quotation' as DocPage,
              label: '見積書作成',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2" stroke={T.primary} strokeWidth="1.5" />
                  <path d="M8 7h8M8 11h8M8 15h5" stroke={T.primary} strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="17" cy="17" r="4" fill={T.primary} />
                  <text x="17" y="19" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">¥</text>
                </svg>
              ),
              color: T.primary,
            },
            {
              id: 'invoice' as DocPage,
              label: '請求書作成',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2" stroke={T.accent} strokeWidth="1.5" />
                  <path d="M8 7h8M8 11h8M8 15h5" stroke={T.accent} strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="17" cy="17" r="4" fill={T.accent} />
                  <text x="17" y="19" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700">$</text>
                </svg>
              ),
              color: T.accent,
            },
            {
              id: 'delivery' as DocPage,
              label: '納品書作成',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 8l4-4h10l4 4v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke={BLUE} strokeWidth="1.5" />
                  <path d="M3 8h18M12 8v12" stroke={BLUE} strokeWidth="1.3" />
                </svg>
              ),
              color: BLUE,
            },
            {
              id: 'master' as DocPage,
              label: 'マスタ編集',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3" stroke={T.sub} strokeWidth="1.5" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" stroke={T.sub} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ),
              color: T.sub,
            },
          ]).map(b => (
            <button
              key={b.id}
              onClick={() => setDocPage(b.id)}
              style={{ padding: 20, borderRadius: 12, background: T.card, border: `2px solid ${b.color}22`, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 110, gap: 10, fontFamily: 'inherit', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = b.color; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = b.color + '22'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {b.icon}
              <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Master Editor ──
  if (docPage === 'master') {
    return (
      <div style={{ padding: IS_MOBILE ? '10px' : '16px', background: T.bg, minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={() => setDocPage('menu')} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0, color: T.sub }}>&larr;</button>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: T.primary, margin: 0, flex: 1 }}>商品マスタ <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>({totalCount}件)</span></h2>
          <button onClick={() => openEdit(null)} style={{ padding: '6px 12px', background: T.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ 新規</button>
          <label style={{ padding: '6px 12px', background: BLUE, color: '#fff', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            CSV<input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleCsvFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="検索 (名前・JAN・ブランド)" style={{ flex: 1, minWidth: 150, padding: '7px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11.5, fontFamily: 'inherit', outline: 'none' }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '7px 8px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 11, fontFamily: 'inherit', color: T.sub }}>
            <option value="">全ステータス</option>
            <option value="active">アクティブ</option>
            <option value="inactive">非アクティブ</option>
            <option value="discontinued">廃盤</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { setFilterBrand(''); setCurrentPage(0); }} style={{ padding: '4px 8px', background: !filterBrand ? T.primary : T.borderLight || '#eee', color: !filterBrand ? '#fff' : T.muted, border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>全て</button>
          {topBrands.map(b => (
            <button key={b} onClick={() => { setFilterBrand(filterBrand === b ? '' : b); setCurrentPage(0); }} style={{ padding: '4px 8px', background: filterBrand === b ? T.primary : T.borderLight || '#eee', color: filterBrand === b ? '#fff' : T.muted, border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</button>
          ))}
        </div>

        {/* Error */}
        {error && <div style={{ padding: 8, background: T.red + '15', color: T.red, borderRadius: 6, fontSize: 11, marginBottom: 8 }}>{error}</div>}

        {/* Loading */}
        {loading && <div style={{ textAlign: 'center', padding: 20, color: T.muted, fontSize: 11 }}>読み込み中...</div>}

        {/* Product List */}
        {!loading && products.map((p: any) => (
          <div
            key={p.id}
            onClick={() => openEdit(p)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: T.card, border: `1px solid ${T.borderLight}`, borderRadius: 8, marginBottom: 4, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => { e.currentTarget.style.background = T.hover; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.card; }}
          >
            {p.image_url
              ? <img src={p.image_url} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={(e: any) => { e.target.style.display = 'none'; }} />
              : <div style={{ width: 36, height: 36, borderRadius: 6, background: T.borderLight || '#eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: T.muted }}>📦</div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name_en || p.name_ja || '名称なし'}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>{p.jan}{p.brand ? ` · ${p.brand}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {p.cost_price != null && <div style={{ fontSize: 10, color: T.sub }}>&yen;{Number(p.cost_price).toLocaleString()}</div>}
              {p.selling_price != null && <div style={{ fontSize: 10, fontWeight: 600, color: T.green }}>${Number(p.selling_price).toFixed(2)}</div>}
              <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: p.status === 'active' ? T.green + '18' : T.red + '18', color: p.status === 'active' ? T.green : T.red, fontWeight: 600 }}>{p.status === 'active' ? '有効' : '停止'}</span>
            </div>
            <button onClick={e => { e.stopPropagation(); openAudit(p.id); }} style={{ background: 'none', border: 'none', fontSize: 10, color: BLUE, cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }} title="変更履歴">履歴</button>
          </div>
        ))}

        {/* Pagination */}
        {totalCount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 11, color: T.muted }}>
            <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} style={{ padding: '5px 10px', background: currentPage === 0 ? T.borderLight || '#eee' : T.primary, color: currentPage === 0 ? T.muted : '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: currentPage === 0 ? 'default' : 'pointer' }}>前へ</button>
            <span>{startIdx + 1}-{endIdx} / {totalCount}</span>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={endIdx >= totalCount} style={{ padding: '5px 10px', background: endIdx >= totalCount ? T.borderLight || '#eee' : T.primary, color: endIdx >= totalCount ? T.muted : '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: endIdx >= totalCount ? 'default' : 'pointer' }}>次へ</button>
          </div>
        )}

        {/* Edit Modal */}
        {showEdit && editProduct && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 12 }} onClick={closeEdit}>
            <div style={{ background: T.card, borderRadius: 12, padding: 18, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.primary }}>{editProduct.id ? '商品編集' : '新規商品追加'}</h3>
                <button onClick={closeEdit} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: T.muted }}>✕</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr', gap: 10 }}>
                {([
                  { k: 'name_ja', l: '名前(日本語)', type: 'text' },
                  { k: 'name_en', l: '名前(英語)', type: 'text' },
                  { k: 'jan', l: 'JAN', type: 'text', ro: !!editProduct.id },
                  { k: 'brand', l: 'ブランド', type: 'text', list: 'pm-brands' },
                  { k: 'sub_brand', l: 'サブブランド', type: 'text', list: 'pm-subs' },
                  { k: 'supplier', l: '仕入先', type: 'text', list: 'pm-suppliers' },
                  { k: 'cost_price', l: '下代 (¥)', type: 'number' },
                  { k: 'list_price', l: '定価 (¥)', type: 'number' },
                  { k: 'selling_price', l: '提案価格 (USD)', type: 'number' },
                  { k: 'weight_g', l: '重量 (g)', type: 'number' },
                  { k: 'case_quantity', l: 'ケース入数', type: 'number' },
                  { k: 'price_break_qty', l: '価格変動数量', type: 'number' },
                  { k: 'image_url', l: '画像URL', type: 'text' },
                  { k: 'status', l: 'ステータス', type: 'select', opts: [['active', 'アクティブ'], ['inactive', '非アクティブ'], ['discontinued', '廃盤']] },
                ] as any[]).map((f: any) => (
                  <div key={f.k}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, marginBottom: 3 }}>{f.l}</div>
                    {f.type === 'select' ? (
                      <select
                        value={editProduct[f.k] || 'active'}
                        onChange={e => setEditProduct((prev: any) => ({ ...prev, [f.k]: e.target.value }))}
                        style={{ width: '100%', padding: '7px 8px', border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 11.5, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                      >
                        {f.opts.map(([v, l]: [string, string]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <input
                        type={f.type}
                        value={editProduct[f.k] ?? ''}
                        onChange={e => {
                          const v = f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value;
                          setEditProduct((prev: any) => ({ ...prev, [f.k]: v }));
                        }}
                        readOnly={f.ro}
                        list={f.list || undefined}
                        style={{ width: '100%', padding: '7px 8px', border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 11.5, fontFamily: 'inherit', boxSizing: 'border-box' as const, background: f.ro ? T.borderLight || '#eee' : '#fff' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <datalist id="pm-brands">{brands.map(b => <option key={b} value={b} />)}</datalist>
              <datalist id="pm-subs">{subBrands.map(b => <option key={b} value={b} />)}</datalist>
              <datalist id="pm-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, marginBottom: 3 }}>成分表 (英語)</div>
                <textarea
                  value={editProduct.ingredients_en || ''}
                  onChange={e => setEditProduct((prev: any) => ({ ...prev, ingredients_en: e.target.value }))}
                  style={{ width: '100%', padding: 7, border: `1px solid ${T.border}`, borderRadius: 5, fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box' as const, minHeight: 60, resize: 'vertical' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: T.sub, cursor: 'pointer' }}>
                <input type="checkbox" checked={editProduct.is_discontinued || false} onChange={e => setEditProduct((prev: any) => ({ ...prev, is_discontinued: e.target.checked }))} />廃盤フラグ
              </label>

              {editProduct.image_url && (
                <div style={{ marginTop: 8 }}>
                  <img src={editProduct.image_url} style={{ maxHeight: 60, borderRadius: 6 }} onError={(e: any) => { e.target.style.display = 'none'; }} />
                </div>
              )}

              {/* Profit preview */}
              {editProduct.selling_price && editProduct.cost_price && (
                <div style={{ marginTop: 10, padding: 8, background: T.green + '10', borderRadius: 6, fontSize: 11 }}>
                  <span style={{ color: T.sub }}>利益: </span>
                  <span style={{ fontWeight: 700, color: T.green }}>${(editProduct.selling_price - (editProduct.cost_price / DEFAULT_JPY_RATE)).toFixed(2)}</span>
                  <span style={{ color: T.muted, marginLeft: 6 }}>({((1 - editProduct.cost_price / (DEFAULT_JPY_RATE * editProduct.selling_price)) * 100).toFixed(1)}%)</span>
                </div>
              )}

              {saveErr && <div style={{ padding: 8, background: T.red + '15', color: T.red, borderRadius: 6, fontSize: 11, marginTop: 8 }}>{saveErr}</div>}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button onClick={saveProduct} style={{ flex: 1, padding: 10, background: T.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>保存</button>
                <button onClick={closeEdit} style={{ flex: 1, padding: 10, background: T.borderLight || '#eee', color: T.muted, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>キャンセル</button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Modal */}
        {showAudit && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 12 }} onClick={() => setShowAudit(false)}>
            <div style={{ background: T.card, borderRadius: 12, padding: 18, width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.15)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.primary }}>変更履歴</h3>
                <button onClick={() => setShowAudit(false)} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: T.muted }}>✕</button>
              </div>
              {auditLog.length === 0
                ? <div style={{ textAlign: 'center', padding: 20, fontSize: 11, color: T.muted }}>変更履歴なし</div>
                : auditLog.map((a: any, i: number) => (
                  <div key={i} style={{ padding: 8, borderBottom: `1px solid ${T.borderLight}`, fontSize: 11 }}>
                    <div style={{ fontWeight: 600, color: T.primary }}>{a.field_name}</div>
                    <div style={{ color: T.muted, marginTop: 2 }}>
                      <span style={{ color: T.red }}>旧:</span> {a.old_value || '(空)'} &rarr; <span style={{ color: T.green }}>新:</span> {a.new_value || '(空)'}
                    </div>
                    <div style={{ fontSize: 9, color: T.muted, marginTop: 2 }}>{new Date(a.changed_at).toLocaleString()} by {sn(a.changed_by)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvImport && csvData && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 12 }} onClick={() => { setShowCsvImport(false); setCsvData(null); }}>
            <div style={{ background: T.card, borderRadius: 12, padding: 18, width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: T.primary }}>CSVインポート</h3>
              <div style={{ fontSize: 11, color: T.sub, marginBottom: 8 }}>検出カラム: {csvData.headers.join(', ')}</div>
              <div style={{ fontSize: 11, color: T.sub, marginBottom: 12 }}>{csvData.rows.length}件の商品データ（JANあり）</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: `1px solid ${T.border}`, borderRadius: 6, marginBottom: 12 }}>
                {csvData.rows.slice(0, 5).map((r: any, i: number) => (
                  <div key={i} style={{ padding: 6, borderBottom: `1px solid ${T.borderLight}`, fontSize: 10, color: T.sub }}>{r.jan || r.JAN} - {r.name_en || r['商品名'] || r.name_ja || '名称なし'}</div>
                ))}
                {csvData.rows.length > 5 && <div style={{ padding: 6, fontSize: 10, color: T.muted, textAlign: 'center' }}>他 {csvData.rows.length - 5}件...</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={importCsv} disabled={csvImporting} style={{ flex: 1, padding: 10, background: T.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: csvImporting ? 0.5 : 1 }}>{csvImporting ? 'インポート中...' : 'インポート実行'}</button>
                <button onClick={() => { setShowCsvImport(false); setCsvData(null); }} style={{ flex: 1, padding: 10, background: T.borderLight || '#eee', color: T.muted, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>キャンセル</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Quotation & Invoice -> QuotationInvoiceBuilder ──
  if (docPage === 'quotation' || docPage === 'invoice') {
    return (
      <QuotationInvoiceBuilder
        type={docPage}
        client={client}
        user={user}
        allUsers={allUsers}
        accounts={accounts}
        contacts={contacts}
        deals={deals}
        onBack={() => setDocPage('menu')}
      />
    );
  }

  // ── Delivery Note placeholder (Phase 3) ──
  return (
    <div style={{ padding: 16, background: T.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setDocPage('menu')} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0, color: T.sub }}>&larr;</button>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: T.primary, margin: 0 }}>納品書作成</h2>
      </div>
      <div style={{ padding: 40, background: T.card, borderRadius: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.sub, marginBottom: 6 }}>Phase 3で実装予定</div>
        <div style={{ fontSize: 11, color: T.muted }}>BOXグルーピング・成分表付き納品書の作成機能を追加します</div>
      </div>
    </div>
  );
}

export { DocumentsPage };
