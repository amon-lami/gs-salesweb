// ============================================
// GS Sales CRM - Quotation / Invoice Builder
// 見積書・請求書ビルダー（TypeScript版）
// Converted from web/index.html (2b40a9b) to TypeScript
// ============================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, AppUser } from '@/types/database';
import { T, IS_MOBILE } from '@/lib/constants';

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

interface ClientInfo {
  companyName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  contactPerson: string;
  email: string;
}

interface AiMessage {
  role: 'ai' | 'user';
  text: string;
}

interface DocItem {
  product_id: string;
  jan: string;
  name_en: string;
  name_ja: string;
  quantity: number;
  cost_price: number;
  selling_price: number;
  weight_g: number;
  confidence?: string;
}

interface ShippingBreakdownType {
  baseJpy: number;
  fuel: number;
  markup: number;
  totalJpy: number;
  totalUsd: number;
}

// ── Component ──

export function QuotationInvoiceBuilder({ client, user, allUsers: _allUsers, accounts, contacts, deals, type: mode, onBack, editDoc: _editDoc }: Props) {
  // State: Client Info
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ companyName: '', address: '', city: '', country: '', phone: '', contactPerson: '', email: '' });

  // State: Products
  const [docItems, setDocItems] = useState<DocItem[]>([]);
  const [textInputMode, setTextInputMode] = useState<'ai' | 'search'>('ai');
  const [textInput, setText] = useState('');
  const [parseErr, setParseErr] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseLog, setParseLog] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State: GS-AI
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([{ role: 'ai', text: '発注テキストを貼り付けるか、発注書ファイルをドラッグ＆ドロップしてください。商品と数量を自動解析します。' }]);
  const [aiInput, setAiInput] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiPendingItems, setAiPendingItems] = useState<any[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const aiFileRef = useRef<HTMLInputElement>(null);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [jpy_rate, setJpyRate] = useState(150);

  // State: Shipping
  const [incoterm, setIncoterm] = useState('DAP');
  const [carrier, setCarrier] = useState('UPS');
  const [service, setService] = useState('Expedited');
  const [shippingCountry, setShippingCountry] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingBreakdown, setShippingBreakdown] = useState<ShippingBreakdownType | null>(null);
  const [fobRate, setFobRate] = useState(0.08);
  const [manualShippingCost, setManualShippingCost] = useState('');

  // State: Invoice specifics
  const [currency, setCurrency] = useState('USD');
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [bankDetails, setBankDetails] = useState<any>(null);
  const [currencyRate, setCurrencyRate] = useState(1);
  const [currencyRateEditable, setCurrencyRateEditable] = useState('');

  // State: UI
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const searchTimer = useRef<any>(null);

  // Auto-generate doc number
  useEffect(() => {
    const today = new Date();
    const yyyymmdd = today.getFullYear().toString() + (today.getMonth() + 1).toString().padStart(2, '0') + today.getDate().toString().padStart(2, '0');
    const suffix = mode === 'quotation' ? 'Q' : '';
    setDocNumber(`${yyyymmdd}-${suffix}1`);
  }, [mode]);

  // Filter contacts by selected account
  const filteredContacts = useMemo(() => {
    if (!selectedAccount) return [];
    return (contacts || []).filter((c: any) => c.account_id === selectedAccount.id);
  }, [selectedAccount, contacts]);

  // Services by carrier
  const servicesByCarrier: Record<string, string[]> = {
    UPS: ['Expedited', 'Saver'],
    FedEx: ['Economy', 'Priority'],
  };

  // Handle account selection
  const handleSelectAccount = (acc: any) => {
    setSelectedAccount(acc);
    setClientInfo({
      companyName: acc.name || '',
      address: acc.address || '',
      city: '',
      country: '',
      phone: acc.phone || '',
      contactPerson: '',
      email: '',
    });
    setSelectedContact(null);
  };

  // Handle contact selection
  const handleSelectContact = (contact: any) => {
    setSelectedContact(contact);
    setClientInfo(prev => ({ ...prev, contactPerson: contact.name || '', email: contact.email || '' }));
  };

  // GS-AI: Call order-parse Edge Function
  const callOrderParse = async (text: string | null, fileBase64: string | null, fileType: string | null) => {
    // Get API key from company_settings
    let apiKey = '';
    try {
      const { data } = await client.from('company_settings').select('value').eq('key', 'receipt_ocr_config').limit(1);
      if (data && data[0]) { const cfg = JSON.parse(data[0].value); apiKey = cfg.api_key || ''; }
    } catch (_e) { /* ignore */ }
    if (!apiKey) {
      setAiMessages(prev => [...prev, { role: 'ai', text: '⚠️ Anthropic APIキーが設定されていません。設定 → レシートOCR設定でAPIキーを入力してください。' }]);
      return null;
    }

    // Build product hints (top 200 products for context)
    let hints = '';
    try {
      const { data } = await client.from('product_master').select('jan,name_en,name_ja,brand').limit(200);
      if (data) hints = data.map((p: any) => `${p.jan || ''} | ${p.name_en || p.name_ja || ''} | ${p.brand || ''}`).join('\n');
    } catch (_e) { /* ignore */ }

    const edgeUrl = 'https://yzwrumeukjidsguixqxr.supabase.co/functions/v1/order-parse';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6d3J1bWV1a2ppZHNndWl4cXhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNTcyMzAsImV4cCI6MjA4OTYzMzIzMH0.8KxvbsRnTXJsfB81PSfvszF6RMS5_S_9GoWkV10_41g';
    const resp = await fetch(edgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ANON_KEY, 'apikey': ANON_KEY },
      body: JSON.stringify({ text: text || null, file_base64: fileBase64 || null, file_type: fileType || null, api_key: apiKey, product_hints: hints }),
    });
    const result = await resp.json();
    if (!resp.ok) throw new Error(result.error || 'API Error');
    return result;
  };

  // GS-AI: Process text or file input
  const handleAiSubmit = async (inputText: string | null, fileBase64?: string | null, fileType?: string | null) => {
    if (!inputText && !fileBase64) return;
    setAiProcessing(true);

    if (inputText) setAiMessages(prev => [...prev, { role: 'user', text: inputText }]);
    if (fileBase64) setAiMessages(prev => [...prev, { role: 'user', text: `📎 ファイルをアップロードしました (${fileType})` }]);

    try {
      const result = await callOrderParse(inputText || null, fileBase64 || null, fileType || null);
      if (!result) return;

      const { items, warnings, notes: resultNotes, summary } = result;

      if (!items || items.length === 0) {
        setAiMessages(prev => [...prev, { role: 'ai', text: `商品を検出できませんでした。\n${summary || ''}\n\n別の形式で入力するか、もう少し詳しい情報を入力してください。` }]);
        return;
      }

      // Look up items in product_master
      const resolvedItems: any[] = [];
      const unresolvedItems: any[] = [];

      for (const item of items) {
        let prod: any = null;
        const cleanJan = item.jan ? String(item.jan).replace(/\.0$/, '').replace(/[^\d]/g, '').trim() : '';
        if (cleanJan && cleanJan.length >= 8) {
          const { data } = await client.from('product_master').select('*').eq('jan', cleanJan).limit(1);
          if (data && data.length > 0) prod = data[0];
        }
        if (!prod && item.name_guess) {
          const guess = item.name_guess.trim();
          const q = `%${guess}%`;
          const { data } = await client.from('product_master').select('*').or(`name_en.ilike.${q},name_ja.ilike.${q}`).limit(1);
          if (data && data.length > 0) {
            prod = data[0];
          } else {
            const words = guess.split(/\s+/).filter((w: string) => w.length > 2).slice(0, 3);
            if (words.length >= 2) {
              const q2 = `%${words.join('%')}%`;
              const r2 = await client.from('product_master').select('*').or(`name_en.ilike.${q2},name_ja.ilike.${q2}`).limit(1);
              if (r2.data && r2.data.length > 0) prod = r2.data[0];
            }
          }
        }

        if (prod) {
          resolvedItems.push({
            product_id: prod.id, jan: prod.jan,
            name_en: prod.name_en || prod.name_ja || '',
            name_ja: prod.name_ja || prod.name_en || '',
            quantity: item.quantity || 1,
            cost_price: prod.cost_price || 0,
            selling_price: prod.selling_price || 0,
            weight_g: prod.weight_g || 0,
            confidence: item.confidence || 'high',
          });
        } else {
          unresolvedItems.push(item);
        }
      }

      // Build AI response
      let aiReply = `${summary || `${items.length}件の商品を検出しました`}\n\n`;

      if (resolvedItems.length > 0) {
        aiReply += `✅ **マッチした商品 (${resolvedItems.length}件):**\n`;
        resolvedItems.forEach((r: any) => {
          const conf = r.confidence === 'high' ? '🟢' : r.confidence === 'medium' ? '🟡' : '🔴';
          aiReply += `${conf} ${r.name_en} (${r.jan}) × ${r.quantity}\n`;
        });
      }

      if (unresolvedItems.length > 0) {
        aiReply += `\n❌ **見つからなかった商品 (${unresolvedItems.length}件):**\n`;
        unresolvedItems.forEach((u: any) => {
          aiReply += `・${u.name_guess || u.jan || '不明'} × ${u.quantity || 1}\n`;
        });
      }

      if (warnings && warnings.length > 0) {
        aiReply += `\n⚠️ 注意:\n`;
        warnings.forEach((w: string) => { aiReply += `・${w}\n`; });
      }

      if (resultNotes && resultNotes.length > 0) {
        aiReply += `\n📋 特記事項（要確認）:\n`;
        resultNotes.forEach((n: string) => { aiReply += `・${n}\n`; });
      }

      if (resolvedItems.length > 0) {
        aiReply += `\nこの内容で追加しますか？`;
        setAiPendingItems(resolvedItems);
      }

      setAiMessages(prev => [...prev, { role: 'ai', text: aiReply }]);
    } catch (e: any) {
      setAiMessages(prev => [...prev, { role: 'ai', text: `❌ エラーが発生しました: ${e.message}` }]);
    } finally {
      setAiProcessing(false);
      setAiInput('');
    }
  };

  // GS-AI: Confirm and add pending items
  const confirmAiItems = () => {
    if (!aiPendingItems) return;
    setDocItems(prev => [...prev, ...aiPendingItems]);
    setAiMessages(prev => [...prev, { role: 'ai', text: `✅ ${aiPendingItems.length}件の商品を追加しました！` }]);
    setAiPendingItems(null);
  };

  // GS-AI: Reject pending items
  const rejectAiItems = () => {
    setAiPendingItems(null);
    setAiMessages(prev => [...prev, { role: 'ai', text: 'キャンセルしました。修正したい内容を教えてください。' }]);
  };

  // GS-AI: Handle file drop/select
  const handleAiFile = async (file: File) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setAiMessages(prev => [...prev, { role: 'ai', text: '⚠️ ファイルサイズが10MBを超えています。' }]);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel', csv: 'text/csv', tsv: 'text/tab-separated-values',
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    };

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      await handleAiSubmit(text, null, null);
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (!(window as any).XLSX) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
        document.head.appendChild(s);
        await new Promise<void>((res, rej) => { s.onload = () => res(); s.onerror = () => rej(new Error('SheetJS読み込み失敗')); });
      }
      const buf = await file.arrayBuffer();
      const wb = (window as any).XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csvText = (window as any).XLSX.utils.sheet_to_csv(ws);
      setAiMessages(prev => [...prev, { role: 'user', text: `📎 ${file.name} (${wb.SheetNames[0]})` }]);
      await handleAiSubmit(`ファイル名: ${file.name}\n\n${csvText}`, null, null);
    } else if (ext === 'pdf' || ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      const buf = await file.arrayBuffer();
      const b64 = btoa(new Uint8Array(buf).reduce((data, byte) => data + String.fromCharCode(byte), ''));
      const mime = mimeMap[ext] || `image/${ext}`;
      await handleAiSubmit(null, b64, mime);
    } else {
      setAiMessages(prev => [...prev, { role: 'ai', text: `⚠️ 未対応のファイル形式です: .${ext}\n対応形式: xlsx, csv, tsv, pdf, png, jpg` }]);
    }
  };

  // Auto scroll AI chat
  useEffect(() => { aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);

  // Smart text parser - handles JAN codes, product names, flexible formats
  const parseTextInput = async () => {
    if (!textInput.trim() || !client) { setParseErr('テキストを入力してください'); return; }
    setParseErr('');
    setParsing(true);
    setParseLog([]);
    const log: any[] = [];
    try {
      const lines = textInput.split('\n').filter((l: string) => l.trim());
      const parsedItems: DocItem[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || /^[-=#*]+$/.test(trimmed)) continue;

        const janMatch = trimmed.match(/\b(\d{13}|\d{8})\b/);

        const qtyPatterns = [
          /[x×X]\s*(\d+)/,
          /(\d+)\s*(?:個|pcs|ケース|cs|箱|set|sets|本|枚)/i,
          /(?:qty|数量|QTY)[:\s]*(\d+)/i,
          /\b(\d{1,5})\s*$/,
          /^\s*(\d{1,5})\s+/,
        ];
        let qty = 1;
        for (const pat of qtyPatterns) {
          const m = trimmed.match(pat);
          if (m) { const n = parseInt(m[1]); if (n > 0 && n < 100000) { qty = n; break; } }
        }

        if (janMatch) {
          const jan = janMatch[1];
          const { data } = await client.from('product_master').select('*').eq('jan', jan).limit(1);
          if (data && data.length > 0) {
            const p = data[0];
            parsedItems.push({ product_id: p.id, jan: p.jan, name_en: p.name_en || p.name_ja || '', name_ja: p.name_ja || p.name_en || '', quantity: qty, cost_price: p.cost_price || 0, selling_price: p.selling_price || 0, weight_g: p.weight_g || 0 });
            log.push({ ok: true, text: `✓ ${p.name_en || p.name_ja} (${jan}) × ${qty}` });
          } else {
            log.push({ ok: false, text: `✗ JAN ${jan} が見つかりません` });
          }
        } else {
          let searchText = trimmed.replace(/[x×X]\s*\d+/g, '').replace(/\d+\s*(?:個|pcs|ケース|cs|箱|set|sets|本|枚)/gi, '').replace(/(?:qty|数量)[:\s]*\d+/gi, '').replace(/^\d+\s+/, '').replace(/\s+\d+$/, '').trim();
          if (searchText.length < 2) { log.push({ ok: false, text: `✗ "${trimmed}" → 検索キーワード不足` }); continue; }
          const q = `%${searchText}%`;
          const { data } = await client.from('product_master').select('*').or(`name_ja.ilike.${q},name_en.ilike.${q},brand.ilike.${q}`).limit(1);
          if (data && data.length > 0) {
            const p = data[0];
            parsedItems.push({ product_id: p.id, jan: p.jan, name_en: p.name_en || p.name_ja || '', name_ja: p.name_ja || p.name_en || '', quantity: qty, cost_price: p.cost_price || 0, selling_price: p.selling_price || 0, weight_g: p.weight_g || 0 });
            log.push({ ok: true, text: `✓ "${searchText}" → ${p.name_en || p.name_ja} × ${qty}` });
          } else {
            log.push({ ok: false, text: `✗ "${searchText}" → 該当商品なし` });
          }
        }
      }

      if (parsedItems.length > 0) {
        setDocItems(prev => [...prev, ...parsedItems]);
        log.push({ ok: true, text: `── ${parsedItems.length}件追加しました ──` });
      } else if (log.length === 0) {
        setParseErr('商品が見つかりませんでした');
      }
      setParseLog(log);
    } catch (e: any) {
      setParseErr(e.message);
    } finally {
      setParsing(false);
    }
  };

  // File upload handler (Excel/CSV)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseErr('');
    setParsing(true);
    setParseLog([]);
    const log: any[] = [];
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let rows: any[] = [];

      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text();
        const sep = ext === 'tsv' ? '\t' : ',';
        const lines = text.split('\n').filter((l: string) => l.trim());
        const headers = lines[0].split(sep).map((h: string) => h.trim().replace(/^"|"$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(sep).map((v: string) => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((h: string, j: number) => { row[h] = vals[j] || ''; });
          rows.push(row);
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (!(window as any).XLSX) {
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
          document.head.appendChild(s);
          await new Promise<void>((res, rej) => { s.onload = () => res(); s.onerror = () => rej(new Error('SheetJS読み込み失敗')); });
        }
        const buf = await file.arrayBuffer();
        const wb = (window as any).XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = (window as any).XLSX.utils.sheet_to_json(ws, { defval: '' });
      } else {
        setParseErr(`未対応のファイル形式: .${ext} (xlsx, csv, tsv に対応)`);
        return;
      }

      log.push({ ok: true, text: `ファイル読み込み: ${rows.length}行` });

      if (rows.length === 0) { setParseErr('データが空です'); return; }
      const cols = Object.keys(rows[0]);
      const janCol = cols.find(c => /jan|barcode|バーコード|JAN|EAN|UPC|code|コード|品番/i.test(c));
      const qtyCol = cols.find(c => /qty|quantity|数量|個数|QTY|注文数|order/i.test(c));
      const nameCol = cols.find(c => /product|name|商品名|品名|商品|item|品目/i.test(c));

      log.push({ ok: true, text: `カラム検出: JAN=${janCol || '?'}, 数量=${qtyCol || '?'}, 商品名=${nameCol || '?'}` });

      const parsedItems: DocItem[] = [];
      for (const row of rows) {
        const rawJan = String(janCol ? row[janCol] : '').trim();
        const rawQty = qtyCol ? row[qtyCol] : '1';
        const rawName = nameCol ? String(row[nameCol]).trim() : '';
        const qty = parseInt(String(rawQty).replace(/[^\d]/g, '')) || 1;

        const janNum = rawJan.replace(/[^\d]/g, '');
        if (janNum.length >= 8) {
          const { data } = await client.from('product_master').select('*').eq('jan', janNum).limit(1);
          if (data && data.length > 0) {
            const p = data[0];
            parsedItems.push({ product_id: p.id, jan: p.jan, name_en: p.name_en || p.name_ja || '', name_ja: p.name_ja || p.name_en || '', quantity: qty, cost_price: p.cost_price || 0, selling_price: p.selling_price || 0, weight_g: p.weight_g || 0 });
            log.push({ ok: true, text: `✓ ${p.name_en || p.name_ja} × ${qty}` });
            continue;
          }
        }

        if (rawName && rawName.length >= 2) {
          const q = `%${rawName}%`;
          const { data } = await client.from('product_master').select('*').or(`name_ja.ilike.${q},name_en.ilike.${q}`).limit(1);
          if (data && data.length > 0) {
            const p = data[0];
            parsedItems.push({ product_id: p.id, jan: p.jan, name_en: p.name_en || p.name_ja || '', name_ja: p.name_ja || p.name_en || '', quantity: qty, cost_price: p.cost_price || 0, selling_price: p.selling_price || 0, weight_g: p.weight_g || 0 });
            log.push({ ok: true, text: `✓ "${rawName}" → ${p.name_en || p.name_ja} × ${qty}` });
            continue;
          }
        }
        log.push({ ok: false, text: `✗ ${rawJan || rawName || '不明'} → 該当なし` });
      }

      if (parsedItems.length > 0) {
        setDocItems(prev => [...prev, ...parsedItems]);
        log.push({ ok: true, text: `── ${parsedItems.length}/${rows.length}件 追加完了 ──` });
      }
      setParseLog(log);
    } catch (e: any) {
      setParseErr(e.message);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Search products
  const handleSearch = useCallback(async () => {
    if (!searchInput.trim() || !client) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const q = `%${searchInput}%`;
      const { data, error } = await client.from('product_master').select('*').or(`name_ja.ilike.${q},name_en.ilike.${q},jan.ilike.${q},brand.ilike.${q}`).limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (_e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchInput, client]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchInput) searchTimer.current = setTimeout(() => handleSearch(), 400);
    else setSearchResults([]);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add product from search
  const addProductFromSearch = (prod: any) => {
    const newItem: DocItem = {
      product_id: prod.id, jan: prod.jan,
      name_en: prod.name_en || prod.name_ja || '',
      name_ja: prod.name_ja || prod.name_en || '',
      quantity: addQty,
      cost_price: prod.cost_price || 0,
      selling_price: prod.selling_price || 0,
      weight_g: prod.weight_g || 0,
    };
    setDocItems(prev => [...prev, newItem]);
    setSearchInput('');
    setSearchResults([]);
    setAddQty(1);
  };

  // Update item in table
  const updateItem = (idx: number, field: string, value: any) => {
    setDocItems(prev => {
      const newItems = [...prev];
      newItems[idx] = { ...newItems[idx], [field]: field === 'selling_price' ? parseFloat(value) || 0 : field === 'quantity' ? parseInt(value) || 1 : value };
      return newItems;
    });
  };

  // Remove item
  const removeItem = (idx: number) => {
    setDocItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculate totals
  const { subtotal, totalCostJpy, totalProfit, overallMarginPct, totalWeight } = useMemo(() => {
    let sub = 0, costJpy = 0, profit = 0;
    let weight = 0;

    docItems.forEach(item => {
      const amount = item.selling_price * item.quantity;
      sub += amount;
      const costUsd = (item.cost_price || 0) / jpy_rate;
      const itemProfit = (item.selling_price - costUsd) * item.quantity;
      profit += itemProfit;
      costJpy += (item.cost_price || 0) * item.quantity;
      weight += (item.weight_g || 0) * item.quantity;
    });

    const margin = sub > 0 ? (profit / sub) * 100 : 0;
    return { subtotal: sub, totalCostJpy: costJpy, totalProfit: profit, overallMarginPct: margin, totalWeight: weight / 1000 };
  }, [docItems, jpy_rate]);

  // Calculate shipping (DAP mode)
  const calculateDapShipping = useCallback(async () => {
    if (incoterm !== 'DAP' || !shippingCountry) return;

    try {
      const { data: rates, error: rateErr } = await client.from('shipping_rates').select('*').eq('carrier', carrier).eq('service', service);
      if (rateErr) throw rateErr;

      const { data: zones, error: zoneErr } = await client.from('shipping_zones').select('*').eq('carrier', carrier).eq('service', service).eq('country', shippingCountry);
      if (zoneErr) throw zoneErr;

      if (!zones || zones.length === 0) {
        setShippingBreakdown(null);
        return;
      }

      const zone = zones[0];
      const rate = (rates || []).find((r: any) => r.zone_code === zone.zone_code && r.weight_kg >= totalWeight);

      if (!rate) {
        setShippingBreakdown(null);
        return;
      }

      const { data: settings, error: settingsErr } = await client.from('shipping_settings').select('*').limit(1);
      if (settingsErr) throw settingsErr;

      const fuel = settings?.[0]?.fuel_surcharge_rate || 0.05;
      const markup = settings?.[0]?.dap_markup_rate || 0.15;

      const baseJpy = rate.rate_jpy;
      const withFuel = baseJpy * (1 + fuel);
      const withMarkup = withFuel * (1 + markup);

      const costUsd = withMarkup / jpy_rate;

      setShippingCost(costUsd);
      setShippingBreakdown({ baseJpy, fuel: baseJpy * fuel, markup: withFuel * markup, totalJpy: withMarkup, totalUsd: costUsd });
    } catch (e: any) {
      setSaveErr(`配送料金計算エラー: ${e.message}`);
    }
  }, [incoterm, carrier, service, shippingCountry, totalWeight, jpy_rate, client]);

  // Calculate FOB shipping
  useEffect(() => {
    if (incoterm === 'FOB') {
      setShippingCost(subtotal * fobRate);
      setShippingBreakdown(null);
    } else if (incoterm === 'DAP') {
      calculateDapShipping();
    } else {
      setShippingCost(0);
      setShippingBreakdown(null);
    }
  }, [incoterm, fobRate, subtotal, calculateDapShipping]);

  // Load bank details for currency
  const loadBankDetails = useCallback(async () => {
    if (mode !== 'invoice' || !currency) return;
    try {
      const { data } = await client.from('bank_accounts').select('*').eq('currency', currency).limit(1);
      if (data && data.length > 0) setBankDetails(data[0]);
    } catch (e) {
      console.error('Bank details load error:', e);
    }
  }, [mode, currency, client]);

  useEffect(() => { loadBankDetails(); }, [loadBankDetails]);

  // Load exchange rate
  const loadExchangeRate = useCallback(async () => {
    if (mode !== 'invoice' || currency === 'USD') return;
    try {
      const { data } = await client.from('exchange_rates').select('*').eq('from_currency', 'JPY').eq('to_currency', currency).limit(1);
      if (data && data.length > 0) {
        setCurrencyRate(data[0].rate || 1);
        setCurrencyRateEditable(String(data[0].rate || 1));
      }
    } catch (e) {
      console.error('Exchange rate load error:', e);
    }
  }, [mode, currency, client]);

  useEffect(() => { loadExchangeRate(); }, [loadExchangeRate]);

  // Save document
  const saveDocument = async () => {
    if (docItems.length === 0) { setSaveErr('商品を追加してください'); return; }
    if (!clientInfo.companyName) { setSaveErr('顧客名を入力してください'); return; }

    setSaving(true);
    setSaveErr('');
    try {
      const grandTotal = subtotal + shippingCost;

      const docData = {
        type: mode,
        doc_number: docNumber,
        doc_date: docDate,
        due_date: dueDate,
        account_id: selectedAccount?.id || null,
        contact_id: selectedContact?.id || null,
        deal_id: selectedDeal?.id || null,
        user_id: user?.id || null,
        client_info: clientInfo,
        items: docItems,
        subtotal_usd: subtotal,
        shipping_cost_usd: shippingCost,
        shipping_breakdown: shippingBreakdown,
        grand_total_usd: grandTotal,
        incoterms: incoterm,
        shipping_country: shippingCountry,
        notes,
        currency: mode === 'invoice' ? currency : 'USD',
        exchange_rate: currencyRate,
        created_at: new Date().toISOString(),
      };

      const { error } = await client.from('generated_documents').insert([docData]);
      if (error) throw error;

      setSaveErr('');
      alert(`${mode === 'quotation' ? '見積書' : '請求書'}を保存しました: ${docNumber}`);
      onBack?.();
    } catch (e: any) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const grand = (subtotal + shippingCost) * (mode === 'invoice' ? currencyRate : 1);

  return (
    <div style={{ padding: IS_MOBILE ? 8 : 16, background: T.bg, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 0, color: T.sub }}>&larr;</button>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.primary }}>{mode === 'quotation' ? '見積書作成' : '請求書作成'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 10, color: T.muted, background: T.card, padding: '4px 8px', borderRadius: 4, fontWeight: 600 }}>Step {step}/6</span>
        </div>
      </div>

      {/* Step 1: Client Info */}
      {step === 1 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>顧客選択</div>
            <select value={selectedAccount?.id || ''} onChange={e => { const a = accounts.find((x: any) => x.id === e.target.value); if (a) handleSelectAccount(a); }} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">-- アカウント選択 --</option>
              {(accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {selectedAccount && <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>✓ {selectedAccount.name}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>担当者</div>
            <select value={selectedContact?.id || ''} onChange={e => { const c = filteredContacts.find((x: any) => x.id === e.target.value); if (c) handleSelectContact(c); }} disabled={!selectedAccount} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', opacity: !selectedAccount ? 0.5 : 1 }}>
              <option value="">-- 担当者選択 --</option>
              {filteredContacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {selectedContact && <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>✓ {selectedContact.name}</div>}
          </div>

          <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>案件リンク（オプション）</div>
            <select value={selectedDeal?.id || ''} onChange={e => { const d = deals.find((x: any) => x.id === e.target.value); setSelectedDeal(d || null); }} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
              <option value="">-- 案件を選択 --</option>
              {(deals || []).map((d: any) => <option key={d.id} value={d.id}>{d.opportunity_name}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>会社名</div>
              <input value={clientInfo.companyName} onChange={e => setClientInfo(prev => ({ ...prev, companyName: e.target.value }))} placeholder="例: Acme Corp" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>担当者名</div>
              <input value={clientInfo.contactPerson} onChange={e => setClientInfo(prev => ({ ...prev, contactPerson: e.target.value }))} placeholder="例: John Smith" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>住所</div>
              <input value={clientInfo.address} onChange={e => setClientInfo(prev => ({ ...prev, address: e.target.value }))} placeholder="Street address" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>都市/国</div>
              <input value={clientInfo.city} onChange={e => setClientInfo(prev => ({ ...prev, city: e.target.value }))} placeholder="City, Country" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>電話</div>
              <input value={clientInfo.phone} onChange={e => setClientInfo(prev => ({ ...prev, phone: e.target.value }))} placeholder="Phone" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>メール</div>
              <input value={clientInfo.email} onChange={e => setClientInfo(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" type="email" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2', display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: 10, background: T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>次へ &rarr;</button>
          </div>
        </div>
      )}

      {/* Step 2: Add Products */}
      {step === 2 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${T.border}`, paddingBottom: 12 }}>
            {([{ k: 'ai' as const, l: 'GS-AI' }, { k: 'search' as const, l: '手動検索' }]).map(t => (
              <button key={t.k} onClick={() => setTextInputMode(t.k)} style={{ flex: 1, padding: 8, background: textInputMode === t.k ? T.primary : '#fff', color: textInputMode === t.k ? '#fff' : T.primary, border: `1px solid ${T.primary}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{t.l}</button>
            ))}
          </div>

          {textInputMode === 'ai' ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleAiFile(f); }}
              style={{ display: 'flex', flexDirection: 'column', gap: 0, border: dragOver ? `2px dashed ${T.primary}` : '2px dashed transparent', borderRadius: 8, transition: 'border 0.2s' }}
            >
              {/* AI Chat Messages */}
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: T.bg, borderRadius: 8 }}>
                {aiMessages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%', padding: '8px 12px', borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: msg.role === 'user' ? T.primary : T.card,
                      color: msg.role === 'user' ? '#fff' : T.primary,
                      fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {msg.role === 'ai' && <div style={{ fontSize: 9, fontWeight: 700, color: T.accent, marginBottom: 3 }}>GS-AI</div>}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiProcessing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '8px 12px', borderRadius: '12px 12px 12px 2px', background: T.card, fontSize: 11, color: T.muted }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.accent, marginBottom: 3 }}>GS-AI</div>
                      解析中...
                    </div>
                  </div>
                )}
                <div ref={aiChatEndRef} />
              </div>

              {/* Confirm/Reject buttons */}
              {aiPendingItems && (
                <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
                  <button onClick={confirmAiItems} style={{ flex: 1, padding: 10, background: T.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>追加する ({aiPendingItems.length}件)</button>
                  <button onClick={rejectAiItems} style={{ flex: 1, padding: 10, background: '#fff', color: T.red, border: `1px solid ${T.red}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>やり直す</button>
                </div>
              )}

              {/* Input area */}
              <div style={{ display: 'flex', gap: 6, padding: '8px 0 0' }}>
                <input ref={aiFileRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.pdf,.png,.jpg,.jpeg" onChange={e => { const f = e.target.files?.[0]; if (f) handleAiFile(f); e.target.value = ''; }} style={{ display: 'none' }} />
                <button onClick={() => aiFileRef.current?.click()} disabled={aiProcessing} style={{ padding: '8px 12px', background: T.borderLight, border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }} title="ファイルアップロード">📎</button>
                <input value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing && aiInput.trim() && !aiProcessing) { handleAiSubmit(aiInput); } }} placeholder="発注テキストを貼り付け、またはファイルをD&D..." disabled={aiProcessing} style={{ flex: 1, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
                <button onClick={() => { if (aiInput.trim()) handleAiSubmit(aiInput); }} disabled={aiProcessing || !aiInput.trim()} style={{ padding: '8px 16px', background: aiProcessing || !aiInput.trim() ? '#ccc' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: aiProcessing ? 'default' : 'pointer' }}>送信</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="商品名/JAN/ブランドで検索" style={{ padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
              <input type="number" value={addQty} onChange={e => setAddQty(parseInt(e.target.value) || 1)} placeholder="数量" min="1" style={{ padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
              <div>{searching ? '検索中...' : '検索結果: ' + searchResults.length + '件'}</div>
              {searchResults.length > 0 && (
                <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 3', display: 'grid', gridTemplateColumns: '1fr', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {searchResults.map((p: any) => (
                    <div key={p.id} onClick={() => addProductFromSearch(p)} style={{ padding: 8, background: T.borderLight, borderRadius: 6, cursor: 'pointer', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div><strong>{p.name_en || p.name_ja}</strong> · {p.jan}</div>
                      <button style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+追加</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Product Table */}
          {docItems.length > 0 && (
            <div style={{ overflowX: 'auto', marginTop: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: T.borderLight, borderBottom: `1px solid ${T.border}` }}>
                    <th style={{ padding: 8, textAlign: 'left', fontWeight: 700, color: T.primary }}>商品名</th>
                    <th style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: T.primary }}>数量</th>
                    <th style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.primary }}>単価(USD)</th>
                    <th style={{ padding: 8, textAlign: 'right', fontWeight: 700, color: T.primary }}>金額</th>
                    <th style={{ padding: 8, textAlign: 'center', fontWeight: 700, color: T.primary }}>削除</th>
                  </tr>
                </thead>
                <tbody>
                  {docItems.map((item, idx) => {
                    const amount = item.selling_price * item.quantity;
                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                        <td style={{ padding: 8, textAlign: 'left' }}>{item.name_en}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} min="1" style={{ width: 50, padding: '4px 6px', border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: 8, textAlign: 'right' }}>
                          <input type="number" value={item.selling_price} onChange={e => updateItem(idx, 'selling_price', e.target.value)} step="0.01" style={{ width: 70, padding: '4px 6px', border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, textAlign: 'right' }} />
                        </td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>${amount.toFixed(2)}</td>
                        <td style={{ padding: 8, textAlign: 'center' }}>
                          <button onClick={() => removeItem(idx)} style={{ background: T.red, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>削除</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: 12, background: T.borderLight, borderRadius: 6, marginTop: 8, display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr 1fr', gap: 12, fontSize: 12 }}>
                <div><strong>小計:</strong> ${subtotal.toFixed(2)}</div>
                <div><strong>利益:</strong> ${totalProfit.toFixed(2)} ({overallMarginPct.toFixed(1)}%)</div>
                <div><strong>仕入原価:</strong> &yen;{totalCostJpy.toLocaleString()}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: 10, background: '#fff', color: T.primary, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>&larr; 戻る</button>
            <button onClick={() => setStep(3)} disabled={docItems.length === 0} style={{ flex: 1, padding: 10, background: docItems.length === 0 ? '#ccc' : T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: docItems.length === 0 ? 'default' : 'pointer', opacity: docItems.length === 0 ? 0.6 : 1 }}>次へ &rarr;</button>
          </div>
        </div>
      )}

      {/* Step 3: Shipping & Incoterms */}
      {step === 3 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 8 }}>インコタームズ</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['DAP', 'FOB', 'EXW', 'CIF'].map(inc => (
                <button key={inc} onClick={() => setIncoterm(inc)} style={{ padding: '8px 12px', background: incoterm === inc ? T.primary : '#fff', color: incoterm === inc ? '#fff' : T.primary, border: `1px solid ${T.primary}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {inc}
                </button>
              ))}
            </div>
          </div>

          {incoterm === 'DAP' && (
            <div style={{ display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr', gap: 12, padding: 12, background: T.borderLight, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>配送業者</div>
                <select value={carrier} onChange={e => setCarrier(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>サービス</div>
                <select value={service} onChange={e => setService(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                  {(servicesByCarrier[carrier] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>配送先国</div>
                <input value={shippingCountry} onChange={e => setShippingCountry(e.target.value)} placeholder="例: United States" style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
              </div>
              {shippingBreakdown && (
                <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2', padding: 10, background: T.card, borderRadius: 6, fontSize: 10, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  <div>基本料金: &yen;{shippingBreakdown.baseJpy.toLocaleString()}</div>
                  <div>燃油サーチャージ: &yen;{shippingBreakdown.fuel.toLocaleString()}</div>
                  <div>マークアップ: &yen;{shippingBreakdown.markup.toLocaleString()}</div>
                  <div style={{ fontWeight: 700 }}>合計: ${shippingBreakdown.totalUsd.toFixed(2)}</div>
                </div>
              )}
              <div style={{ gridColumn: IS_MOBILE ? 'auto' : 'span 2', fontSize: 9, color: T.muted }}>総重量: {totalWeight.toFixed(2)} kg</div>
            </div>
          )}

          {incoterm === 'FOB' && (
            <div style={{ padding: 12, background: T.borderLight, borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>FOB料率</div>
              <input type="number" value={fobRate} onChange={e => setFobRate(parseFloat(e.target.value) || 0)} step="0.01" placeholder="0.08" style={{ width: '100%', maxWidth: 120, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
              <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>配送料: ${(subtotal * fobRate).toFixed(2)}</div>
            </div>
          )}

          {(incoterm === 'EXW' || incoterm === 'CIF') && (
            <div style={{ padding: 12, background: T.borderLight, borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>配送料金（USD）</div>
              <input type="number" value={manualShippingCost} onChange={e => setManualShippingCost(e.target.value)} placeholder="0.00" step="0.01" style={{ width: '100%', maxWidth: 120, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: 10, background: '#fff', color: T.primary, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>&larr; 戻る</button>
            <button onClick={() => setStep(mode === 'invoice' ? 4 : 5)} style={{ flex: 1, padding: 10, background: T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>次へ &rarr;</button>
          </div>
        </div>
      )}

      {/* Step 4: Invoice Currency (Invoice only) */}
      {mode === 'invoice' && step === 4 && (
        <div style={{ background: T.card, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 8 }}>通貨</div>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: '100%', maxWidth: 300, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          {currency !== 'USD' && (
            <div style={{ padding: 12, background: T.borderLight, borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>JPY &rarr; {currency} 為替レート</div>
              <input type="number" value={currencyRateEditable} onChange={e => { setCurrencyRateEditable(e.target.value); setCurrencyRate(parseFloat(e.target.value) || 1); }} step="0.001" style={{ width: '100%', maxWidth: 150, padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
              <div style={{ fontSize: 9, color: T.muted, marginTop: 4 }}>現在: 1 JPY = {currencyRate.toFixed(6)} {currency}</div>
            </div>
          )}

          {bankDetails && (
            <div style={{ padding: 12, background: T.borderLight, borderRadius: 8, fontSize: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>銀行情報 ({currency})</div>
              <div style={{ color: T.muted, lineHeight: 1.6 }}>
                {bankDetails.bank_name}<br />
                {bankDetails.account_number}<br />
                {bankDetails.swift_code}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(3)} style={{ flex: 1, padding: 10, background: '#fff', color: T.primary, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>&larr; 戻る</button>
            <button onClick={() => setStep(5)} style={{ flex: 1, padding: 10, background: T.primary, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>次へ &rarr;</button>
          </div>
        </div>
      )}

      {/* Step 5: Summary & Output */}
      {step === (mode === 'invoice' ? 5 : 4) && (
        <div style={{ background: T.card, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>書類番号</div>
              <input value={docNumber} onChange={e => setDocNumber(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>書類日</div>
              <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>{mode === 'invoice' ? '支払期限' : '有効期限'}</div>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }} />
            </div>
          </div>

          <div style={{ padding: 12, background: T.borderLight, borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, fontWeight: 600 }}>
              <div>小計: ${subtotal.toFixed(2)}</div>
              <div>配送料: ${shippingCost.toFixed(2)}</div>
              <div style={{ fontSize: 13, color: T.primary }}>合計 ({currency}): {currency === 'USD' ? '$' : ''}{grand.toFixed(2)}</div>
              <div style={{ color: T.green }}>利益: ${totalProfit.toFixed(2)} ({overallMarginPct.toFixed(1)}%)</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 4 }}>備考</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="特記事項、配送条件など" style={{ width: '100%', padding: 10, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', minHeight: 80, resize: 'none', boxSizing: 'border-box' }} />
          </div>

          {saveErr && <div style={{ padding: 10, background: T.red + '15', color: T.red, borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{saveErr}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(mode === 'invoice' ? 4 : 3)} style={{ flex: 1, padding: 10, background: '#fff', color: T.primary, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>&larr; 戻る</button>
            <button onClick={saveDocument} disabled={saving} style={{ flex: 1, padding: 10, background: saving ? '#ccc' : T.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuotationInvoiceBuilder;
