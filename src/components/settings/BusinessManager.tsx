import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useToast } from '@/components/shared/ToastProvider';
import { T } from '@/lib/constants';

interface Business {
  id: string;
  label: string;
  color: string;
}

interface Props {
  client: SupabaseClient;
  businesses: Business[];
  onUpdated: () => void;
}

export function BusinessManager({ client, businesses, onUpdated }: Props) {
  const toast = useToast();
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#666');
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const I: React.CSSProperties = { border: `1px solid ${T.border}`, borderRadius: 5, padding: '5px 8px', fontSize: 11.5, outline: 'none', fontFamily: 'inherit' };

  const addBiz = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    const id = newLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    const sortOrder = (businesses || []).length;
    const { error } = await client.from('businesses').insert({ id, label: newLabel.trim(), color: newColor, sort_order: sortOrder });
    if (error) { toast('追加エラー: ' + error.message, 'error'); }
    else { setNewLabel(''); setNewColor('#666'); onUpdated(); }
    setSaving(false);
  };

  const saveBizEdit = async () => {
    if (!editLabel.trim() || !editId) return;
    const { error } = await client.from('businesses').update({ label: editLabel.trim(), color: editColor }).eq('id', editId);
    if (error) toast('更新エラー: ' + error.message, 'error');
    else { setEditId(null); onUpdated(); }
  };

  const deleteBiz = async (id: string) => {
    if (confirmDeleteId === id) {
      const { error } = await client.from('businesses').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) toast('削除エラー: ' + error.message, 'error');
      else { setConfirmDeleteId(null); onUpdated(); }
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(p => p === id ? null : p), 3000);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addBiz(); }} placeholder="新規事業名" style={{ ...I, flex: 1, width: '100%' }} />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 32, height: 28, border: `1px solid ${T.border}`, borderRadius: 4, cursor: 'pointer', padding: 1 }} />
        <button onClick={addBiz} disabled={saving || !newLabel.trim()} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: saving || !newLabel.trim() ? 0.5 : 1 }}>追加</button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {(businesses || []).map(b => (
          <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: `1px solid ${T.borderLight}` }}>
            {editId === b.id ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: 24, height: 22, border: `1px solid ${T.border}`, borderRadius: 3, cursor: 'pointer', padding: 0 }} />
                <input value={editLabel} onChange={e => setEditLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveBizEdit(); }} style={{ ...I, flex: 1, width: '100%' }} />
                <button onClick={saveBizEdit} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.accent, color: '#fff', fontFamily: 'inherit' }}>保存</button>
                <button onClick={() => setEditId(null)} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>取消</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: b.color || '#666', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: T.primary, fontWeight: 500, flex: 1 }}>{b.label}</span>
                <span style={{ fontSize: 9, color: T.muted, fontFamily: 'monospace' }}>{b.id}</span>
                <button onClick={() => { setEditId(b.id); setEditLabel(b.label); setEditColor(b.color || '#666'); }} style={{ padding: '2px 6px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 9, cursor: 'pointer', background: '#fff', color: T.muted, fontFamily: 'inherit' }}>編集</button>
                <button onClick={() => deleteBiz(b.id)} style={{ padding: '2px 6px', borderRadius: 3, border: 'none', fontSize: 9, fontWeight: 600, cursor: 'pointer', background: confirmDeleteId === b.id ? T.red : T.red + '15', color: confirmDeleteId === b.id ? '#fff' : T.red, fontFamily: 'inherit' }}>{confirmDeleteId === b.id ? '削除する' : '削除'}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
