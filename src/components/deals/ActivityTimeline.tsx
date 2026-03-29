import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Activity, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, ACTION_TYPES, fmt, shortName } from '@/lib/constants';

interface LeadActionRow {
  id: string;
  action_type: string;
  memo: string;
  action_date: string;
  created_by: string | null;
}

interface Props {
  deal: Deal;
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  onUpdated?: () => void;
  leadActions?: LeadActionRow[];
}

export function ActivityTimeline({ deal, client, user, allUsers, onUpdated, leadActions: inheritedActions }: Props) {
  const toast = useToast();
  const [activities, setActivities] = useState<any[]>([]);
  const canAddAction = deal.stage === 'negotiation' || deal.stage === 'invoice_sent';
  const [newType, setNewType] = useState(canAddAction ? 'action' : 'report');
  const [newContent, setNewContent] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState(user.id);
  const [showForm, setShowForm] = useState(true);
  const [actionType, setActionType] = useState('電話');
  const [actionMemo, setActionMemo] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [weeklyDeleteTarget, setWeeklyDeleteTarget] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const I: React.CSSProperties = { width: '100%', border: `1px solid ${T.border}`, borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit' };

  useEffect(() => { loadAct(); }, [deal.id]);
  const VALID_ACT_TYPES = ['report', 'note', 'stage_change', 'weekly_report', 'todo', 'action'];
  const loadAct = async () => {
    const { data } = await client.from('sales_activities').select('*').eq('deal_id', deal.id).is('deleted_at', null).order('created_at', { ascending: false });
    if (data) setActivities(data.filter((a: any) => VALID_ACT_TYPES.includes(a.type) || a.is_todo));
  };

  const addAct = async () => {
    if (newType === 'action') {
      if (!actionMemo.trim()) return;
      const { error: ie } = await client.from('sales_activities').insert({
        deal_id: deal.id, account_id: deal.account_id, user_id: user.id,
        type: 'action', content: actionType + ': ' + actionMemo.trim(),
        action_type: actionType,
      });
      if (ie) { toast(ie.message, 'error'); return; }
      setActionMemo('');
      loadAct(); if (onUpdated) onUpdated();
      return;
    }
    if (!newContent.trim()) return;
    const { error: ie } = await client.from('sales_activities').insert({
      deal_id: deal.id, account_id: deal.account_id, user_id: user.id,
      type: newType, content: newContent.trim(),
      is_todo: newType === 'todo',
      due_date: newType === 'todo' && newDueDate ? newDueDate : null,
      assigned_to: newType === 'todo' ? newAssignedTo : null,
    });
    if (ie) { toast(ie.message, 'error'); return; }
    setNewContent(''); setNewDueDate('');
    loadAct(); if (onUpdated) onUpdated();
  };

  const toggleTodo = async (id: string, cur: boolean) => {
    const { error: ue } = await client.from('sales_activities').update({ is_completed: !cur }).eq('id', id);
    if (!ue) loadAct();
  };

  const deleteAct = async (id: string) => {
    const act = activities.find(a => a.id === id);
    if (act && act.type === 'weekly_report') { setWeeklyDeleteTarget(act); return; }
    if (confirmDeleteId === id) {
      await client.from('sales_activities').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      setConfirmDeleteId(null); loadAct(); if (onUpdated) onUpdated();
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 3000);
    }
  };

  const confirmWeeklyDelete = async () => {
    if (!weeklyDeleteTarget) return;
    await client.from('sales_activities').update({ deleted_at: new Date().toISOString() }).eq('id', weeklyDeleteTarget.id);
    setWeeklyDeleteTarget(null); loadAct(); if (onUpdated) onUpdated();
  };

  const startEdit = (a: any) => { setEditingId(a.id); setEditContent(a.content || ''); setEditDueDate(a.due_date || ''); setEditAssignedTo(a.assigned_to || user.id); };
  const cancelEdit = () => { setEditingId(null); setEditContent(''); setEditDueDate(''); setEditAssignedTo(''); };
  const saveEdit = async (a: any) => {
    if (!editContent.trim()) return;
    const updateData: Record<string, unknown> = { content: editContent.trim() };
    if (a.is_todo) { updateData.due_date = editDueDate || null; updateData.assigned_to = editAssignedTo || null; }
    const { error } = await client.from('sales_activities').update(updateData).eq('id', a.id);
    if (error) { toast(error.message, 'error'); return; }
    cancelEdit(); loadAct(); if (onUpdated) onUpdated();
  };

  const grouped: Record<string, { label: string; items: any[] }> = {};
  activities.forEach(a => {
    const d = new Date(a.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}月・${d.getFullYear()}`;
    if (!grouped[key]) grouped[key] = { label, items: [] };
    grouped[key].items.push(a);
  });
  const sortedGroups = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));

  const typeIcon = (a: any) => {
    if (a.type === 'stage_change') return { color: T.muted, icon: '↗' };
    if (a.type === 'weekly_report') return { color: T.green, icon: '&#128203;' };
    if (a.type === 'action') {
      const actColors: Record<string, string> = { '電話': '#2d8cf0', 'メール': '#f59e0b', 'WhatsApp': '#22c55e', 'LinkedIn': '#0077B5', 'ミーティング': '#8b5cf6', 'サンプル送付': '#ec4899', '見積送付': '#06b6d4', 'その他': '#999' };
      return { color: actColors[a.action_type] || T.orange, icon: '⚡' };
    }
    if (a.type === 'report' || a.type === 'note') return { color: T.sub, icon: '•' };
    if (a.is_todo) return { color: T.accent, icon: a.is_completed ? '☑' : '☐' };
    return { color: T.muted, icon: '•' };
  };

  const canEditDelete = (a: any) => a.type === 'report' || a.type === 'note' || a.type === 'weekly_report' || a.is_todo || a.type === 'action';

  const actionActivities = activities.filter(a => a.type === 'action');
  const lastActionAct = actionActivities.length > 0 ? actionActivities[0] : null;
  const inheritedList = inheritedActions || [];
  const lastInherited = inheritedList.length > 0 ? inheritedList[0] : null;
  const latestActionDate = lastActionAct ? new Date(lastActionAct.created_at) : lastInherited ? new Date(lastInherited.action_date) : null;
  const daysSinceAction = latestActionDate ? Math.floor((Date.now() - latestActionDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isActionStale = canAddAction && (daysSinceAction === null || (daysSinceAction !== null && daysSinceAction >= 7));

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {isActionStale && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#9888;&#65039;</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.red }}>{daysSinceAction === null ? 'アクション未実施' : daysSinceAction + '日間アクションなし'}</div>
            <div style={{ fontSize: 10, color: T.sub }}>交渉中の商談には定期的なアクションが必要です</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>活動タイムライン</div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: showForm ? '#f3f3f3' : '#fff', color: T.sub, fontFamily: 'inherit' }}>{showForm ? 'x' : '+ 追加'}</button>
      </div>

      {showForm && (
        <div style={{ padding: 10, background: T.bg, borderRadius: 6, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {canAddAction && <button onClick={() => setNewType('action')} style={{ flex: 1, padding: '5px', borderRadius: 4, border: newType === 'action' ? `2px solid ${T.orange}` : `1px solid ${T.border}`, fontSize: 10.5, fontWeight: newType === 'action' ? 700 : 400, cursor: 'pointer', background: newType === 'action' ? T.orange + '10' : '#fff', color: newType === 'action' ? T.orange : T.sub, fontFamily: 'inherit' }}>&#128222; アクション</button>}
            <button onClick={() => setNewType('report')} style={{ flex: 1, padding: '5px', borderRadius: 4, border: newType === 'report' ? `2px solid ${T.green}` : `1px solid ${T.border}`, fontSize: 10.5, fontWeight: newType === 'report' ? 700 : 400, cursor: 'pointer', background: newType === 'report' ? T.green + '10' : '#fff', color: newType === 'report' ? T.green : T.sub, fontFamily: 'inherit' }}>&#128221; レポート</button>
            <button onClick={() => setNewType('todo')} style={{ flex: 1, padding: '5px', borderRadius: 4, border: newType === 'todo' ? `2px solid ${T.accent}` : `1px solid ${T.border}`, fontSize: 10.5, fontWeight: newType === 'todo' ? 700 : 400, cursor: 'pointer', background: newType === 'todo' ? T.accent + '10' : '#fff', color: newType === 'todo' ? T.accent : T.sub, fontFamily: 'inherit' }}>☐ ToDo</button>
          </div>
          {newType === 'action' ? (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                {ACTION_TYPES.map(t => (
                  <button key={t} onClick={() => setActionType(t)} style={{ padding: '3px 8px', borderRadius: 4, border: actionType === t ? '1px solid ' + T.accent : '1px solid ' + T.border, fontSize: 10, fontWeight: actionType === t ? 700 : 400, cursor: 'pointer', background: actionType === t ? T.accent + '15' : '#fff', color: actionType === t ? T.accent : T.sub, fontFamily: 'inherit' }}>{t}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={actionMemo} onChange={e => setActionMemo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && actionMemo.trim()) addAct(); }} style={{ flex: 1, border: '1px solid ' + T.border, borderRadius: 5, padding: '6px 8px', fontSize: 11, outline: 'none', fontFamily: 'inherit' }} placeholder="アクション内容を入力..." />
                <button onClick={addAct} disabled={!actionMemo.trim()} style={{ padding: '5px 12px', borderRadius: 4, border: 'none', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: !actionMemo.trim() ? 0.4 : 1 }}>追加</button>
              </div>
            </div>
          ) : (
            <div>
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={2} placeholder={newType === 'report' ? '活動内容を記録...' : 'タスク内容...'} style={{ ...I, marginBottom: 6, lineHeight: 1.4 }} />
              {newType === 'todo' && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} style={{ ...I, flex: 1 }} />
                  <select value={newAssignedTo} onChange={e => setNewAssignedTo(e.target.value)} style={{ ...I, flex: 1, background: '#fff' }}>
                    {(allUsers || []).map(u => (<option key={u.id} value={u.id}>{shortName(u)}</option>))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={addAct} style={{ padding: '5px 12px', borderRadius: 4, border: 'none', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>追加</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedGroups.map(([key, { label, items }]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, padding: '4px 0', borderBottom: `1px solid ${T.borderLight}`, marginBottom: 6 }}>{label}</div>
            {items.map(a => {
              const ti = typeIcon(a);
              const au = allUsers.find(u => u.id === a.user_id);
              const assignee = a.assigned_to ? allUsers.find(u => u.id === a.assigned_to) : null;
              const isEditing = editingId === a.id;
              return (
                <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 18 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: ti.color + '20', color: ti.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, cursor: a.is_todo ? 'pointer' : 'default', flexShrink: 0 }}
                      onClick={() => { if (a.is_todo) toggleTodo(a.id, a.is_completed); }}>
                      {ti.icon}
                    </div>
                    <div style={{ flex: 1, width: 1, background: T.borderLight, marginTop: 2 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div style={{ background: T.bg, borderRadius: 6, padding: 8, marginBottom: 2 }}>
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2} style={{ ...I, marginBottom: 4, lineHeight: 1.4, fontSize: 11 }} />
                        {a.is_todo && (
                          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                            <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} style={{ ...I, flex: 1, fontSize: 10 }} />
                            <select value={editAssignedTo} onChange={e => setEditAssignedTo(e.target.value)} style={{ ...I, flex: 1, background: '#fff', fontSize: 10 }}>
                              {(allUsers || []).map(u => (<option key={u.id} value={u.id}>{shortName(u)}</option>))}
                            </select>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button onClick={cancelEdit} style={{ padding: '3px 8px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 9.5, fontWeight: 500, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
                          <button onClick={() => saveEdit(a)} style={{ padding: '3px 8px', borderRadius: 3, border: 'none', fontSize: 9.5, fontWeight: 600, cursor: 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit' }}>保存</button>
                        </div>
                      </div>
                    ) : (<>
                      {a.type === 'weekly_report' && <div style={{ fontSize: 9, fontWeight: 700, color: T.green, marginBottom: 1 }}>週次レポート</div>}
                      {a.type === 'action' && <div style={{ fontSize: 9, fontWeight: 700, color: T.orange, marginBottom: 1 }}>アクション: {a.action_type || ''}</div>}
                      <div style={{ fontSize: 11.5, color: a.is_completed ? T.muted : T.primary, fontWeight: a.type === 'stage_change' ? 400 : 500, textDecoration: a.is_completed ? 'line-through' : 'none', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{a.content}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9.5, color: T.muted }}>{shortName(au)}</span>
                        <span style={{ fontSize: 9, color: T.muted }}>{fmt(a.created_at)}</span>
                        {a.due_date && <span style={{ fontSize: 9, color: new Date(a.due_date) < new Date() && !a.is_completed ? T.red : T.muted }}>期限: {fmt(a.due_date)}</span>}
                        {assignee && <span style={{ fontSize: 9, color: T.accent }}>→ {shortName(assignee)}</span>}
                        {canEditDelete(a) && <>
                          <span onClick={() => startEdit(a)} style={{ fontSize: 9, color: T.accent, cursor: 'pointer', padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>編集</span>
                          <span onClick={() => deleteAct(a.id)} style={{ fontSize: 9, color: confirmDeleteId === a.id ? '#fff' : T.muted, cursor: 'pointer', padding: '1px 5px', borderRadius: 3, background: confirmDeleteId === a.id ? T.red : 'transparent', fontWeight: confirmDeleteId === a.id ? 600 : 400, transition: 'all 0.15s' }}>{confirmDeleteId === a.id ? '削除する' : '削除'}</span>
                        </>}
                      </div>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {activities.length === 0 && <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>活動履歴なし</div>}

        {inheritedList.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginBottom: 6 }}>&#128204; リード時のアクション履歴</div>
            {inheritedList.map(a => {
              const aUser = allUsers.find(u => u.id === a.created_by);
              const aDate = new Date(a.action_date);
              const typeColors: Record<string, string> = { '電話': '#2d8cf0', 'メール': '#f59e0b', 'WhatsApp': '#22c55e', 'LinkedIn': '#0077B5', 'ミーティング': '#8b5cf6', 'サンプル送付': '#ec4899', '見積送付': '#06b6d4', 'その他': '#999' };
              const tc = typeColors[a.action_type] || '#999';
              return (
                <div key={a.id} style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 4, opacity: 0.7 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: tc, marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: tc, background: tc + '12', padding: '1px 5px', borderRadius: 3 }}>{a.action_type}</span>
                      <span style={{ fontSize: 9, color: T.muted }}>{aDate.toLocaleDateString('ja-JP')}</span>
                      <span style={{ fontSize: 9, color: T.muted, marginLeft: 'auto' }}>{shortName(aUser)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.sub, lineHeight: 1.4 }}>{a.memo}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {weeklyDeleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onMouseDown={e => { if (e.target === e.currentTarget) setWeeklyDeleteTarget(null); }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', width: 360, boxShadow: '0 12px 40px rgba(0,0,0,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>&#9888;&#65039;</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.primary }}>週次レポートの削除</div>
            </div>
            <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.6, marginBottom: 8 }}>以下の週次レポートを削除しますか？この操作は取り消せません。</div>
            <div style={{ background: T.bg, borderRadius: 6, padding: '10px 12px', marginBottom: 14, border: `1px solid ${T.borderLight}` }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 4 }}>&#128203; {fmt(weeklyDeleteTarget.created_at)} · {shortName(allUsers.find(u => u.id === weeklyDeleteTarget.user_id))}</div>
              <div style={{ fontSize: 11.5, color: T.primary, lineHeight: 1.4, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }}>{weeklyDeleteTarget.content}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setWeeklyDeleteTarget(null)} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
              <button onClick={confirmWeeklyDelete} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: T.red, color: '#fff', fontFamily: 'inherit' }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
