// ============================================
// GS Sales CRM - Documents Page
// 書類メニュー（商品マスタ管理・見積書/請求書ビルダーリンク）
// ============================================

import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, IS_MOBILE, DEFAULT_JPY_RATE } from '@/lib/constants';

// ── Types ──

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
}

interface Product {
  id: string;
  name: string;
  sku: string | null;
  unit_price: number | null;
  currency: string;
  category: string | null;
  description: string | null;
  image_url: string | null;
  owner_id: string | null;
  created_at: string;
  deleted_at: string | null;
}

interface ProductForm {
  id: string | null;
  name: string;
  sku: string;
  unit_price: string;
  category: string;
  description: string;
}

type View = 'menu' | 'products' | 'quotation' | 'invoice';

// ── Constants ──

const PRODUCT_CATEGORIES = [
  'J-Beauty', 'Matcha', 'Food', 'Supplement', 'Sake', 'Other',
] as const;

const emptyForm = (): ProductForm => ({
  id: null,
  name: '',
  sku: '',
  unit_price: '',
  category: '',
  description: '',
});

// ── Styles ──

const cardStyle: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: IS_MOBILE ? 16 : 24,
  cursor: 'pointer',
  transition: 'box-shadow 0.2s, transform 0.15s',
};

const btnPrimary: React.CSSProperties = {
  background: T.primary,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 20px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnOutline: React.CSSProperties = {
  background: 'transparent',
  color: T.primary,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

// ── Component ──

export default function DocumentsPage({
  client,
  user,
  accounts,
  deals,
}: Props) {
  const toast = useToast();

  // State
  const [view, setView] = useState<View>('menu');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  // ── Fetch products ──
  useEffect(() => {
    if (view === 'products') {
      fetchProducts();
    }
  }, [view]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await client
        .from('product_masters')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (e: any) {
      toast(e.message || '商品マスタの取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Save product ──
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast('商品名を入力してください', 'warn');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        category: form.category || null,
        description: form.description.trim() || null,
        currency: 'JPY',
        owner_id: user.id,
      };

      if (form.id) {
        const { error } = await client
          .from('product_masters')
          .update(payload)
          .eq('id', form.id);
        if (error) throw error;
        toast('商品を更新しました');
      } else {
        const { error } = await client
          .from('product_masters')
          .insert(payload);
        if (error) throw error;
        toast('商品を登録しました');
      }

      setShowForm(false);
      setForm(emptyForm());
      fetchProducts();
    } catch (e: any) {
      toast(e.message || '保存に失敗しました', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete product (soft delete) ──
  const handleDelete = async (id: string) => {
    if (!confirm('この商品を削除しますか?')) return;
    try {
      const { error } = await client
        .from('product_masters')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast('商品を削除しました');
      fetchProducts();
    } catch (e: any) {
      toast(e.message || '削除に失敗しました', 'error');
    }
  };

  // ── Edit product ──
  const handleEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      unit_price: p.unit_price != null ? String(p.unit_price) : '',
      category: p.category || '',
      description: p.description || '',
    });
    setShowForm(true);
  };

  // ── Filtered products ──
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q));
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  // Unique categories from products
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  ).sort();

  // ── Menu View ──
  if (view === 'menu') {
    return (
      <div style={{ padding: IS_MOBILE ? 16 : 32, maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: IS_MOBILE ? 20 : 24, fontWeight: 700, color: T.primary, marginBottom: 8 }}>
          書類管理
        </h2>
        <p style={{ color: T.sub, fontSize: 14, marginBottom: 28 }}>
          見積書・請求書の作成、商品マスタの管理
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: IS_MOBILE ? '1fr' : 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {/* Quotation Builder */}
          <div
            style={cardStyle}
            onClick={() => setView('quotation')}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#128196;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.primary, marginBottom: 6 }}>
              見積書ビルダー
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>
              商品マスタから選択して見積書を作成。PDF出力に対応。
            </div>
          </div>

          {/* Invoice Builder */}
          <div
            style={cardStyle}
            onClick={() => setView('invoice')}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#128451;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.primary, marginBottom: 6 }}>
              請求書ビルダー
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>
              商談情報から請求書を自動生成。ワンクリック送付。
            </div>
          </div>

          {/* Product Master */}
          <div
            style={cardStyle}
            onClick={() => setView('products')}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#128230;</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.primary, marginBottom: 6 }}>
              商品マスタ
            </div>
            <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.5 }}>
              商品情報の登録・編集・削除。見積・請求で利用。
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div
          style={{
            marginTop: 32,
            padding: IS_MOBILE ? 16 : 20,
            background: T.bg,
            borderRadius: 12,
            display: 'flex',
            gap: 32,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>商談数</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>{deals.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>取引先数</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>{accounts.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>為替レート (USD/JPY)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: T.primary }}>{DEFAULT_JPY_RATE}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Quotation Builder Placeholder ──
  if (view === 'quotation') {
    return (
      <div style={{ padding: IS_MOBILE ? 16 : 32, maxWidth: 900, margin: '0 auto' }}>
        <button style={btnOutline} onClick={() => setView('menu')}>
          &larr; 書類メニューに戻る
        </button>
        <h2 style={{ fontSize: IS_MOBILE ? 20 : 24, fontWeight: 700, color: T.primary, margin: '20px 0 12px' }}>
          見積書ビルダー
        </h2>
        <div
          style={{
            ...cardStyle,
            cursor: 'default',
            textAlign: 'center' as const,
            padding: 48,
            color: T.muted,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128196;</div>
          <p style={{ fontSize: 16 }}>見積書ビルダーは準備中です</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            商品マスタを登録後、見積書を自動生成できるようになります。
          </p>
        </div>
      </div>
    );
  }

  // ── Invoice Builder Placeholder ──
  if (view === 'invoice') {
    return (
      <div style={{ padding: IS_MOBILE ? 16 : 32, maxWidth: 900, margin: '0 auto' }}>
        <button style={btnOutline} onClick={() => setView('menu')}>
          &larr; 書類メニューに戻る
        </button>
        <h2 style={{ fontSize: IS_MOBILE ? 20 : 24, fontWeight: 700, color: T.primary, margin: '20px 0 12px' }}>
          請求書ビルダー
        </h2>
        <div
          style={{
            ...cardStyle,
            cursor: 'default',
            textAlign: 'center' as const,
            padding: 48,
            color: T.muted,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>&#128451;</div>
          <p style={{ fontSize: 16 }}>請求書ビルダーは準備中です</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            商談データと連携して請求書を自動作成できるようになります。
          </p>
        </div>
      </div>
    );
  }

  // ── Product Master View ──
  return (
    <div style={{ padding: IS_MOBILE ? 16 : 32, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button style={btnOutline} onClick={() => setView('menu')}>
          &larr; 書類メニューに戻る
        </button>
        <h2 style={{ fontSize: IS_MOBILE ? 20 : 24, fontWeight: 700, color: T.primary, flex: 1, margin: 0 }}>
          商品マスタ
        </h2>
        <button
          style={btnPrimary}
          onClick={() => {
            setForm(emptyForm());
            setShowForm(true);
          }}
        >
          + 商品追加
        </button>
      </div>

      {/* Search & Filter */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <input
          style={{ ...inputStyle, maxWidth: 320 }}
          placeholder="商品名・SKU・カテゴリで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={{ ...inputStyle, maxWidth: 180 }}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
        >
          <option value="">全カテゴリ</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 13, color: T.muted, alignSelf: 'center' }}>
          {filtered.length} / {products.length} 件
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div
            style={{
              background: T.card,
              borderRadius: 16,
              padding: IS_MOBILE ? 20 : 28,
              width: '100%',
              maxWidth: 480,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.primary, marginTop: 0, marginBottom: 20 }}>
              {form.id ? '商品を編集' : '新規商品登録'}
            </h3>

            {/* Name */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.primary, display: 'block', marginBottom: 4 }}>
                商品名 *
              </span>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: 抹茶パウダー 100g"
              />
            </label>

            {/* SKU */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.primary, display: 'block', marginBottom: 4 }}>
                SKU
              </span>
              <input
                style={inputStyle}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="例: MCH-100G"
              />
            </label>

            {/* Unit Price */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.primary, display: 'block', marginBottom: 4 }}>
                単価 (JPY)
              </span>
              <input
                style={inputStyle}
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                placeholder="例: 1500"
              />
            </label>

            {/* Category */}
            <label style={{ display: 'block', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.primary, display: 'block', marginBottom: 4 }}>
                カテゴリ
              </span>
              <select
                style={inputStyle}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">未選択</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            {/* Description */}
            <label style={{ display: 'block', marginBottom: 20 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.primary, display: 'block', marginBottom: 4 }}>
                説明
              </span>
              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="商品の説明を入力..."
              />
            </label>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                style={btnOutline}
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyForm());
                }}
              >
                キャンセル
              </button>
              <button style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : form.id ? '更新' : '登録'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: T.muted }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: T.muted }}>
          {products.length === 0 ? '商品が登録されていません' : '検索条件に一致する商品がありません'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Table Header */}
          {!IS_MOBILE && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                gap: 12,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 600,
                color: T.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              <span>商品名</span>
              <span>SKU</span>
              <span>カテゴリ</span>
              <span style={{ textAlign: 'right' }}>単価</span>
              <span style={{ width: 80 }} />
            </div>
          )}

          {/* Product Rows */}
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: IS_MOBILE ? '12px 14px' : '10px 16px',
                display: IS_MOBILE ? 'flex' : 'grid',
                gridTemplateColumns: IS_MOBILE ? undefined : '2fr 1fr 1fr 1fr auto',
                flexDirection: IS_MOBILE ? 'column' : undefined,
                gap: IS_MOBILE ? 6 : 12,
                alignItems: IS_MOBILE ? undefined : 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = T.hover;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = T.card;
              }}
            >
              {/* Name */}
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.primary }}>{p.name}</div>
                {IS_MOBILE && p.description && (
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    {p.description.length > 60 ? p.description.slice(0, 60) + '...' : p.description}
                  </div>
                )}
              </div>

              {/* SKU */}
              <div style={{ fontSize: 13, color: T.sub }}>
                {IS_MOBILE && <span style={{ color: T.muted, marginRight: 6 }}>SKU:</span>}
                {p.sku || '-'}
              </div>

              {/* Category */}
              <div>
                {p.category ? (
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      background: T.bg,
                      color: T.sub,
                      border: `1px solid ${T.borderLight}`,
                    }}
                  >
                    {p.category}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: T.muted }}>-</span>
                )}
              </div>

              {/* Unit Price */}
              <div style={{ fontSize: 14, fontWeight: 600, color: T.primary, textAlign: IS_MOBILE ? 'left' : 'right' }}>
                {IS_MOBILE && <span style={{ color: T.muted, fontWeight: 400, marginRight: 6 }}>単価:</span>}
                {p.unit_price != null ? `¥${p.unit_price.toLocaleString()}` : '-'}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: IS_MOBILE ? 'flex-start' : 'flex-end', width: IS_MOBILE ? undefined : 80 }}>
                <button
                  style={{ ...btnOutline, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => handleEdit(p)}
                >
                  編集
                </button>
                <button
                  style={{ ...btnOutline, padding: '4px 10px', fontSize: 12, color: T.red, borderColor: T.red }}
                  onClick={() => handleDelete(p.id)}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { DocumentsPage };
