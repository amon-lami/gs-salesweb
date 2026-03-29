import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T } from '@/lib/constants';

interface Props {
  categories: Category[];
  client: SupabaseClient;
  user: AppUser;
  onClose: () => void;
  onUpdated: () => void;
}

export function CategoryModal({ categories, client, user, onClose, onUpdated }: Props) {
  const toast = useToast();
  const [newCat, setNewCat] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const I: React.CSSProperties = { width: '100%', border: `1px solid ${T.border}`, borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' };

  const addCategory = async () => {
    if (!newCat.trim() || saving) return;
    setSaving(true); setErr('');
    try {
      const sortOrder = categories.length;
      const colors = ['#2d8cf0', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#1a1a1a'];
      const color = colors[sortOrder % colors.length];
      const { error } = await client.from('sales_categories').insert({ name: newCat.trim(), color, sort_order: sortOrder, owner_id: user.id });
      if (error) throw error;
      setNewCat('');
      toast('カテゴリを追加しました');
      onUpdated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await client.from('sales_categories').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast('カテゴリを削除しました');
      onUpdated();
    } catch (e: any) {
      toast('削除エラー: ' + e.message, 'error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', width: '90%', maxWidth: 340, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: T.primary }}>カテゴリ管理</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCategory(); }} placeholder="新規カテゴリ名" style={{ ...I, flex: 1 }} />
          <button onClick={addCategory} disabled={saving} style={{ padding: '6px 10px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>追加</button>
        </div>
        {err && <div style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>{err}</div>}
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderBottom: `1px solid ${T.borderLight}` }}>
              <span style={{ fontSize: 12, color: T.primary }}>{c.name}</span>
              <button onClick={() => deleteCategory(c.id)} style={{ padding: '2px 6px', borderRadius: 3, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.red + '15', color: T.red, fontFamily: 'inherit' }}>削除</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 5, border: 'none', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' }}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
