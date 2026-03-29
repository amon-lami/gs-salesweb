// ============================================
// GS Sales CRM - CSV Importer
// CSVインポート（商談・取引先・連絡先）
// ============================================

import { useState, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T } from '@/lib/constants';

// ── Types ──

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  onDone: () => void;
  currentBiz?: string;
}

type ImportType = 'deals' | 'accounts' | 'contacts';
type Step = 'select' | 'upload' | 'preview' | 'importing' | 'done';

interface LogEntry {
  row: number;
  ok: boolean;
  msg: string;
}

// ── CSV column mappings per type ──

const COLUMNS: Record<ImportType, string[]> = {
  deals: ['name', 'account_name', 'amount', 'stage', 'close_date', 'notes'],
  accounts: ['name', 'website', 'phone', 'email', 'country', 'address_billing', 'notes'],
  contacts: ['name', 'account_name', 'email', 'phone', 'role', 'whatsapp', 'linkedin'],
};

const LABELS: Record<ImportType, string> = {
  deals: '商談',
  accounts: '取引先',
  contacts: '連絡先',
};

// ── CSV Parser (handles BOM, commas in quotes) ──

function parseCSV(text: string): string[][] {
  // Remove BOM
  const clean = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim());
        if (row.some((c) => c !== '')) rows.push(row);
        row = [];
        current = '';
        if (ch === '\r') i++; // skip \n after \r
      } else {
        current += ch;
      }
    }
  }
  // Final row
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.some((c) => c !== '')) rows.push(row);
  }

  return rows;
}

// ── Styles ──

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const modal: React.CSSProperties = {
  background: T.card,
  borderRadius: 12,
  padding: 28,
  width: '90%',
  maxWidth: 720,
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};

const btn = (bg: string, color = '#fff'): React.CSSProperties => ({
  padding: '8px 20px',
  borderRadius: 6,
  border: 'none',
  background: bg,
  color,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 14,
});

// ── Component ──

export function CSVImporter({ client, user, allUsers, accounts, onDone, currentBiz }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select');
  const [importType, setImportType] = useState<ImportType>('deals');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);

  // ── Step 1: Select Type ──

  const handleTypeSelect = (type: ImportType) => {
    setImportType(type);
    setStep('upload');
  };

  // ── Step 2: Upload CSV ──

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) {
        toast('CSVの読み込みに失敗しました', 'error');
        return;
      }
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast('CSVにデータ行がありません', 'error');
        return;
      }
      setHeaders(parsed[0]);
      setRows(parsed.slice(1));
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  // ── Step 3: Preview ──

  const previewRows = rows.slice(0, 5);

  // ── Step 4: Import ──

  const findAccountId = (name: string): string | null => {
    if (!name) return null;
    const lower = name.toLowerCase();
    const found = accounts.find((a) => a.name.toLowerCase() === lower);
    return found?.id ?? null;
  };

  const findUserId = (name: string): string | null => {
    if (!name) return null;
    const lower = name.toLowerCase();
    const found = allUsers.find(
      (u) => (u.name ?? '').toLowerCase() === lower || u.email.toLowerCase() === lower,
    );
    return found?.id ?? null;
  };

  const buildDealRecord = (row: any[], hdr: string[]): Record<string, any> => {
    const get = (col: string) => {
      const idx = hdr.findIndex((h) => h.toLowerCase().replace(/\s+/g, '_') === col);
      return idx >= 0 ? row[idx] ?? '' : '';
    };

    const accountName = get('account_name') || get('account');
    const accountId = findAccountId(accountName);

    return {
      name: get('name') || get('deal_name') || '(no name)',
      account_id: accountId,
      amount: Number(get('amount') || get('金額') || 0),
      stage: get('stage') || 'new',
      close_date: get('close_date') || null,
      notes: get('notes') || null,
      owner_id: user.id,
      created_by: user.id,
      business_id: currentBiz || 'jbeauty',
    };
  };

  const buildAccountRecord = (row: any[], hdr: string[]): Record<string, any> => {
    const get = (col: string) => {
      const idx = hdr.findIndex((h) => h.toLowerCase().replace(/\s+/g, '_') === col);
      return idx >= 0 ? row[idx] ?? '' : '';
    };

    return {
      name: get('name') || get('account_name') || '(no name)',
      website: get('website') || null,
      phone: get('phone') || null,
      email: get('email') || null,
      country: get('country') || null,
      address_billing: get('address_billing') || get('address') || null,
      notes: get('notes') || null,
      owner_id: user.id,
      created_by: user.id,
      attributed_to: user.id,
      category_ids: [],
      business_id: currentBiz || 'jbeauty',
    };
  };

  const buildContactRecord = (row: any[], hdr: string[]): Record<string, any> => {
    const get = (col: string) => {
      const idx = hdr.findIndex((h) => h.toLowerCase().replace(/\s+/g, '_') === col);
      return idx >= 0 ? row[idx] ?? '' : '';
    };

    const accountName = get('account_name') || get('account');
    const accountId = findAccountId(accountName);

    return {
      name: get('name') || get('contact_name') || '(no name)',
      account_id: accountId,
      email: get('email') || null,
      phone: get('phone') || null,
      role: get('role') || null,
      whatsapp: get('whatsapp') || null,
      linkedin: get('linkedin') || null,
      owner_id: user.id,
      is_primary: false,
    };
  };

  const TABLE_MAP: Record<ImportType, string> = {
    deals: 'deals',
    accounts: 'accounts',
    contacts: 'contacts',
  };

  const BUILDER_MAP: Record<ImportType, (row: any[], hdr: string[]) => Record<string, any>> = {
    deals: buildDealRecord,
    accounts: buildAccountRecord,
    contacts: buildContactRecord,
  };

  const runImport = async () => {
    setStep('importing');
    setProgress(0);
    setLog([]);

    const table = TABLE_MAP[importType];
    const builder = BUILDER_MAP[importType];
    const newLog: LogEntry[] = [];
    const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/\s+/g, '_'));

    for (let i = 0; i < rows.length; i++) {
      try {
        const record = builder(rows[i], lowerHeaders);
        const { error } = await client.from(table).insert(record);
        if (error) {
          newLog.push({ row: i + 2, ok: false, msg: error.message });
        } else {
          newLog.push({ row: i + 2, ok: true, msg: `${record.name}` });
        }
      } catch (err: any) {
        newLog.push({ row: i + 2, ok: false, msg: err?.message ?? 'Unknown error' });
      }

      setProgress(Math.round(((i + 1) / rows.length) * 100));
      setLog([...newLog]);
    }

    setStep('done');
    const successCount = newLog.filter((l) => l.ok).length;
    toast(`${successCount}/${rows.length} 件をインポートしました`, successCount > 0 ? 'success' : 'error');
  };

  // ── Reset ──

  const handleClose = () => {
    onDone();
  };

  const handleBack = () => {
    if (step === 'upload') {
      setStep('select');
    } else if (step === 'preview') {
      setStep('upload');
      setHeaders([]);
      setRows([]);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Render ──

  return (
    <div style={overlay} onClick={handleClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: T.primary }}>
            CSVインポート
            {step !== 'select' && (
              <span style={{ fontSize: 13, color: T.muted, marginLeft: 12 }}>
                {LABELS[importType]}
              </span>
            )}
          </h2>
          <button onClick={handleClose} style={{ ...btn('transparent', T.muted), padding: '4px 8px' }}>
            x
          </button>
        </div>

        {/* Step: Select Type */}
        {step === 'select' && (
          <div>
            <p style={{ color: T.sub, marginBottom: 16 }}>インポートするデータの種類を選択してください</p>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['deals', 'accounts', 'contacts'] as ImportType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  style={{
                    ...btn(T.accent),
                    flex: 1,
                    padding: '14px 16px',
                    fontSize: 15,
                  }}
                >
                  {LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <p style={{ color: T.sub, marginBottom: 8 }}>
              CSVファイルを選択してください。1行目はヘッダーとして扱います。
            </p>
            <p style={{ color: T.muted, fontSize: 12, marginBottom: 16 }}>
              必須カラム: {COLUMNS[importType].join(', ')}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleBack} style={btn(T.border, T.primary)}>
                戻る
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div>
            <p style={{ color: T.sub, marginBottom: 8 }}>
              {rows.length} 件のデータが検出されました。先頭5行をプレビューします。
            </p>
            <div style={{ overflow: 'auto', maxHeight: 300, marginBottom: 16, border: `1px solid ${T.border}`, borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, position: 'sticky', top: 0, background: T.bg }}>#</th>
                    {headers.map((h, i) => (
                      <th key={i} style={{ ...thStyle, position: 'sticky', top: 0, background: T.bg }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri}>
                      <td style={tdStyle}>{ri + 2}</td>
                      {row.map((cell: any, ci: number) => (
                        <td key={ci} style={tdStyle}>
                          {String(cell || '').slice(0, 40)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleBack} style={btn(T.border, T.primary)}>
                戻る
              </button>
              <button onClick={runImport} style={btn(T.green)}>
                インポート開始 ({rows.length} 件)
              </button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div>
            <p style={{ color: T.sub, marginBottom: 12 }}>インポート中...</p>
            {/* Progress Bar */}
            <div style={{ background: T.borderLight, borderRadius: 8, height: 24, overflow: 'hidden', marginBottom: 16 }}>
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: T.accent,
                  borderRadius: 8,
                  transition: 'width 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {progress}%
              </div>
            </div>
            {/* Live Log */}
            <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
              {log.slice(-10).map((entry, i) => (
                <div key={i} style={{ color: entry.ok ? T.green : T.red, marginBottom: 2 }}>
                  Row {entry.row}: {entry.ok ? 'OK' : 'NG'} - {entry.msg}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div>
            <p style={{ color: T.green, fontWeight: 600, marginBottom: 12 }}>
              インポート完了
            </p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ ...summaryBox, borderColor: T.green }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.green }}>
                  {log.filter((l) => l.ok).length}
                </div>
                <div style={{ fontSize: 12, color: T.sub }}>成功</div>
              </div>
              <div style={{ ...summaryBox, borderColor: T.red }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: T.red }}>
                  {log.filter((l) => !l.ok).length}
                </div>
                <div style={{ fontSize: 12, color: T.sub }}>エラー</div>
              </div>
            </div>
            {/* Error Log */}
            {log.some((l) => !l.ok) && (
              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 16, fontSize: 12 }}>
                <p style={{ color: T.red, fontWeight: 600, marginBottom: 4 }}>エラー詳細:</p>
                {log
                  .filter((l) => !l.ok)
                  .map((entry, i) => (
                    <div key={i} style={{ color: T.red, marginBottom: 2 }}>
                      Row {entry.row}: {entry.msg}
                    </div>
                  ))}
              </div>
            )}
            <button onClick={handleClose} style={btn(T.accent)}>
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table Styles ──

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  borderBottom: `1px solid ${T.border}`,
  color: T.sub,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: `1px solid ${T.borderLight}`,
  color: T.primary,
  whiteSpace: 'nowrap',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const summaryBox: React.CSSProperties = {
  flex: 1,
  textAlign: 'center',
  padding: 16,
  borderRadius: 8,
  border: '2px solid',
  background: T.bg,
};
