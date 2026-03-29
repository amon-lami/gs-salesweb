// ============================================
// GS Sales CRM - Lead Page
// リード一覧 + フォーム + 商談化
// ============================================

import React, { useState, memo, useCallback, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, Category, AppUser, LeadStatus } from '@/types/database';
import { T, LEAD_SOURCES, LEAD_STATUSES, countryToFlag, shortName, fmt } from '@/lib/constants';

// ── LeadFormModal ──
interface LeadFormProps {
  client: SupabaseClient;
  user: AppUser;
  lead: Lead | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

function LeadFormModal({ client, user, lead, categories, onClose, onSaved }: LeadFormProps) {
  const [form, setForm] = useState({
    company_name: lead?.company_name || '',
    contact_name: lead?.contact_name || '',
    contact_email: lead?.contact_email || '',
    source: lead?.source || 'その他',
    phone: lead?.phone || '',
    whatsapp: lead?.whatsapp || '',
    country: lead?.country || '',
    website: lead?.website || '',
    notes: lead?.notes || '',
    status: lead?.status || 'new',
    owner_id: lead?.owner_id || user.id,
  });
  const [categoryIds, setCategoryIds] = useState<string[]>(lead?.category_ids || []);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.company_name.trim()) { alert('会社名は必須です'); return; }
    setSaving(true);
    try {
      if (lead) {
        const { error } = await client.from('sales_leads')
          .update({ ...form, category_ids: categoryIds, updated_at: new Date().toISOString() })
          .eq('id', lead.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('sales_leads')
          .insert({ ...form, category_ids: categoryIds, created_by: user.id, owner_id: form.owner_id || user.id });
        if (error) throw error;
      }
      onSaved(); onClose();
    } catch (e: unknown) {
      alert('エラー: ' + (e instanceof Error ? e.message : String(e)));
    }
    setSaving(false);
  };

  const F: React.CSSProperties = {
    width: '100%', padding: '6px 10px',
    border: `1px solid ${T.border}`, borderRadius: 5,
    fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#fff',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', width: 420, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: T.primary }}>
          {lead ? 'リード編集' : '新規リード'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>会社名 *</label>
            <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} style={F} placeholder="会社名" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>担当者名</label>
              <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} style={F} placeholder="担当者名" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>メール</label>
              <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} style={F} placeholder="メール" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>ソース</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={F}>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>ステータス</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))} style={F}>
                {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>電話</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={F} placeholder="電話" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} style={F} placeholder="WhatsApp" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>国</label>
              <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} style={F} placeholder="国" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>Webサイト</label>
              <input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} style={F} placeholder="https://" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>メモ</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ ...F, minHeight: 50, resize: 'vertical' }} placeholder="メモ（任意）" />
          </div>

          {/* カテゴリ選択 */}
          {categories.length > 0 && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.sub }}>カテゴリ</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {categories.map(c => {
                  const sel = categoryIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryIds(prev => sel ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                      style={{
                        padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${sel ? T.primary : T.border}`,
                        background: sel ? T.primary + '10' : '#fff',
                        color: sel ? T.primary : T.sub,
                        fontWeight: sel ? 700 : 500,
                        fontSize: 11, fontFamily: 'inherit', transition: 'all .15s',
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '6px 16px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>
            キャンセル
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: saving ? 0.5 : 1 }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── LeadPage ──
interface LeadPageProps {
  leads: Lead[];
  categories: Category[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
  onReload: () => void;
  onConvert: (leadId: string) => Promise<void>;
}

export const LeadPage = memo(function LeadPage({
  leads, categories, allUsers, client, user, onReload, onConvert,
}: LeadPageProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  const filtered = useMemo(() => leads.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(l.company_name || '').toLowerCase().includes(q)
        && !(l.contact_name || '').toLowerCase().includes(q)
        && !(l.contact_email || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [leads, statusFilter, sourceFilter, search]);

  const handleConvert = useCallback(async (lead: Lead) => {
    if (!confirm(`「${lead.company_name}」を取引先+商談に変換しますか？`)) return;
    try {
      await onConvert(lead.id);
    } catch (e: unknown) {
      alert('変換エラー: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [onConvert]);

  const FS: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 5,
    border: `1px solid ${T.border}`, fontSize: 10.5,
    fontWeight: 500, cursor: 'pointer',
    background: T.card, color: T.sub, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <>
      {/* ツールバー */}
      <div style={{ padding: '7px 14px', borderBottom: `1px solid ${T.border}`, background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="検索..." style={{ ...FS, width: 140, fontWeight: 400 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={FS}>
            <option value="all">全ステータス</option>
            {LEAD_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={FS}>
            <option value="all">全ソース</option>
            {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: 11, fontWeight: 600, color: T.sub, marginLeft: 4 }}>{filtered.length}件</span>
        </div>
        <button
          onClick={() => { setEditLead(null); setShowForm(true); }}
          style={{ padding: '4px 12px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}
        >
          + 新規リード
        </button>
      </div>

      {/* テーブル */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${T.border}` }}>
              {['ステータス', '会社名', '担当者', 'ソース', 'カテゴリ', 'GS担当', '登録日', ''].map(h => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: T.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const st = LEAD_STATUSES.find(s => s.id === l.status);
              const catNames = (l.category_ids || [])
                .map(cid => categories.find(c => c.id === cid)?.name)
                .filter(Boolean)
                .join(', ');
              return (
                <tr
                  key={l.id}
                  style={{ borderBottom: `1px solid ${T.borderLight}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: st?.color || T.muted, background: (st?.color || '#999') + '15', padding: '2px 8px', borderRadius: 10 }}>
                      {st?.label || l.status}
                    </span>
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 600, color: T.primary }}>{countryToFlag(l.country)} {l.company_name}</td>
                  <td style={{ padding: '6px 8px', color: T.sub }}>{l.contact_name || '-'}</td>
                  <td style={{ padding: '6px 8px', color: T.sub, fontSize: 11 }}>{l.source}</td>
                  <td style={{ padding: '6px 8px', fontSize: 10, color: T.sub }}>{catNames || '-'}</td>
                  <td style={{ padding: '6px 8px', color: T.sub, fontSize: 11 }}>{shortName(allUsers.find(u => u.id === l.owner_id))}</td>
                  <td style={{ padding: '6px 8px', color: T.muted, fontSize: 11 }}>{fmt(l.created_at)}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => { setEditLead(l); setShowForm(true); }}
                        style={{ padding: '2px 8px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}
                      >
                        編集
                      </button>
                      {l.status !== 'converted' && l.status !== 'lost' && (
                        <button
                          onClick={() => handleConvert(l)}
                          style={{ padding: '2px 8px', borderRadius: 3, border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: T.green, color: '#fff', fontFamily: 'inherit' }}
                        >
                          商談化
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#ccc', fontSize: 12 }}>
            リードがありません。「+ 新規リード」で追加してください。
          </div>
        )}
      </div>

      {/* フォームモーダル */}
      {showForm && (
        <LeadFormModal
          client={client}
          user={user}
          lead={editLead}
          categories={categories}
          onClose={() => { setShowForm(false); setEditLead(null); }}
          onSaved={onReload}
        />
      )}
    </>
  );
});
