import { useState, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, INCOTERMS_OPTIONS, SHIPPING } from '@/lib/constants';

interface InvoiceFile {
  url: string;
  name: string;
  date: string;
}

export function getInvoiceFiles(deal: Deal): InvoiceFile[] {
  const files: InvoiceFile[] = [];
  const raw = (deal as any).invoice_files;
  if (raw && Array.isArray(raw)) {
    files.push(...raw);
  } else if (deal.invoice_file_url) {
    files.push({ url: deal.invoice_file_url, name: '請求書', date: deal.invoice_date || '' });
  }
  return files;
}

interface Props {
  deal: Deal;
  client: SupabaseClient;
  user: { id: string };
  onClose: () => void;
  onSaved?: () => void;
  mode?: 'add_file' | 'default';
}

export function InvoiceUploadModal({ deal, client, onClose, onSaved, mode }: Props) {
  const toast = useToast();
  const fileOnly = mode === 'add_file';
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState(deal?.amount ? String(Math.round(Number(deal.amount))) : '');
  const [invoiceAmountDisplay, setInvoiceAmountDisplay] = useState(deal?.amount ? Number(deal.amount).toLocaleString() : '');
  const [incoterms, setIncoterms] = useState(deal?.incoterms || '');
  const [incotermsOther, setIncotermsOther] = useState('');
  const [shipping, setShipping] = useState(deal?.shipping_type || '');
  const [prepaymentPercent, setPrepaymentPercent] = useState(deal?.prepayment_percent || 0);
  const [paymentTerms, setPaymentTerms] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const existingFiles = getInvoiceFiles(deal);

  const handleAmountChange = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    setInvoiceAmount(num);
    setInvoiceAmountDisplay(num ? Number(num).toLocaleString() : '');
  };

  const save = async () => {
    if (!fileOnly && !invoiceAmount) { setErr('確定金額を入力してください'); return; }
    if (fileOnly && !fileUpload) { setErr('ファイルを選択してください'); return; }
    setSaving(true); setErr('');
    try {
      const newInvoiceFiles = [...existingFiles];
      if (fileUpload) {
        const ext = fileUpload.name.includes('.') ? fileUpload.name.split('.').pop()!.toLowerCase() : '';
        const safeName = Date.now() + '_' + Math.random().toString(36).slice(2, 8) + (ext ? '.' + ext : '');
        const fp = 'invoices/' + deal.id + '/' + safeName;
        const ct = fileUpload.type || 'application/octet-stream';
        const { error: ue } = await client.storage.from('chat-files').upload(fp, fileUpload, { cacheControl: '3600', upsert: true, contentType: ct });
        if (ue) throw ue;
        const { data: ud } = client.storage.from('chat-files').getPublicUrl(fp);
        const invoiceUrl = ud?.publicUrl || '';
        if (invoiceUrl) {
          newInvoiceFiles.push({ url: invoiceUrl, name: fileUpload.name, date: new Date().toISOString().split('T')[0] });
        }
      }
      let updateData: Record<string, unknown>;
      if (fileOnly) {
        updateData = { invoice_files: newInvoiceFiles.length > 0 ? newInvoiceFiles : null, invoice_file_url: newInvoiceFiles.length > 0 ? newInvoiceFiles[0].url : null, updated_at: new Date().toISOString() };
      } else {
        const finalIncoterms = incoterms === 'Other' ? incotermsOther : incoterms;
        updateData = {
          invoice_amount: Number(invoiceAmount) || 0,
          amount: Number(invoiceAmount) || 0,
          invoice_date: new Date().toISOString().split('T')[0],
          payment_terms: paymentTerms,
          invoice_files: newInvoiceFiles.length > 0 ? newInvoiceFiles : null,
          invoice_file_url: newInvoiceFiles.length > 0 ? newInvoiceFiles[0].url : null,
          updated_at: new Date().toISOString(),
        };
        if (finalIncoterms) updateData.incoterms = finalIncoterms;
        if (shipping) updateData.shipping_type = shipping;
        updateData.prepayment_percent = Number(prepaymentPercent) || 0;
        updateData.payment_status = Number(prepaymentPercent) >= 100 ? 'full' : Number(prepaymentPercent) > 0 ? 'partial' : 'none';
      }
      const { error: de } = await client.from('sales_deals').update(updateData).eq('id', deal.id);
      if (de) throw de;
      toast('請求情報を更新しました！');
      if (onSaved) onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const removeInvoice = async (idx: number) => {
    setSaving(true); setErr('');
    try {
      const updated = [...existingFiles]; updated.splice(idx, 1);
      const updateData = { invoice_files: updated.length > 0 ? updated : null, invoice_file_url: updated.length > 0 ? updated[0].url : null, updated_at: new Date().toISOString() };
      const { error } = await client.from('sales_deals').update(updateData).eq('id', deal.id);
      if (error) throw error;
      toast('請求書を削除しました');
      if (onSaved) onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const I: React.CSSProperties = { width: '100%', border: `1px solid ${T.border}`, borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' };
  const L: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3, marginTop: 8 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', width: '90%', maxWidth: 400, boxShadow: '0 12px 40px rgba(0,0,0,.12)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.primary }}>{fileOnly ? '請求書ファイル追加' : '請求情報'}</div>

        {existingFiles.length > 0 && (<>
          <label style={L}>添付済み請求書 ({existingFiles.length})</label>
          <div style={{ marginBottom: 8 }}>
            {existingFiles.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: '#f8f9fa', borderRadius: 5, marginBottom: 3, fontSize: 11 }}>
                <span style={{ fontSize: 13 }}>&#128196;</span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, color: T.accent, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || '請求書'}</a>
                {f.date && <span style={{ color: T.muted, fontSize: 10, flexShrink: 0 }}>{f.date}</span>}
                <button onClick={() => removeInvoice(i)} style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${T.border}`, background: '#fff', color: T.red, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 10 }}>x</button>
              </div>
            ))}
          </div>
        </>)}

        <label style={L}>{existingFiles.length > 0 ? '追加の請求書ファイル' : '請求書ファイル（任意）'}</label>
        <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setFileUpload(e.target.files[0]); }} />
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files?.[0]) setFileUpload(e.dataTransfer.files[0]); }}
          style={{ width: '100%', padding: fileUpload ? '8px' : '16px 8px', borderRadius: 5, border: `2px dashed ${dragOver ? T.accent : T.border}`, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: dragOver ? '#e8f4fd' : '#fafafa', color: dragOver ? T.accent : T.sub, fontFamily: 'inherit', textAlign: 'center', transition: 'all .2s', boxSizing: 'border-box' }}
        >
          {fileUpload ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <span>&#128196;</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileUpload.name}</span>
              <button onClick={e => { e.stopPropagation(); setFileUpload(null); }} style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${T.border}`, background: '#fff', color: T.red, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 10 }}>x</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 18, marginBottom: 4 }}>&#128194;</div>
              <div>ファイルをドラッグ&ドロップ</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>またはクリックして選択</div>
            </>
          )}
        </div>

        {!fileOnly && (<>
          <label style={L}>確定金額 *</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.muted }}>¥</span>
            <input type="text" value={invoiceAmountDisplay} onChange={e => handleAmountChange(e.target.value)} placeholder="0" style={{ ...I, fontSize: 13, fontWeight: 600, paddingLeft: 20 }} />
          </div>
          <label style={L}>インコタームズ *</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button onClick={() => { setIncoterms(''); setIncotermsOther(''); }} style={{ padding: '5px 10px', borderRadius: 5, border: !incoterms ? `2px solid ${T.primary}` : `1px solid ${T.border}`, fontSize: 11, fontWeight: !incoterms ? 700 : 400, cursor: 'pointer', background: !incoterms ? T.primary : '#fff', color: !incoterms ? '#fff' : T.sub, fontFamily: 'inherit' }}>なし</button>
            {INCOTERMS_OPTIONS.map(opt => (
              <button key={opt} onClick={() => { setIncoterms(opt); if (opt !== 'Other') setIncotermsOther(''); }} style={{ padding: '5px 10px', borderRadius: 5, border: incoterms === opt ? `2px solid ${T.primary}` : `1px solid ${T.border}`, fontSize: 11, fontWeight: incoterms === opt ? 700 : 400, cursor: 'pointer', background: incoterms === opt ? T.primary : '#fff', color: incoterms === opt ? '#fff' : T.sub, fontFamily: 'inherit' }}>{opt}</button>
            ))}
          </div>
          {incoterms === 'Other' && <input type="text" value={incotermsOther} onChange={e => setIncotermsOther(e.target.value)} placeholder="カスタムインコタームズ" style={{ ...I, marginTop: 4 }} />}
          <label style={L}>配送種別 *</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShipping('')} style={{ flex: 1, padding: '6px', borderRadius: 6, border: !shipping ? `2px solid ${T.primary}` : `1px solid ${T.border}`, fontSize: 11, fontWeight: !shipping ? 700 : 400, cursor: 'pointer', background: !shipping ? T.primary + '10' : '#fff', color: !shipping ? T.primary : T.sub, fontFamily: 'inherit', textAlign: 'center' }}>なし</button>
            {(Object.entries(SHIPPING) as [string, { label: string; color: string }][]).map(([k, v]) => (
              <button key={k} onClick={() => setShipping(k)} style={{ flex: 1, padding: '6px', borderRadius: 6, border: shipping === k ? `2px solid ${v.color}` : `1px solid ${T.border}`, fontSize: 11, fontWeight: shipping === k ? 700 : 400, cursor: 'pointer', background: shipping === k ? v.color + '10' : '#fff', color: shipping === k ? v.color : T.sub, fontFamily: 'inherit', textAlign: 'center' }}>{v.label}</button>
            ))}
          </div>
          <label style={L}>前払い入金% *</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <input type="range" min="0" max="100" step="10" value={prepaymentPercent} onChange={e => setPrepaymentPercent(Number(e.target.value))} style={{ flex: 1, cursor: 'pointer' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.primary, minWidth: 30 }}>{prepaymentPercent}%</span>
          </div>
          <div style={{ width: '100%', height: 4, background: '#e5e5e5', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ width: prepaymentPercent + '%', height: '100%', background: prepaymentPercent >= 100 ? T.green : prepaymentPercent > 0 ? T.orange : T.muted, transition: 'width .3s' }} />
          </div>
          <label style={L}>支払い条件</label>
          <input type="text" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} placeholder="例: 通関時に残り50%支払い" style={I} />
        </>)}

        {err && <div style={{ fontSize: 11, color: T.red, marginTop: 6 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' }}>キャンセル</button>
          <button onClick={save} disabled={saving} style={{ padding: '5px 14px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>{saving ? '保存中...' : fileOnly ? '追加' : '確定'}</button>
        </div>
      </div>
    </div>
  );
}
