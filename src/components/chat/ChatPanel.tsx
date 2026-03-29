import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, AppUser } from '@/types/database';
import { useToast } from '@/components/shared/ToastProvider';
import { T, shortName } from '@/lib/constants';

interface Props {
  deal: Deal;
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts?: Account[];
  onUpdated?: () => void;
}

export function ChatPanel({ deal, client, user, allUsers, accounts, onUpdated }: Props) {
  const toast = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!deal.chat_room_id) return;
    (async () => {
      const { data: mem } = await client.from('chat_room_members').select('id').eq('room_id', deal.chat_room_id).eq('user_id', user.id).limit(1);
      if (!mem || mem.length === 0) {
        await client.from('chat_room_members').insert({ room_id: deal.chat_room_id, user_id: user.id, role: 'member' });
      }
    })();
    loadMsgs();
    const ch = client.channel('sales-chat-' + deal.chat_room_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${deal.chat_room_id}` }, () => loadMsgs())
      .subscribe();
    return () => { client.removeChannel(ch); };
  }, [deal.chat_room_id]);

  const loadMsgs = async () => {
    if (!deal.chat_room_id) return;
    const { data } = await client.from('chat_messages').select('*').eq('room_id', deal.chat_room_id).order('created_at', { ascending: false }).limit(30);
    if (data) setMessages(data.reverse());
  };

  const send = async () => {
    if (sending || !newMsg.trim() || !deal.chat_room_id) return;
    setSending(true);
    try {
      const { error: ie } = await client.from('chat_messages').insert({ room_id: deal.chat_room_id, user_id: user.id, content: newMsg.trim(), type: 'text' });
      if (!ie) { setNewMsg(''); loadMsgs(); try { (window as any)._gsChatLastRoomId = deal.chat_room_id; } catch { /* ignore */ } }
    } finally { setSending(false); }
  };

  if (!deal.chat_room_id) {
    const createRoom = async () => {
      try {
        const acct = accounts?.find(a => a.id === deal.account_id);
        const roomName = deal.name || (acct?.name + ' 商談');
        const { data: room, error: re } = await client.from('chat_rooms').insert({ name: roomName, type: 'group', created_by: user.id }).select().single();
        if (re) throw re;
        const members: any[] = [{ room_id: room.id, user_id: user.id, role: 'admin' }];
        if (deal.owner_id && deal.owner_id !== user.id) { members.push({ room_id: room.id, user_id: deal.owner_id, role: 'member' }); }
        await client.from('chat_room_members').insert(members);
        const { error: de } = await client.from('sales_deals').update({ chat_room_id: room.id, updated_at: new Date().toISOString() }).eq('id', deal.id);
        if (de) throw de;
        if (onUpdated) onUpdated();
      } catch (e: any) { toast('チャットルーム作成エラー: ' + e.message, 'error'); }
    };
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>GS-Chat</div>
        <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', padding: '8px 0', marginBottom: 8 }}>チャンネル未連携</div>
        <button onClick={createRoom} style={{ width: '100%', padding: '6px', borderRadius: 5, border: `1px dashed ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.bg, color: T.sub, fontFamily: 'inherit' }}>+ チャットルームを作成</button>
      </div>
    );
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>GS-Chat</div>
      <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 8 }}>
        {messages.map(m => {
          const s = allUsers.find(u => u.id === m.user_id);
          return (
            <div key={m.id} style={{ marginBottom: 8, padding: '6px 8px', background: m.user_id === user.id ? '#e8f4fd' : '#f4f5f7', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.primary }}>{shortName(s)}</span>
                <span style={{ fontSize: 9, color: T.muted }}>{new Date(m.created_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.sub, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '100%' }}>{m.content}</div>
            </div>
          );
        })}
        {messages.length === 0 && <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center' }}>メッセージなし</div>}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <textarea value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="メッセージ...（Shift+Enterで改行）" rows={1} style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 5, padding: '5px 8px', fontSize: 11, outline: 'none', fontFamily: 'inherit', resize: 'none', minHeight: 28, maxHeight: 80, overflowY: 'auto', lineHeight: 1.4 }} />
        <button onClick={send} disabled={sending} style={{ padding: '5px 10px', borderRadius: 5, border: 'none', fontSize: 11, fontWeight: 600, cursor: sending ? 'default' : 'pointer', background: T.primary, color: '#fff', fontFamily: 'inherit', opacity: sending ? 0.5 : 1 }}>送信</button>
      </div>
    </div>
  );
}
