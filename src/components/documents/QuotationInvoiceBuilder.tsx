// ============================================
// GS Sales CRM - Quotation / Invoice Builder
// 見積書・請求書ビルダー（TypeScript版）
// ============================================

import { useState, useEffect, useRef, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, IS_MOBILE, DEFAULT_JPY_RATE, fmt, fmtYen, shortName } from '@/lib/constants';

// ── Types ──

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  contacts: Contact[];
  deals: Deal[];
  type: 'quotation' | 'invoice';
  onBack: () => void;
  editDoc?: any;
}

interface LineItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  taxRate: number;
  productId: string | null;
}

interface ShippingCalc {
  type: string;
  weight: number;
  cost: number;
  zone: string;
}

// ── Helpers ──

const uid = (): string => Math.random().toString(36).slice(2, 10);

const emptyItem = (): LineItem => ({
  id: uid(),
  name: '',
  description: '',
  quantity: 1,
  unit: '',
  unitPrice: 0,
  amount: 0,
  taxRate: 10,
  productId: null,
});

const TODAY = new Date().toISOString().slice(0, 10);

const currencySymbol = (c: string): string => {
  const map: Record<string, string> = { JPY: '\u00a5', USD: '$', EUR: '\u20ac', GBP: '\u00a3' };
  return map[c] || c;
};

const fmtCurrency = (n: number, currency: string): string => {
  if (currency === 'JPY') return fmtYen(n);
  return `${currencySymbol(currency)}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ── Styles ──

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    zIndex: 3000, overflowY: 'auto' as const, padding: IS_MOBILE ? 0 : 20,
  },
  container: {
    background: '#fff', borderRadius: IS_MOBILE ? 0 : 12,
    width: IS_MOBILE ? '100%' : '95%', maxWidth: 1100,
    minHeight: IS_MOBILE ? '100vh' : 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    display: 'flex', flexDirection: 'column' as const,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
  },
  body: {
    flex: 1, overflowY: 'auto' as const,
    padding: IS_MOBILE ? '12px 10px' : '20px 24px',
  },
  section: {
    marginBottom: 24, padding: 16, borderRadius: 10,
    border: `1px solid ${T.border}`, background: T.bg,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 700 as const, color: T.primary,
    marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
  },
  row: { display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' as const },
  field: { flex: 1, minWidth: IS_MOBILE ? '100%' : 160 },
  label: { fontSize: 11, fontWeight: 600 as const, color: T.sub, marginBottom: 4, display: 'block' },
  input: {
    width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`,
    borderRadius: 6, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  select: {
    width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`,
    borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  textarea: {
    width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`,
    borderRadius: 6, fontSize: 13, outline: 'none', minHeight: 60,
    fontFamily: 'inherit', resize: 'vertical' as const, boxSizing: 'border-box' as const,
  },
  btn: (bg: string, color = '#fff') => ({
    padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600 as const, fontFamily: 'inherit',
    background: bg, color, transition: 'opacity .15s',
  }),
  btnSm: (bg: string, color = '#fff') => ({
    padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 600 as const, fontFamily: 'inherit',
    background: bg, color,
  }),
  itemRow: {
    display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8,
    padding: 8, borderRadius: 6, background: '#fff', border: `1px solid ${T.borderLight}`,
    flexWrap: 'wrap' as const,
  },
  previewBox: {
    border: `1px solid ${T.border}`, borderRadius: 8, padding: 24,
    background: '#fff', maxWidth: 800, margin: '0 auto',
    fontFamily: '"Noto Sans JP", sans-serif', fontSize: 12, lineHeight: 1.6,
  },
  searchDropdown: {
    position: 'absolute' as const, top: '100%', left: 0, right: 0,
    background: '#fff', border: `1px solid ${T.border}`, borderRadius: 6,
    maxHeight: 200, overflowY: 'auto' as const, zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  searchItem: {
    padding: '8px 10px', cursor: 'pointer', fontSize: 12,
    borderBottom: `1px solid ${T.borderLight}`,
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: `2px solid ${T.border}`, marginBottom: 20,
  },
  tab: (active: boolean) => ({
    padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 as const,
    color: active ? T.accent : T.sub,
    borderBottom: active ? `2px solid ${T.accent}` : '2px solid transparent',
    marginBottom: -2, background: 'none', border: 'none', fontFamily: 'inherit',
  }),
};

// ── Component ──

export function QuotationInvoiceBuilder({
  client, user, allUsers: _allUsers, accounts, contacts, deals, type, onBack, editDoc,
}: Props) {
  const toast = useToast();

  // -- Tab state --
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // -- Document header --
  const [docNumber, setDocNumber] = useState<string>(editDoc?.doc_number || '');
  const [docDate, setDocDate] = useState<string>(editDoc?.data?.date || TODAY);
  const [validUntil, setValidUntil] = useState<string>(editDoc?.data?.validUntil || '');
  const [subject, setSubject] = useState<string>(editDoc?.data?.subject || '');
  const [currency, setCurrency] = useState<string>(editDoc?.data?.currency || 'JPY');
  const [jpyRate, setJpyRate] = useState<number>(editDoc?.data?.jpyRate || DEFAULT_JPY_RATE);

  // -- Account / Contact / Deal selection --
  const [selectedAccountId, setSelectedAccountId] = useState<string>(editDoc?.account_id || '');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedDealId, setSelectedDealId] = useState<string>(editDoc?.deal_id || '');
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // -- Line items --
  const [items, setItems] = useState<LineItem[]>(
    editDoc?.data?.items?.map((it: any) => ({ ...emptyItem(), ...it })) || [emptyItem()]
  );

  // -- Shipping --
  const [includeShipping, setIncludeShipping] = useState<boolean>(editDoc?.data?.includeShipping ?? false);
  const [shippingCalc, setShippingCalc] = useState<ShippingCalc>({
    type: 'sea', weight: 0, cost: 0, zone: '',
  });
  const [shippingCost, setShippingCost] = useState<number>(editDoc?.data?.shippingCost || 0);

  // -- Notes / payment terms --
  const [notes, setNotes] = useState<string>(editDoc?.data?.notes || '');
  const [paymentTerms, setPaymentTerms] = useState<string>(editDoc?.data?.paymentTerms || '');

  // -- Bank account --
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>(editDoc?.data?.bankAccountId || '');

  // -- Company info --
  const [companyInfo, setCompanyInfo] = useState<Record<string, string>>({});

  // -- Product search --
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  // -- Shipping zones / rates --
  const [shippingZones, setShippingZones] = useState<any[]>([]);
  const [shippingRates, setShippingRates] = useState<any[]>([]);

  // -- Saving --
  const [saving, setSaving] = useState(false);

  // -- Refs --
  const productSearchRef = useRef<HTMLInputElement>(null);
  const accountSearchRef = useRef<HTMLInputElement>(null);

  // ── Computed ──

  const selectedAccount = useMemo(
    () => accounts.find(a => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const selectedContact = useMemo(
    () => contacts.find(c => c.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const selectedDeal = useMemo(
    () => deals.find(d => d.id === selectedDealId) || null,
    [deals, selectedDealId]
  );

  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return accounts.slice(0, 20);
    const q = accountSearch.toLowerCase();
    return accounts.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.email || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [accounts, accountSearch]);

  const accountContacts = useMemo(
    () => contacts.filter(c => c.account_id === selectedAccountId),
    [contacts, selectedAccountId]
  );

  const accountDeals = useMemo(
    () => deals.filter(d => d.account_id === selectedAccountId),
    [deals, selectedAccountId]
  );

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.quantity * it.unitPrice, 0),
    [items]
  );

  const taxTotal = useMemo(
    () => items.reduce((s, it) => s + Math.round(it.quantity * it.unitPrice * it.taxRate / 100), 0),
    [items]
  );

  const grandTotal = useMemo(
    () => subtotal + taxTotal + (includeShipping ? shippingCost : 0),
    [subtotal, taxTotal, includeShipping, shippingCost]
  );

  // ── Data loading ──

  useEffect(() => {
    loadCompanyInfo();
    loadBankAccounts();
    loadShippingData();
    if (!docNumber) generateDocNumber();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editDoc?.data?.contactId) {
      setSelectedContactId(editDoc.data.contactId);
    }
  }, [editDoc]);

  async function loadCompanyInfo(): Promise<void> {
    try {
      const { data } = await client
        .from('company_settings')
        .select('key,value');
      if (data) {
        const info: Record<string, string> = {};
        data.forEach((r: any) => { info[r.key] = r.value; });
        setCompanyInfo(info);
      }
    } catch (e) {
      console.error('Failed to load company settings:', e);
    }
  }

  async function loadBankAccounts(): Promise<void> {
    try {
      const { data } = await client
        .from('bank_accounts')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (data) setBankAccounts(data);
    } catch (e) {
      console.error('Failed to load bank accounts:', e);
    }
  }

  async function loadShippingData(): Promise<void> {
    try {
      const [zoneRes, rateRes] = await Promise.all([
        client.from('shipping_zones').select('*').is('deleted_at', null),
        client.from('shipping_rates').select('*').is('deleted_at', null),
      ]);
      if (zoneRes.data) setShippingZones(zoneRes.data);
      if (rateRes.data) setShippingRates(rateRes.data);
    } catch (e) {
      console.error('Failed to load shipping data:', e);
    }
  }

  async function generateDocNumber(): Promise<void> {
    const prefix = type === 'quotation' ? 'QT' : 'INV';
    const yy = new Date().getFullYear().toString().slice(2);
    const mm = String(new Date().getMonth() + 1).padStart(2, '0');
    try {
      const { count } = await client
        .from('generated_documents')
        .select('id', { count: 'exact', head: true })
        .eq('type', type);
      const seq = String((count || 0) + 1).padStart(4, '0');
      setDocNumber(`${prefix}-${yy}${mm}-${seq}`);
    } catch {
      setDocNumber(`${prefix}-${yy}${mm}-0001`);
    }
  }

  // ── Product search ──

  async function searchProducts(query: string): Promise<void> {
    setProductSearch(query);
    if (query.length < 2) {
      setProductResults([]);
      setShowProductDropdown(false);
      return;
    }
    try {
      const { data } = await client
        .from('product_master')
        .select('*')
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(10);
      setProductResults(data || []);
      setShowProductDropdown(true);
    } catch (e) {
      console.error('Product search failed:', e);
    }
  }

  function selectProduct(product: any, itemId: string): void {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        name: product.name || '',
        description: product.description || '',
        unitPrice: product.unit_price || 0,
        productId: product.id,
        amount: it.quantity * (product.unit_price || 0),
      };
    }));
    setShowProductDropdown(false);
    setProductSearch('');
    setActiveItemId(null);
  }

  // ── Shipping calculation ──

  function calculateShipping(): void {
    if (!selectedAccount?.country || shippingCalc.weight <= 0) return;

    const country = selectedAccount.country;
    const zone = shippingZones.find((z: any) =>
      z.countries && z.countries.includes(country)
    );
    if (!zone) {
      toast('Shipping zone not found for ' + country, 'warn');
      return;
    }

    const rate = shippingRates.find((r: any) =>
      r.zone_id === zone.id &&
      r.shipping_type === shippingCalc.type &&
      shippingCalc.weight >= r.weight_min &&
      shippingCalc.weight <= r.weight_max
    );

    if (rate) {
      setShippingCost(rate.price);
      setShippingCalc(prev => ({ ...prev, cost: rate.price, zone: zone.name }));
      toast('Shipping cost calculated');
    } else {
      toast('No matching rate found', 'warn');
    }
  }

  // ── Line item operations ──

  function updateItem(id: string, field: keyof LineItem, value: any): void {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it;
      const updated = { ...it, [field]: value };
      updated.amount = updated.quantity * updated.unitPrice;
      return updated;
    }));
  }

  function addItem(): void {
    setItems(prev => [...prev, emptyItem()]);
  }

  function removeItem(id: string): void {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  }

  function duplicateItem(id: string): void {
    const src = items.find(it => it.id === id);
    if (!src) return;
    const idx = items.findIndex(it => it.id === id);
    const copy = { ...src, id: uid() };
    const next = [...items];
    next.splice(idx + 1, 0, copy);
    setItems(next);
  }

  function moveItem(id: string, dir: -1 | 1): void {
    const idx = items.findIndex(it => it.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const next = [...items];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setItems(next);
  }

  // ── Account selection ──

  function onSelectAccount(acc: Account): void {
    setSelectedAccountId(acc.id);
    setAccountSearch(acc.name);
    setShowAccountDropdown(false);
    setSelectedContactId('');
    setSelectedDealId('');

    // Auto-set payment terms from account
    if (acc.payment_terms) setPaymentTerms(acc.payment_terms);
  }

  // ── Save ──

  async function handleSave(): Promise<void> {
    if (!selectedAccountId) {
      toast('Please select an account', 'error');
      return;
    }
    if (items.some(it => !it.name || it.unitPrice <= 0)) {
      toast('Please fill in all line items', 'error');
      return;
    }

    setSaving(true);
    try {
      const docData: Record<string, any> = {
        date: docDate,
        validUntil,
        subject,
        currency,
        jpyRate: currency !== 'JPY' ? jpyRate : null,
        items: items.map(it => ({
          name: it.name,
          description: it.description,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          amount: it.amount,
          taxRate: it.taxRate,
          productId: it.productId,
        })),
        subtotal,
        taxTotal,
        shippingCost: includeShipping ? shippingCost : 0,
        includeShipping,
        grandTotal,
        notes,
        paymentTerms,
        bankAccountId: selectedBankId || null,
        contactId: selectedContactId || null,
        companyInfo,
        accountName: selectedAccount?.name || '',
        accountAddress: selectedAccount?.address_billing || '',
        contactName: selectedContact?.name || '',
      };

      if (editDoc) {
        const { error } = await client
          .from('generated_documents')
          .update({
            doc_number: docNumber,
            data: docData,
            account_id: selectedAccountId || null,
            deal_id: selectedDealId || null,
          })
          .eq('id', editDoc.id);

        if (error) throw error;
        toast(`${type === 'quotation' ? 'Quotation' : 'Invoice'} updated`);
      } else {
        const { error } = await client
          .from('generated_documents')
          .insert({
            type,
            doc_number: docNumber,
            data: docData,
            account_id: selectedAccountId || null,
            deal_id: selectedDealId || null,
            created_by: user.id,
          });

        if (error) throw error;
        toast(`${type === 'quotation' ? 'Quotation' : 'Invoice'} saved`);
      }

      onBack();
    } catch (e: any) {
      console.error('Save failed:', e);
      toast('Save failed: ' + (e.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ──

  function renderAccountSelector(): JSX.Element {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>Customer Information</div>
        <div style={S.row}>
          <div style={{ ...S.field, position: 'relative' }}>
            <label style={S.label}>Account *</label>
            <input
              ref={accountSearchRef}
              style={S.input}
              placeholder="Search accounts..."
              value={accountSearch}
              onChange={e => {
                setAccountSearch(e.target.value);
                setShowAccountDropdown(true);
              }}
              onFocus={() => setShowAccountDropdown(true)}
              onBlur={() => setTimeout(() => setShowAccountDropdown(false), 200)}
            />
            {showAccountDropdown && filteredAccounts.length > 0 && (
              <div style={S.searchDropdown}>
                {filteredAccounts.map(acc => (
                  <div
                    key={acc.id}
                    style={S.searchItem}
                    onMouseDown={() => onSelectAccount(acc)}
                  >
                    <strong>{acc.name}</strong>
                    {acc.country && <span style={{ marginLeft: 8, color: T.muted }}>{acc.country}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedAccountId && (
          <div style={S.row}>
            <div style={S.field}>
              <label style={S.label}>Contact</label>
              <select
                style={S.select}
                value={selectedContactId}
                onChange={e => setSelectedContactId(e.target.value)}
              >
                <option value="">-- Select --</option>
                {accountContacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={S.field}>
              <label style={S.label}>Related Deal</label>
              <select
                style={S.select}
                value={selectedDealId}
                onChange={e => setSelectedDealId(e.target.value)}
              >
                <option value="">-- Select --</option>
                {accountDeals.map(d => (
                  <option key={d.id} value={d.id}>#{d.deal_number} {d.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedAccount && (
          <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
            {selectedAccount.address_billing && <div>Address: {selectedAccount.address_billing}</div>}
            {selectedAccount.email && <div>Email: {selectedAccount.email}</div>}
            {selectedAccount.phone && <div>Phone: {selectedAccount.phone}</div>}
          </div>
        )}
      </div>
    );
  }

  function renderDocHeader(): JSX.Element {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>Document Details</div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Doc Number</label>
            <input style={S.input} value={docNumber} onChange={e => setDocNumber(e.target.value)} />
          </div>
          <div style={S.field}>
            <label style={S.label}>Date</label>
            <input style={S.input} type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
          </div>
          {type === 'quotation' && (
            <div style={S.field}>
              <label style={S.label}>Valid Until</label>
              <input style={S.input} type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          )}
        </div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Subject</label>
            <input style={S.input} placeholder="Document subject..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div style={{ ...S.field, maxWidth: 120 }}>
            <label style={S.label}>Currency</label>
            <select style={S.select} value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="JPY">JPY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
          {currency !== 'JPY' && (
            <div style={{ ...S.field, maxWidth: 120 }}>
              <label style={S.label}>JPY Rate</label>
              <input
                style={S.input}
                type="number"
                value={jpyRate}
                onChange={e => setJpyRate(Number(e.target.value) || DEFAULT_JPY_RATE)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderLineItems(): JSX.Element {
    return (
      <div style={S.section}>
        <div style={{ ...S.sectionTitle, justifyContent: 'space-between' }}>
          <span>Line Items</span>
          <button style={S.btnSm(T.accent)} onClick={addItem}>+ Add Item</button>
        </div>

        {/* Header */}
        {!IS_MOBILE && (
          <div style={{ display: 'flex', gap: 8, padding: '0 8px', marginBottom: 6 }}>
            <span style={{ ...S.label, flex: 3, marginBottom: 0 }}>Item</span>
            <span style={{ ...S.label, flex: 1, marginBottom: 0 }}>Qty</span>
            <span style={{ ...S.label, flex: 1, marginBottom: 0 }}>Unit</span>
            <span style={{ ...S.label, flex: 1.5, marginBottom: 0 }}>Unit Price</span>
            <span style={{ ...S.label, flex: 1, marginBottom: 0 }}>Tax %</span>
            <span style={{ ...S.label, flex: 1.5, marginBottom: 0, textAlign: 'right' }}>Amount</span>
            <span style={{ width: 80 }} />
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} style={S.itemRow}>
            {/* Product name with search */}
            <div style={{ flex: 3, position: 'relative', minWidth: IS_MOBILE ? '100%' : 'auto' }}>
              <input
                style={{ ...S.input, fontSize: 12 }}
                placeholder="Product name..."
                value={item.name}
                onChange={e => {
                  updateItem(item.id, 'name', e.target.value);
                  setActiveItemId(item.id);
                  searchProducts(e.target.value);
                }}
                onFocus={() => setActiveItemId(item.id)}
              />
              {showProductDropdown && activeItemId === item.id && productResults.length > 0 && (
                <div style={S.searchDropdown}>
                  {productResults.map((p: any) => (
                    <div
                      key={p.id}
                      style={S.searchItem}
                      onMouseDown={() => selectProduct(p, item.id)}
                    >
                      <strong>{p.name}</strong>
                      {p.sku && <span style={{ marginLeft: 8, color: T.muted }}>{p.sku}</span>}
                      {p.unit_price != null && (
                        <span style={{ marginLeft: 8, color: T.accent }}>
                          {fmtCurrency(p.unit_price, p.currency || currency)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity */}
            <div style={{ flex: 1, minWidth: IS_MOBILE ? 60 : 'auto' }}>
              {IS_MOBILE && <label style={{ ...S.label, fontSize: 10 }}>Qty</label>}
              <input
                style={{ ...S.input, fontSize: 12, textAlign: 'right' }}
                type="number"
                min={1}
                value={item.quantity}
                onChange={e => updateItem(item.id, 'quantity', Number(e.target.value) || 1)}
              />
            </div>

            {/* Unit */}
            <div style={{ flex: 1, minWidth: IS_MOBILE ? 60 : 'auto' }}>
              {IS_MOBILE && <label style={{ ...S.label, fontSize: 10 }}>Unit</label>}
              <input
                style={{ ...S.input, fontSize: 12 }}
                placeholder="pcs"
                value={item.unit}
                onChange={e => updateItem(item.id, 'unit', e.target.value)}
              />
            </div>

            {/* Unit price */}
            <div style={{ flex: 1.5, minWidth: IS_MOBILE ? 80 : 'auto' }}>
              {IS_MOBILE && <label style={{ ...S.label, fontSize: 10 }}>Price</label>}
              <input
                style={{ ...S.input, fontSize: 12, textAlign: 'right' }}
                type="number"
                min={0}
                value={item.unitPrice}
                onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value) || 0)}
              />
            </div>

            {/* Tax rate */}
            <div style={{ flex: 1, minWidth: IS_MOBILE ? 50 : 'auto' }}>
              {IS_MOBILE && <label style={{ ...S.label, fontSize: 10 }}>Tax%</label>}
              <select
                style={{ ...S.select, fontSize: 12 }}
                value={item.taxRate}
                onChange={e => updateItem(item.id, 'taxRate', Number(e.target.value))}
              >
                <option value={0}>0%</option>
                <option value={8}>8%</option>
                <option value={10}>10%</option>
              </select>
            </div>

            {/* Amount */}
            <div style={{ flex: 1.5, textAlign: 'right', fontSize: 12, fontWeight: 600, minWidth: IS_MOBILE ? 80 : 'auto' }}>
              {IS_MOBILE && <label style={{ ...S.label, fontSize: 10 }}>Amount</label>}
              {fmtCurrency(item.quantity * item.unitPrice, currency)}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 4, width: 80, justifyContent: 'flex-end' }}>
              <button style={S.btnSm('#eee', T.sub)} onClick={() => moveItem(item.id, -1)} title="Move up">^</button>
              <button style={S.btnSm('#eee', T.sub)} onClick={() => moveItem(item.id, 1)} title="Move down">v</button>
              <button style={S.btnSm('#eee', T.sub)} onClick={() => duplicateItem(item.id)} title="Duplicate">D</button>
              <button
                style={S.btnSm(items.length > 1 ? '#fee' : '#eee', items.length > 1 ? T.red : T.muted)}
                onClick={() => removeItem(item.id)}
                title="Remove"
              >
                x
              </button>
            </div>

            {/* Description row */}
            {item.description && (
              <div style={{ width: '100%', paddingLeft: 8 }}>
                <input
                  style={{ ...S.input, fontSize: 11, color: T.sub, border: 'none', padding: '2px 0' }}
                  placeholder="Description..."
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                />
              </div>
            )}
          </div>
        ))}

        {/* Totals */}
        <div style={{ marginTop: 16, textAlign: 'right', fontSize: 13 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: T.sub }}>Subtotal: </span>
            <strong>{fmtCurrency(subtotal, currency)}</strong>
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: T.sub }}>Tax: </span>
            <strong>{fmtCurrency(taxTotal, currency)}</strong>
          </div>
          {includeShipping && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: T.sub }}>Shipping: </span>
              <strong>{fmtCurrency(shippingCost, currency)}</strong>
            </div>
          )}
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, color: T.primary }}>
            Total: {fmtCurrency(grandTotal, currency)}
            {currency !== 'JPY' && (
              <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>
                ({fmtYen(Math.round(grandTotal * jpyRate))})
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderShipping(): JSX.Element {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeShipping}
              onChange={e => setIncludeShipping(e.target.checked)}
            />
            Include Shipping
          </label>
        </div>
        {includeShipping && (
          <>
            <div style={S.row}>
              <div style={S.field}>
                <label style={S.label}>Shipping Type</label>
                <select
                  style={S.select}
                  value={shippingCalc.type}
                  onChange={e => setShippingCalc(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="sea">Sea</option>
                  <option value="air">Air</option>
                  <option value="domestic">Domestic</option>
                </select>
              </div>
              <div style={S.field}>
                <label style={S.label}>Weight (kg)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  value={shippingCalc.weight}
                  onChange={e => setShippingCalc(prev => ({ ...prev, weight: Number(e.target.value) || 0 }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button style={S.btn(T.accent)} onClick={calculateShipping}>Calculate</button>
              </div>
            </div>
            {shippingCalc.zone && (
              <div style={{ fontSize: 11, color: T.sub }}>
                Zone: {shippingCalc.zone} | Calculated: {fmtCurrency(shippingCalc.cost, currency)}
              </div>
            )}
            <div style={{ ...S.row, marginTop: 8 }}>
              <div style={S.field}>
                <label style={S.label}>Shipping Cost (override)</label>
                <input
                  style={S.input}
                  type="number"
                  min={0}
                  value={shippingCost}
                  onChange={e => setShippingCost(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderPaymentBank(): JSX.Element {
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>Payment & Notes</div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Payment Terms</label>
            <textarea
              style={S.textarea}
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              placeholder="e.g. Net 30, 50% advance..."
            />
          </div>
        </div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Bank Account</label>
            <select
              style={S.select}
              value={selectedBankId}
              onChange={e => setSelectedBankId(e.target.value)}
            >
              <option value="">-- None --</option>
              {bankAccounts.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} - {b.bank_name} ({b.account_number})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={S.row}>
          <div style={S.field}>
            <label style={S.label}>Notes</label>
            <textarea
              style={S.textarea}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>
    );
  }

  function renderPreview(): JSX.Element {
    const bank = bankAccounts.find((b: any) => b.id === selectedBankId);
    const docTitle = type === 'quotation' ? 'QUOTATION' : 'INVOICE';
    const docTitleJa = type === 'quotation' ? 'Quotation' : 'Invoice';

    return (
      <div style={S.previewBox}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: T.primary }}>
              {docTitle}
            </h2>
            <div style={{ fontSize: 11, color: T.sub, marginTop: 4 }}>
              No. {docNumber}
            </div>
            <div style={{ fontSize: 11, color: T.sub }}>
              Date: {fmt(docDate)}
            </div>
            {type === 'quotation' && validUntil && (
              <div style={{ fontSize: 11, color: T.sub }}>
                Valid until: {fmt(validUntil)}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: 11 }}>
            <div style={{ fontWeight: 700 }}>{companyInfo.company_name || 'GS Sales'}</div>
            {companyInfo.address && <div>{companyInfo.address}</div>}
            {companyInfo.phone && <div>TEL: {companyInfo.phone}</div>}
            {companyInfo.email && <div>Email: {companyInfo.email}</div>}
            {companyInfo.registration_number && <div>Registration: {companyInfo.registration_number}</div>}
          </div>
        </div>

        {/* To */}
        <div style={{ marginBottom: 20, padding: 12, background: T.bg, borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>TO:</div>
          <div style={{ fontWeight: 700 }}>{selectedAccount?.name || '-'}</div>
          {selectedContact && <div>Attn: {selectedContact.name}</div>}
          {selectedAccount?.address_billing && <div>{selectedAccount.address_billing}</div>}
        </div>

        {subject && (
          <div style={{ marginBottom: 16, fontWeight: 600 }}>
            Subject: {subject}
          </div>
        )}

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ background: T.primary, color: '#fff' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10 }}>#</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10 }}>Item</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>Qty</th>
              <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10 }}>Unit</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>Unit Price</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>Tax</th>
              <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                <td style={{ padding: '6px 8px', fontSize: 10 }}>{idx + 1}</td>
                <td style={{ padding: '6px 8px', fontSize: 10 }}>
                  {item.name}
                  {item.description && (
                    <div style={{ fontSize: 9, color: T.muted }}>{item.description}</div>
                  )}
                </td>
                <td style={{ padding: '6px 8px', fontSize: 10, textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '6px 8px', fontSize: 10 }}>{item.unit}</td>
                <td style={{ padding: '6px 8px', fontSize: 10, textAlign: 'right' }}>
                  {fmtCurrency(item.unitPrice, currency)}
                </td>
                <td style={{ padding: '6px 8px', fontSize: 10, textAlign: 'right' }}>{item.taxRate}%</td>
                <td style={{ padding: '6px 8px', fontSize: 10, textAlign: 'right', fontWeight: 600 }}>
                  {fmtCurrency(item.quantity * item.unitPrice, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <div style={{ fontSize: 11, marginBottom: 2 }}>
            Subtotal: <strong>{fmtCurrency(subtotal, currency)}</strong>
          </div>
          <div style={{ fontSize: 11, marginBottom: 2 }}>
            Tax: <strong>{fmtCurrency(taxTotal, currency)}</strong>
          </div>
          {includeShipping && shippingCost > 0 && (
            <div style={{ fontSize: 11, marginBottom: 2 }}>
              Shipping: <strong>{fmtCurrency(shippingCost, currency)}</strong>
            </div>
          )}
          <div style={{
            fontSize: 16, fontWeight: 700, marginTop: 8, paddingTop: 8,
            borderTop: `2px solid ${T.primary}`,
          }}>
            Total: {fmtCurrency(grandTotal, currency)}
          </div>
          {currency !== 'JPY' && (
            <div style={{ fontSize: 10, color: T.muted }}>
              (Approx. {fmtYen(Math.round(grandTotal * jpyRate))} @ {jpyRate} JPY/{currency})
            </div>
          )}
        </div>

        {/* Payment terms */}
        {paymentTerms && (
          <div style={{ marginBottom: 16, padding: 10, background: T.bg, borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Payment Terms:</div>
            <div style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>{paymentTerms}</div>
          </div>
        )}

        {/* Bank info */}
        {bank && (
          <div style={{ marginBottom: 16, padding: 10, background: T.bg, borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Bank Account:</div>
            <div style={{ fontSize: 10 }}>
              <div>Bank: {bank.bank_name}{bank.branch ? ` / ${bank.branch}` : ''}</div>
              <div>Account: {bank.account_number}{bank.account_type ? ` (${bank.account_type})` : ''}</div>
              <div>Name: {bank.name}</div>
              {bank.swift_code && <div>SWIFT: {bank.swift_code}</div>}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div style={{ marginBottom: 16, padding: 10, background: T.bg, borderRadius: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Notes:</div>
            <div style={{ fontSize: 10, whiteSpace: 'pre-wrap' }}>{notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 9, color: T.muted, marginTop: 24, paddingTop: 12, borderTop: `1px solid ${T.borderLight}` }}>
          {companyInfo.company_name || 'GS Sales'} | {docTitleJa} #{docNumber}
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div style={S.overlay}>
      <div style={S.container}>
        {/* Header bar */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              style={{ ...S.btn('transparent', T.primary), padding: '6px 10px' }}
              onClick={onBack}
            >
              Back
            </button>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.primary }}>
              {editDoc ? 'Edit' : 'New'} {type === 'quotation' ? 'Quotation' : 'Invoice'}
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={S.btn(saving ? T.muted : T.accent)}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button style={S.tab(activeTab === 'edit')} onClick={() => setActiveTab('edit')}>
            Edit
          </button>
          <button style={S.tab(activeTab === 'preview')} onClick={() => setActiveTab('preview')}>
            Preview
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>
          {activeTab === 'edit' ? (
            <>
              {renderAccountSelector()}
              {renderDocHeader()}
              {renderLineItems()}
              {renderShipping()}
              {renderPaymentBank()}
            </>
          ) : (
            renderPreview()
          )}
        </div>
      </div>
    </div>
  );
}

export default QuotationInvoiceBuilder;
