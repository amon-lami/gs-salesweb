// ============================================================
// GS-Chat Core — 共有チャットコンポーネント
// GS-Chat と GS-Sales の両方からこのファイルを読み込む
// 更新はこのファイルのみ → 両アプリに即時反映
// ============================================================

window.GSChat = {};

// ── Helpers ──
const _chatFormatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
};
const _chatFormatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return '今日';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return '昨日';
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
};
const _chatFormatBytes = (b) => {
    if (!b) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
};
const _chatInitial = (name) => (name || '?').charAt(0).toUpperCase();

// Short name mapping (same as GS-Sales)
const _CHAT_SHORT_NAMES = {
    "Lamichhane Amon": "Amon", "Amon Lamichhane": "Amon",
    "Yuki Nakagawa": "Yuki", "Nakagawa Yuki": "Yuki",
    "Ito Yuta": "Yuta", "Yuta Ito": "Yuta",
    "Chikaki Kosuke": "Chikaki", "Kosuke Chikaki": "Chikaki",
    "Martirossian Mark": "Mark", "Mark Martirossian": "Mark", "Mark Matiros": "Mark",
    "Tsumura Kota": "Tsumura", "Kota Tsumura": "Tsumura",
    "Sarah Azzouz": "Sarah", "Azzouz Sarah": "Sarah",
    "Joseph Mackay": "Joseph", "Mackay Joseph": "Joseph"
};
const _CHAT_EMAIL_SHORT = { "alt@": "Amon", "yuki.nakagawa@": "Yuki", "kota.tsumura@": "Tsumura", "chikaki@": "Chikaki", "yuta.ito@": "Yuta", "mark.martiros@": "Mark", "sarah.azzouz@": "Sarah", "joseph.mackay@": "Joseph" };
const _chatShortName = (u) => {
    if (!u) return "-";
    const n = u.name || "";
    if (_CHAT_SHORT_NAMES[n]) return _CHAT_SHORT_NAMES[n];
    const e = u.email || "";
    for (const [k, v] of Object.entries(_CHAT_EMAIL_SHORT)) { if (e.startsWith(k)) return v; }
    return n || e.split("@")[0] || "-";
};

// Reaction emoji options
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏', '🎉', '✅', '👀'];

// ── Theme ──
const CT = {
    primary: '#1a1a1a', sub: '#666', muted: '#999',
    border: '#e5e5e5', borderLight: '#f0f0f0',
    bg: '#fafafa', card: '#fff',
    accent: '#2d8cf0', green: '#22c55e', red: '#e53935',
};

// Deal stages for phase badge
const _DEAL_STAGES = {
    negotiation: { ja: '交渉中', color: '#2d8cf0' },
    invoice_sent: { ja: '請求書送付済', color: '#7c3aed' },
    order_pending: { ja: '発注未完了', color: '#f59e0b' },
    order_completed: { ja: '発注完了', color: '#f59e0b' },
    goods_received: { ja: '入荷済', color: '#22c55e' },
    shipped: { ja: '発送済', color: '#059669' },
    closed: { ja: '完了', color: '#1a1a1a' },
    lost: { ja: '失注', color: '#e53935' }
};

// ============================================================
// ChatScreen コンポーネント
// Props: { supabase, user, profile, allUsers, theme, compact, onLogout, onOpenDeal, accounts, categories }
// ============================================================
window.GSChat.ChatScreen = function ChatScreen({ supabase, user, profile, allUsers: externalUsers, theme, compact, onLogout, onOpenDeal, accounts: externalAccounts, categories: externalCategories }) {
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    const t = theme || CT;

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [allUsers, setAllUsers] = useState(externalUsers || []);
    const [msgInput, setMsgInput] = useState('');
    const [isImportant, setIsImportant] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [unreadMap, setUnreadMap] = useState({});
    const [dealRoomMap, setDealRoomMap] = useState({});
    const [dealSectionOpen, setDealSectionOpen] = useState(true);
    const [collapsedCategories, setCollapsedCategories] = useState({});
    const [contextMenu, setContextMenu] = useState(null);
    const [deleteConfirmRoom, setDeleteConfirmRoom] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [threadParent, setThreadParent] = useState(null);
    const [threadMessages, setThreadMessages] = useState([]);
    const [threadInput, setThreadInput] = useState('');
    const threadEndRef = useRef(null);
    const [reactionPickerMsg, setReactionPickerMsg] = useState(null); // kept for compat, unused
    const [hoveredMsg, setHoveredMsg] = useState(null);
    const [sidebarSearch, setSidebarSearch] = useState('');
    // Sidebar tab: 'group' | 'expense' | 'deal' | 'dm'
    const [sidebarTab, setSidebarTab] = useState('group');
    // Expense report
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseRooms, setExpenseRooms] = useState([]);
    // DM
    const [dmRooms, setDmRooms] = useState([]);
    const [showDmCreate, setShowDmCreate] = useState(false);

    // Categories from external or internal
    const categories = externalCategories || [];
    const accounts = externalAccounts || [];

    useEffect(() => { loadRooms(); if (!externalUsers || externalUsers.length === 0) loadAllUsers(); requestNotificationPermission(); }, []);
    useEffect(() => { if (externalUsers && externalUsers.length > 0) setAllUsers(externalUsers); }, [externalUsers]);

    // Request browser notification permission
    const requestNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    };
    const showBrowserNotification = (title, body) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            try { new Notification(title, { body, icon: '/favicon.ico', tag: 'gs-chat-' + Date.now() }); } catch(e) {}
        }
    };

    // Realtime messages — use currentRoom.id as dep to avoid re-subscribing on object ref change
    const currentRoomId = currentRoom?.id || null;
    useEffect(() => {
        if (!currentRoomId) return;
        loadMessages(currentRoomId);
        const channel = supabase
            .channel('chat-room-' + currentRoomId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: 'room_id=eq.' + currentRoomId }, () => { loadMessages(currentRoomId); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentRoomId]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Realtime: unread + browser notification (important messages always notify)
    useEffect(() => {
        const channel = supabase
            .channel('chat-all-new')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
                const msg = payload.new;
                if (msg.user_id === user.id) return;
                const isViewing = currentRoomId && msg.room_id === currentRoomId;
                // Important messages ALWAYS trigger notification, even if viewing room
                if (msg.is_important) {
                    const room = rooms.find(r => r.id === msg.room_id);
                    const sender = allUsers.find(u => u.id === msg.user_id);
                    const sName = sender ? _chatShortName(sender) : 'メンバー';
                    const rName = room?.name || 'チャット';
                    const body = msg.content || '';
                    showBrowserNotification('🔴 重要 / ' + sName + ' / ' + rName, body.substring(0, 120));
                }
                if (isViewing) return;
                setUnreadMap(prev => ({ ...prev, [msg.room_id]: (prev[msg.room_id] || 0) + 1 }));
                // Normal browser notification for non-important
                if (!msg.is_important) {
                    const room = rooms.find(r => r.id === msg.room_id);
                    const sender = allUsers.find(u => u.id === msg.user_id);
                    const sName = sender ? _chatShortName(sender) : 'メンバー';
                    const rName = room?.name || 'チャット';
                    const body = msg.type === 'expense' ? '💰 経費報告を投稿しました' : (msg.content || 'ファイルを送信しました');
                    showBrowserNotification(sName + ' / ' + rName, body.substring(0, 100));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentRoomId, user.id, rooms, allUsers]);

    // Realtime: deal changes
    useEffect(() => {
        const channel = supabase
            .channel('chat-deals-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_deals' }, () => { loadRooms(); })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    // Realtime: reactions
    useEffect(() => {
        if (!currentRoomId) return;
        const channel = supabase
            .channel('chat-reactions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, () => {
                loadMessages(currentRoomId);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentRoomId]);

    const loadRooms = async () => {
        const { data } = await supabase.from('chat_room_members').select('room_id, chat_rooms(*)').eq('user_id', user.id);
        if (data) {
            const r = data.map(d => d.chat_rooms).filter(Boolean);
            r.sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''));
            setRooms(r);
            // Classify expense and DM rooms
            setExpenseRooms(r.filter(rm => rm.type === 'expense'));
            setDmRooms(r.filter(rm => rm.type === 'dm'));
            if (r.length > 0 && !currentRoom) setCurrentRoom(r[0]);
        }
        const { data: dealData } = await supabase.from('sales_deals').select('id, name, chat_room_id, stage, amount, account_id').not('chat_room_id', 'is', null);
        if (dealData) {
            const map = {};
            dealData.forEach(d => { map[d.chat_room_id] = d; });
            setDealRoomMap(map);
        }
    };

    useEffect(() => { const h = () => { setContextMenu(null); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);

    const deleteRoom = async (room) => {
        try {
            await supabase.from('chat_messages').delete().eq('room_id', room.id);
            await supabase.from('chat_room_members').delete().eq('room_id', room.id);
            if (dealRoomMap[room.id]) {
                await supabase.from('sales_deals').update({ chat_room_id: null }).eq('id', dealRoomMap[room.id].id);
            }
            await supabase.from('chat_rooms').delete().eq('id', room.id);
            if (currentRoom?.id === room.id) setCurrentRoom(null);
            setDeleteConfirmRoom(null); setContextMenu(null); loadRooms();
        } catch (e) { console.error('Delete room error:', e); }
    };

    const _reactionsOk = useRef(null); // null=unknown, true/false
    const _completionsOk = useRef(null);
    const loadMessages = async (roomId) => {
        // Check table availability once
        if (_reactionsOk.current === null) {
            const { error } = await supabase.from('chat_reactions').select('id').limit(0);
            _reactionsOk.current = !error;
        }
        if (_completionsOk.current === null) {
            const { error } = await supabase.from('message_completions').select('id').limit(0);
            _completionsOk.current = !error;
        }
        // Build select string dynamically
        let sel = '*, profiles:user_id(id,name,email)';
        if (_completionsOk.current) sel += ', completions:message_completions(id,user_id,completed_at,profiles:user_id(id,name,email))';
        if (_reactionsOk.current) sel += ', reactions:chat_reactions(id,user_id,emoji,profiles:user_id(id,name,email))';
        const { data, error } = await supabase
            .from('chat_messages')
            .select(sel)
            .eq('room_id', roomId)
            .is('parent_id', null)
            .order('created_at', { ascending: true })
            .limit(200);
        if (error) {
            // Fallback: basic query without joins that may fail
            console.warn('loadMessages fallback:', error.message);
            const { data: fallback } = await supabase.from('chat_messages').select('*, profiles:user_id(id,name,email)').eq('room_id', roomId).is('parent_id', null).order('created_at', { ascending: true }).limit(200);
            if (fallback) setMessages(fallback);
            return;
        }
        if (data) setMessages(data);
    };

    const loadAllUsers = async () => {
        const { data } = await supabase.from('profiles').select('id,name,email');
        if (data) setAllUsers(data);
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if ((!msgInput.trim() && !pendingFile) || !currentRoom) return;
        setLoading(true);
        try {
            if (pendingFile) {
                const file = pendingFile;
                const ext = file.name.split('.').pop();
                const filePath = currentRoom.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
                const { error: upErr } = await supabase.storage.from('chat-files').upload(filePath, file);
                if (upErr) throw upErr;
                const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(filePath);
                await supabase.from('chat_messages').insert({
                    room_id: currentRoom.id, user_id: user.id,
                    content: msgInput.trim() || file.name, type: 'file',
                    file_data: { name: file.name, size: file.size, type: file.type, url: urlData?.publicUrl || '' },
                    is_important: isImportant
                });
                setPendingFile(null);
            } else {
                await supabase.from('chat_messages').insert({
                    room_id: currentRoom.id, user_id: user.id,
                    content: msgInput, type: 'text', is_important: isImportant
                });
            }
            setMsgInput(''); setIsImportant(false);
        } catch (e) { console.error('Send error:', e); }
        finally { setLoading(false); }
    };

    const handleFileUpload = (e) => { const file = e.target.files?.[0]; if (!file || !currentRoom) return; setPendingFile(file); e.target.value = ''; };

    // Thread
    const [threadEnabled, setThreadEnabled] = useState(true);
    useEffect(() => { (async () => { const { error } = await supabase.from('chat_messages').select('parent_id').limit(0); if (error) { setThreadEnabled(false); } })(); }, []);

    const openThread = async (msg) => {
        setThreadParent(msg);
        const { data } = await supabase.from('chat_messages').select('*, profiles:user_id(id,name,email)').eq('parent_id', msg.id).order('created_at', { ascending: true });
        setThreadMessages(data || []);
    };

    const sendThreadReply = async () => {
        if (!threadInput.trim() || !threadParent || !currentRoom) return;
        setLoading(true);
        try {
            await supabase.from('chat_messages').insert({ room_id: currentRoom.id, user_id: user.id, content: threadInput, type: 'text', parent_id: threadParent.id });
            setThreadInput('');
            const { data } = await supabase.from('chat_messages').select('*, profiles:user_id(id,name,email)').eq('parent_id', threadParent.id).order('created_at', { ascending: true });
            setThreadMessages(data || []);
        } catch (e) { console.error('Thread reply error:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [threadMessages]);

    const handleToggleComplete = async (msgId, completionId) => {
        try {
            if (completionId) { await supabase.from('message_completions').delete().eq('id', completionId); }
            else { await supabase.from('message_completions').insert({ message_id: msgId, user_id: user.id }); }
            if (currentRoom) loadMessages(currentRoom.id);
        } catch (e) { console.error(e); }
    };

    // Reactions
    const [reactionsEnabled, setReactionsEnabled] = useState(true);
    useEffect(() => { (async () => { const { error } = await supabase.from('chat_reactions').select('id').limit(0); if (error) { console.warn('Reactions require chat_reactions table. Run migration.'); setReactionsEnabled(false); } })(); }, []);

    const toggleReaction = async (msgId, emoji) => {
        if (!reactionsEnabled) return;
        try {
            const { data: existing } = await supabase.from('chat_reactions').select('id').eq('message_id', msgId).eq('user_id', user.id).eq('emoji', emoji);
            if (existing && existing.length > 0) {
                await supabase.from('chat_reactions').delete().eq('id', existing[0].id);
            } else {
                await supabase.from('chat_reactions').insert({ message_id: msgId, user_id: user.id, emoji });
            }
            setReactionPickerMsg(null);
            if (currentRoom) loadMessages(currentRoom.id);
        } catch (e) { console.error('Reaction error:', e); }
    };

    const handleRoomCreated = (room) => { setRooms(prev => [room, ...prev]); setCurrentRoom(room); setShowCreateModal(false); loadRooms(); };
    const selectRoom = (room) => { setCurrentRoom(room); setUnreadMap(prev => { const n = { ...prev }; delete n[room.id]; return n; }); };

    // Expense report submission
    const EXPENSE_METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'];
    const submitExpense = async (data) => {
        if (!currentRoom) return;
        setLoading(true);
        try {
            const expContent = JSON.stringify({ type: 'expense', vendor: data.vendor, product: data.product, method: data.method, amount: data.amount });
            await supabase.from('chat_messages').insert({
                room_id: currentRoom.id, user_id: user.id,
                content: expContent, type: 'expense', is_important: false
            });
            // Also update room's updated_at
            await supabase.from('chat_rooms').update({ updated_at: new Date().toISOString() }).eq('id', currentRoom.id);
            setShowExpenseForm(false);
        } catch (e) { console.error('Expense submit error:', e); }
        finally { setLoading(false); }
    };

    // Create DM
    const createDM = async (targetUserId) => {
        setLoading(true);
        try {
            // Check if DM already exists
            const existing = dmRooms.find(r => {
                // DM rooms have exactly 2 members; check room name or metadata
                return r.dm_partner === targetUserId;
            });
            if (existing) { selectRoom(existing); setShowDmCreate(false); setLoading(false); return; }

            const targetUser = allUsers.find(u => u.id === targetUserId);
            const myName = _chatShortName(profile || allUsers.find(u => u.id === user.id));
            const theirName = _chatShortName(targetUser);
            const roomName = myName + ' ↔ ' + theirName;

            const { data: room, error: roomErr } = await supabase.from('chat_rooms').insert({
                name: roomName, type: 'dm', created_by: user.id
            }).select().single();
            if (roomErr) throw roomErr;
            await supabase.from('chat_room_members').insert([
                { room_id: room.id, user_id: user.id, role: 'admin' },
                { room_id: room.id, user_id: targetUserId, role: 'admin' }
            ]);
            setShowDmCreate(false);
            selectRoom(room);
            loadRooms();
        } catch(e) { console.error('DM create error:', e); }
        finally { setLoading(false); }
    };

    // Create expense group
    const createExpenseGroup = async (name, memberIds) => {
        setLoading(true);
        try {
            const { data: room, error: roomErr } = await supabase.from('chat_rooms').insert({
                name: name, type: 'expense', created_by: user.id
            }).select().single();
            if (roomErr) throw roomErr;
            const members = [user.id, ...memberIds].map(uid => ({ room_id: room.id, user_id: uid, role: uid === user.id ? 'admin' : 'member' }));
            await supabase.from('chat_room_members').insert(members);
            selectRoom(room);
            setSidebarTab('expense');
            loadRooms();
        } catch(e) { console.error('Expense group create error:', e); }
        finally { setLoading(false); }
    };

    // ── Group deal rooms by category ──
    const dealRoomsByCategory = useMemo(() => {
        const dealRooms = rooms.filter(r => !!dealRoomMap[r.id]);
        const catMap = {}; // { catId: { name, rooms: [] } }
        const uncategorized = [];

        dealRooms.forEach(r => {
            const deal = dealRoomMap[r.id];
            if (!deal) return;
            // Find account for this deal to get category_ids
            const acct = accounts.find(a => a.id === deal.account_id);
            const catIds = acct?.category_ids || [];
            if (catIds.length === 0) {
                uncategorized.push(r);
            } else {
                catIds.forEach(catId => {
                    if (!catMap[catId]) {
                        const cat = categories.find(c => c.id === catId);
                        catMap[catId] = { name: cat?.name || 'Unknown', rooms: [] };
                    }
                    catMap[catId].rooms.push(r);
                });
            }
        });

        const result = Object.entries(catMap).map(([id, data]) => ({ id, name: data.name, rooms: data.rooms }));
        result.sort((a, b) => a.name.localeCompare(b.name));
        if (uncategorized.length > 0) result.push({ id: '_uncategorized', name: 'その他', rooms: uncategorized });
        return { all: dealRooms, grouped: result };
    }, [rooms, dealRoomMap, accounts, categories]);

    // DM display name: show only the other person's name
    const myShortName = _chatShortName(profile || allUsers.find(u => u.id === user.id));
    const dmDisplayName = (room) => {
        if (!room || !room.name) return 'DM';
        const parts = room.name.split(/\s*↔\s*/);
        const other = parts.find(p => p !== myShortName);
        return other || parts[0] || 'DM';
    };

    // Filter sidebar rooms by search (exclude deal, expense, dm rooms)
    const filteredGeneralRooms = useMemo(() => {
        const general = rooms.filter(r => !dealRoomMap[r.id] && r.type !== 'expense' && r.type !== 'dm');
        if (!sidebarSearch.trim()) return general;
        const q = sidebarSearch.toLowerCase();
        return general.filter(r => r.name.toLowerCase().includes(q));
    }, [rooms, dealRoomMap, sidebarSearch]);

    const filteredExpenseRooms = useMemo(() => {
        const er = rooms.filter(r => r.type === 'expense');
        if (!sidebarSearch.trim()) return er;
        const q = sidebarSearch.toLowerCase();
        return er.filter(r => r.name.toLowerCase().includes(q));
    }, [rooms, sidebarSearch]);

    const filteredDmRooms = useMemo(() => {
        const dr = rooms.filter(r => r.type === 'dm');
        if (!sidebarSearch.trim()) return dr;
        const q = sidebarSearch.toLowerCase();
        return dr.filter(r => r.name.toLowerCase().includes(q));
    }, [rooms, sidebarSearch]);

    const filteredDealGroups = useMemo(() => {
        if (!sidebarSearch.trim()) return dealRoomsByCategory.grouped;
        const q = sidebarSearch.toLowerCase();
        return dealRoomsByCategory.grouped.map(g => ({
            ...g,
            rooms: g.rooms.filter(r => {
                const deal = dealRoomMap[r.id];
                return r.name.toLowerCase().includes(q) || (deal?.name || '').toLowerCase().includes(q);
            })
        })).filter(g => g.rooms.length > 0);
    }, [dealRoomsByCategory, sidebarSearch, dealRoomMap]);

    // ── Styles ──
    const sideW = compact ? 220 : 260;
    const S = {
        layout: { display: 'flex', height: '100%', overflow: 'hidden', background: t.bg },
        sidebar: { width: sideW, minWidth: sideW, background: t.card, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column' },
        sideHeader: { padding: compact ? '10px 12px' : '14px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
        roomItem: (active) => ({
            padding: compact ? '7px 10px' : '9px 12px', borderRadius: 7, cursor: 'pointer',
            fontSize: compact ? 12 : 13, color: active ? '#fff' : t.primary, marginBottom: 1,
            display: 'flex', alignItems: 'center', gap: 8,
            background: active ? t.primary : 'transparent',
            fontWeight: active ? 600 : 500,
            transition: 'background 0.1s',
        }),
        chatArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
        chatHeader: { padding: compact ? '10px 14px' : '14px 20px', borderBottom: `1px solid ${t.border}`, background: t.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
        messages: { flex: 1, overflowY: 'auto', padding: compact ? '12px 14px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 },
        inputArea: { padding: compact ? '8px 14px' : '12px 20px', borderTop: `1px solid ${t.border}`, background: t.card },
        inputRow: { display: 'flex', gap: 6, alignItems: 'center' },
        textInput: (imp) => ({
            flex: 1, padding: compact ? '8px 12px' : '10px 14px',
            border: `1.5px solid ${imp ? t.red : t.border}`, borderRadius: 10,
            fontFamily: 'inherit', fontSize: compact ? 13 : 14,
            background: imp ? '#fff5f5' : '#fff', outline: 'none',
            transition: 'border-color 0.15s',
        }),
        sendBtn: { padding: compact ? '8px 16px' : '10px 20px', background: t.primary, color: '#fff', border: 'none', borderRadius: 10, fontSize: compact ? 13 : 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
        iconBtn: { width: compact ? 30 : 32, height: compact ? 30 : 32, border: `1px solid ${t.border}`, borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 14 : 15, color: t.sub, flexShrink: 0, transition: 'background 0.1s' },
    };

    // ── Group messages by date ──
    const groupedMessages = [];
    let lastDate = '';
    messages.forEach(msg => {
        const d = _chatFormatDate(msg.created_at);
        if (d !== lastDate) { groupedMessages.push({ type: 'date', date: d }); lastDate = d; }
        groupedMessages.push({ type: 'msg', data: msg });
    });

    // Helper: stage badge
    const stageBadge = (stageId) => {
        const s = _DEAL_STAGES[stageId];
        if (!s) return null;
        return React.createElement('span', { style: { fontSize: 9, padding: '1px 5px', borderRadius: 3, background: s.color + '18', color: s.color, fontWeight: 600, whiteSpace: 'nowrap' } }, s.ja);
    };

    // Helper: get sender shortName
    const senderShortName = (msg) => {
        const p = msg.profiles;
        if (!p) return 'User';
        return _chatShortName(p);
    };

    // ── Render reaction groups ──
    const renderReactions = (msg) => {
        const reactions = msg.reactions || [];
        if (reactions.length === 0) return null;
        // Group by emoji
        const groups = {};
        reactions.forEach(r => {
            if (!groups[r.emoji]) groups[r.emoji] = [];
            groups[r.emoji].push(r);
        });
        return React.createElement('div', { style: { display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 } },
            Object.entries(groups).map(([emoji, list]) => {
                const isMine = list.some(r => r.user_id === user.id);
                const names = list.map(r => _chatShortName(r.profiles)).join(', ');
                return React.createElement('button', {
                    key: emoji,
                    title: names,
                    onClick: (e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); },
                    style: {
                        display: 'flex', alignItems: 'center', gap: 2,
                        padding: '1px 5px', borderRadius: 10,
                        border: isMine ? '1.5px solid ' + t.accent : '1px solid ' + t.border,
                        background: isMine ? t.accent + '12' : '#fff',
                        fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                        color: t.primary, lineHeight: '18px'
                    }
                }, emoji, list.length > 1 ? React.createElement('span', { style: { fontSize: 9, fontWeight: 600, color: t.sub } }, list.length) : null);
            })
        );
    };

    // ── Render message bubble (LINE-style: timestamp beside bubble) ──
    const renderMessage = (msg, idx) => {
        const isOwn = msg.user_id === user.id;
        const name = senderShortName(msg);
        const myCompletion = msg.completions?.find(c => c.user_id === user.id);
        const isHovered = hoveredMsg === msg.id;
        const bubbleBg = msg.is_important ? '#fff0f0' : (isOwn ? '#e8e8e8' : '#f5f5f5');
        const bubbleColor = t.primary;
        const fs = compact ? 13 : 14;

        const timeEl = React.createElement('span', {
            style: { fontSize: 10, color: t.muted, whiteSpace: 'nowrap', alignSelf: 'flex-end', flexShrink: 0, marginBottom: 2 }
        }, _chatFormatTime(msg.created_at));

        const bubbleContent = React.createElement('div', { style: { minWidth: 0, position: 'relative' } },
            // Name (only for others)
            !isOwn && React.createElement('div', { style: { fontSize: 11, color: t.muted, marginBottom: 2, fontWeight: 600 } }, name),
            // Bubble — text
            msg.type === 'text' && React.createElement('div', {
                style: {
                    padding: '8px 12px', borderRadius: isOwn ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                    fontSize: fs, lineHeight: 1.6, wordWrap: 'break-word',
                    background: bubbleBg, color: bubbleColor,
                    ...(msg.is_important ? { borderLeft: '3px solid #e53e3e' } : {})
                }
            }, msg.content),
            // Bubble — expense report
            msg.type === 'expense' && (() => {
                let exp = {};
                try { exp = JSON.parse(msg.content); } catch(e) { exp = { vendor: '-', product: msg.content, method: '-', amount: 0 }; }
                const amt = Number(exp.amount) || 0;
                return React.createElement('div', {
                    style: { padding: '10px 14px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fcd34d', minWidth: 220 }
                },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 } },
                        React.createElement('span', { style: { fontSize: 15 } }, '💰'),
                        React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: '#92400e' } }, '経費報告')
                    ),
                    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 10px', fontSize: 13 } },
                        React.createElement('span', { style: { color: t.muted, fontWeight: 500 } }, '購入先'),
                        React.createElement('span', { style: { fontWeight: 600, color: t.primary } }, exp.vendor || '-'),
                        React.createElement('span', { style: { color: t.muted, fontWeight: 500 } }, '商品'),
                        React.createElement('span', { style: { fontWeight: 600, color: t.primary } }, exp.product || '-'),
                        React.createElement('span', { style: { color: t.muted, fontWeight: 500 } }, '支払方法'),
                        React.createElement('span', { style: { fontWeight: 600, color: t.primary } }, exp.method || '-'),
                        React.createElement('span', { style: { color: t.muted, fontWeight: 500 } }, '金額'),
                        React.createElement('span', { style: { fontWeight: 700, color: '#b45309', fontSize: 14 } }, '¥' + amt.toLocaleString())
                    )
                );
            })(),
            // File
            msg.type === 'file' && msg.file_data && React.createElement('a', {
                href: msg.file_data.url, target: '_blank', rel: 'noopener',
                style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: isOwn ? '#ebebeb' : '#f5f5f5', border: `1px solid ${t.border}`, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }
            },
                React.createElement('span', { style: { fontSize: 18 } }, '📎'),
                React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, msg.file_data.name),
                    React.createElement('div', { style: { fontSize: 11, color: t.muted } }, _chatFormatBytes(msg.file_data.size))
                )
            ),
            // Completions
            msg.completions?.length > 0 && React.createElement('div', { style: { fontSize: 11, color: t.green, marginTop: 2 } }, '✓ ', msg.completions.map(c => _chatShortName(c.profiles)).join(', ')),
            // Action row (shown on hover)
            isHovered && React.createElement('div', {
                style: {
                    position: 'absolute', top: -6, ...(isOwn ? { left: 0 } : { right: 0 }),
                    display: 'flex', gap: 2, background: '#fff', border: '1px solid ' + t.border,
                    borderRadius: 6, padding: '2px 3px', boxShadow: '0 2px 8px rgba(0,0,0,.08)', zIndex: 10
                }
            },
                // Complete
                !isOwn && React.createElement('button', {
                    onClick: (e) => { e.stopPropagation(); handleToggleComplete(msg.id, myCompletion?.id); },
                    style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 4, color: myCompletion ? t.green : t.muted },
                    onMouseEnter: (e) => { e.currentTarget.style.background = '#f3f3f3'; },
                    onMouseLeave: (e) => { e.currentTarget.style.background = 'none'; },
                    title: myCompletion ? '確認済み' : '確認'
                }, myCompletion ? '✅' : '☐'),
                // Thread removed
            )
        );

        // LINE-style layout: avatar + bubble + time (or time + bubble + avatar for own)
        return React.createElement('div', {
            key: msg.id,
            onMouseEnter: () => setHoveredMsg(msg.id),
            onMouseLeave: () => setHoveredMsg(null),
            style: { display: 'flex', gap: 6, maxWidth: '80%', padding: '4px 0', alignItems: 'flex-end', ...(isOwn ? { marginLeft: 'auto', flexDirection: 'row-reverse' } : {}) }
        },
            // Avatar
            React.createElement('div', {
                style: { width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: '50%', background: isOwn ? '#c8c8c8' : '#e0e0e0', color: isOwn ? '#fff' : t.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 10 : 11, fontWeight: 700, flexShrink: 0, border: '1px solid ' + t.border, marginBottom: 2 }
            }, _chatInitial(name)),
            bubbleContent,
            timeEl
        );
    };

    return (
        React.createElement('div', { style: S.layout },
            // ── Sidebar ──
            React.createElement('div', { style: S.sidebar },
                React.createElement('div', { style: { ...S.sideHeader, flexDirection: 'column', gap: 6, alignItems: 'stretch' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                        React.createElement('span', { style: { fontSize: compact ? 13 : 15, fontWeight: 700, color: t.primary } }, 'チャット'),
                        React.createElement('button', {
                            style: { ...S.iconBtn, width: 26, height: 26, fontSize: 14, borderRadius: 6 },
                            onClick: () => {
                                if (sidebarTab === 'dm') setShowDmCreate(true);
                                else if (sidebarTab === 'expense') setShowCreateModal('expense');
                                else setShowCreateModal(true);
                            },
                            onMouseEnter: (e) => { e.currentTarget.style.background = '#f3f3f3'; },
                            onMouseLeave: (e) => { e.currentTarget.style.background = '#fff'; }
                        }, '+')
                    ),
                    // Tab bar
                    React.createElement('div', { style: { display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid ' + t.border } },
                        [
                            { id: 'group', label: 'グループ' },
                            { id: 'expense', label: '経費' },
                            { id: 'deal', label: '商談' },
                            { id: 'dm', label: 'DM' }
                        ].map(tab => {
                            const active = sidebarTab === tab.id;
                            const unreadCount = (() => {
                                if (tab.id === 'group') return Object.entries(unreadMap).filter(([rid]) => filteredGeneralRooms.some(r => r.id === rid)).reduce((s, [, c]) => s + c, 0);
                                if (tab.id === 'expense') return Object.entries(unreadMap).filter(([rid]) => rooms.some(r => r.id === rid && r.type === 'expense')).reduce((s, [, c]) => s + c, 0);
                                if (tab.id === 'deal') return Object.entries(unreadMap).filter(([rid]) => !!dealRoomMap[rid]).reduce((s, [, c]) => s + c, 0);
                                if (tab.id === 'dm') return Object.entries(unreadMap).filter(([rid]) => rooms.some(r => r.id === rid && r.type === 'dm')).reduce((s, [, c]) => s + c, 0);
                                return 0;
                            })();
                            return React.createElement('button', {
                                key: tab.id,
                                onClick: () => setSidebarTab(tab.id),
                                style: {
                                    flex: 1, padding: '4px 2px', border: 'none', fontSize: 10, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                                    background: active ? t.primary : '#fff',
                                    color: active ? '#fff' : t.sub,
                                    transition: 'all 0.15s'
                                }
                            },
                                tab.label,
                                unreadCount > 0 ? React.createElement('span', {
                                    style: { position: 'absolute', top: -2, right: 2, background: t.red, color: '#fff', borderRadius: 6, padding: '0 3px', fontSize: 8, fontWeight: 700, minWidth: 12, textAlign: 'center', lineHeight: '14px' }
                                }, unreadCount) : null
                            );
                        })
                    )
                ),
                // Search
                React.createElement('div', { style: { padding: '4px 8px' } },
                    React.createElement('input', {
                        value: sidebarSearch, onChange: e => setSidebarSearch(e.target.value),
                        placeholder: '検索...',
                        style: { width: '100%', padding: '5px 8px', border: '1px solid ' + t.border, borderRadius: 6, fontSize: 11, outline: 'none', fontFamily: 'inherit', background: t.bg }
                    })
                ),
                React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '4px 6px' } },
                    // === グループ tab ===
                    sidebarTab === 'group' && React.createElement('div', null,
                        filteredGeneralRooms.map(room =>
                            React.createElement('div', {
                                key: room.id,
                                style: S.roomItem(currentRoom?.id === room.id),
                                onClick: () => selectRoom(room),
                                onContextMenu: (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, room }); },
                                onMouseEnter: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = t.bg; },
                                onMouseLeave: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = 'transparent'; }
                            },
                                React.createElement('span', { style: { fontSize: 13 } }, '#'),
                                React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, room.name),
                                unreadMap[room.id] ? React.createElement('span', {
                                    style: { background: t.red, color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700, minWidth: 16, textAlign: 'center' }
                                }, unreadMap[room.id]) : null
                            )
                        ),
                        filteredGeneralRooms.length === 0 && React.createElement('p', { style: { padding: '6px 10px', color: t.muted, fontSize: 11 } }, 'グループなし')
                    ),
                    // === 経費報告 tab ===
                    sidebarTab === 'expense' && React.createElement('div', null,
                        filteredExpenseRooms.map(room =>
                            React.createElement('div', {
                                key: room.id,
                                style: S.roomItem(currentRoom?.id === room.id),
                                onClick: () => selectRoom(room),
                                onContextMenu: (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, room }); },
                                onMouseEnter: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = t.bg; },
                                onMouseLeave: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = 'transparent'; }
                            },
                                React.createElement('span', { style: { fontSize: 13 } }, '💰'),
                                React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, room.name),
                                unreadMap[room.id] ? React.createElement('span', {
                                    style: { background: t.red, color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700, minWidth: 16, textAlign: 'center' }
                                }, unreadMap[room.id]) : null
                            )
                        ),
                        filteredExpenseRooms.length === 0 && React.createElement('p', { style: { padding: '6px 10px', color: t.muted, fontSize: 11 } }, '経費報告グループなし')
                    ),
                    // === 商談 tab ===
                    sidebarTab === 'deal' && (() => {
                        if (dealRoomsByCategory.all.length === 0) return React.createElement('p', { style: { padding: '6px 10px', color: t.muted, fontSize: 11 } }, '商談チャットなし');
                        const toggleCat = (catId) => setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
                        return React.createElement('div', null,
                            filteredDealGroups.map(group =>
                                React.createElement('div', { key: group.id, style: { marginTop: 2 } },
                                    React.createElement('div', {
                                        style: { padding: '3px 8px', fontSize: 10, fontWeight: 600, color: t.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' },
                                        onClick: () => toggleCat(group.id)
                                    },
                                        React.createElement('span', { style: { fontSize: 7, transition: 'transform 0.15s', transform: collapsedCategories[group.id] ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
                                        React.createElement('span', null, group.name),
                                        React.createElement('span', { style: { fontSize: 9, color: t.muted, fontWeight: 400 } }, '(' + group.rooms.length + ')')
                                    ),
                                    !collapsedCategories[group.id] && group.rooms.map(room => {
                                        const deal = dealRoomMap[room.id];
                                        const stg = deal?.stage;
                                        return React.createElement('div', {
                                            key: room.id,
                                            style: { ...S.roomItem(currentRoom?.id === room.id), padding: '5px 8px 5px 12px', gap: 6 },
                                            onClick: () => selectRoom(room),
                                            onContextMenu: (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, room }); },
                                            onMouseEnter: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = t.bg; },
                                            onMouseLeave: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = 'transparent'; }
                                        },
                                            React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 } },
                                                React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                                                    React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: compact ? 11 : 12 } }, room.name),
                                                    stg && (currentRoom?.id === room.id
                                                        ? React.createElement('span', { style: { fontSize: 8, padding: '0px 4px', borderRadius: 3, background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' } }, _DEAL_STAGES[stg]?.ja || stg)
                                                        : stageBadge(stg)
                                                    )
                                                )
                                            ),
                                            unreadMap[room.id] ? React.createElement('span', {
                                                style: { background: t.red, color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700, minWidth: 16, textAlign: 'center' }
                                            }, unreadMap[room.id]) : null
                                        );
                                    })
                                )
                            )
                        );
                    })(),
                    // === DM tab ===
                    sidebarTab === 'dm' && React.createElement('div', null,
                        filteredDmRooms.map(room =>
                            React.createElement('div', {
                                key: room.id,
                                style: S.roomItem(currentRoom?.id === room.id),
                                onClick: () => selectRoom(room),
                                onMouseEnter: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = t.bg; },
                                onMouseLeave: (e) => { if (currentRoom?.id !== room.id) e.currentTarget.style.background = 'transparent'; }
                            },
                                React.createElement('span', { style: { fontSize: 13 } }, '👤'),
                                React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, dmDisplayName(room)),
                                unreadMap[room.id] ? React.createElement('span', {
                                    style: { background: t.red, color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700, minWidth: 16, textAlign: 'center' }
                                }, unreadMap[room.id]) : null
                            )
                        ),
                        filteredDmRooms.length === 0 && React.createElement('p', { style: { padding: '6px 10px', color: t.muted, fontSize: 11 } }, 'DMなし')
                    )
                ),
                // Footer
                !compact && React.createElement('div', {
                    style: { padding: '10px 12px', borderTop: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: t.sub }
                },
                    React.createElement('div', {
                        style: { width: 26, height: 26, borderRadius: '50%', background: t.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }
                    }, _chatInitial(_chatShortName(profile))),
                    React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, _chatShortName(profile)),
                    onLogout && React.createElement('button', { style: { ...S.iconBtn, fontSize: 11, width: 24, height: 24 }, onClick: onLogout, title: 'ログアウト' }, '↩')
                )
            ),

            // Context menu
            contextMenu && React.createElement('div', {
                style: { position: 'fixed', left: contextMenu.x, top: contextMenu.y, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', zIndex: 1000, padding: '4px 0', minWidth: 130 },
                onClick: (e) => e.stopPropagation()
            },
                React.createElement('div', {
                    style: { padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: t.red, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 4 },
                    onMouseEnter: (e) => { e.currentTarget.style.background = '#fef2f2'; },
                    onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; },
                    onClick: () => { setDeleteConfirmRoom(contextMenu.room); setContextMenu(null); }
                }, '🗑 ルームを削除')
            ),

            // Delete confirm modal
            deleteConfirmRoom && React.createElement('div', {
                style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
                onClick: () => setDeleteConfirmRoom(null)
            },
                React.createElement('div', {
                    style: { background: '#fff', borderRadius: 12, padding: '22px 26px', maxWidth: 360, boxShadow: '0 12px 40px rgba(0,0,0,.15)' },
                    onClick: (e) => e.stopPropagation()
                },
                    React.createElement('div', { style: { fontSize: 15, fontWeight: 700, color: t.primary, marginBottom: 8 } }, 'ルームを削除'),
                    React.createElement('div', { style: { fontSize: 13, color: t.sub, marginBottom: 6, lineHeight: 1.6 } },
                        '「' + deleteConfirmRoom.name + '」を削除しますか？'),
                    React.createElement('div', { style: { fontSize: 11, color: t.muted, marginBottom: 18 } },
                        'メッセージもすべて削除されます。この操作は取り消せません。'),
                    React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                        React.createElement('button', {
                            style: { padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' },
                            onClick: () => setDeleteConfirmRoom(null)
                        }, 'キャンセル'),
                        React.createElement('button', {
                            style: { padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: t.red, color: '#fff', fontFamily: 'inherit' },
                            onClick: () => deleteRoom(deleteConfirmRoom)
                        }, '削除する')
                    )
                )
            ),

            // ── Chat area ──
            React.createElement('div', {
                style: { ...S.chatArea, position: 'relative', border: dragOver ? '2px dashed ' + t.accent : 'none' },
                onDragOver: (e) => { e.preventDefault(); setDragOver(true); },
                onDragLeave: () => setDragOver(false),
                onDrop: (e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files?.[0]; if (file && currentRoom) setPendingFile(file); }
            },
                dragOver && React.createElement('div', {
                    style: { position: 'absolute', inset: 0, background: 'rgba(59,130,246,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, borderRadius: 8 }
                }, React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: t.accent } }, 'ファイルをドロップして添付')),
                currentRoom ? React.createElement(React.Fragment, null,
                    // Header
                    React.createElement('div', { style: { ...S.chatHeader } },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                            React.createElement('span', { style: { fontSize: compact ? 14 : 16, fontWeight: 700, color: t.primary } }, currentRoom.type === 'dm' ? dmDisplayName(currentRoom) : currentRoom.name),
                            (() => {
                                const deal = dealRoomMap[currentRoom.id];
                                if (!deal) return null;
                                return stageBadge(deal.stage);
                            })(),
                            currentRoom.description && React.createElement('span', { style: { fontSize: 11, color: t.muted } }, currentRoom.description)
                        ),
                        React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
                            currentRoom.type === 'expense' && React.createElement('button', {
                                style: { padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#f59e0b', color: '#fff', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'opacity 0.15s' },
                                onClick: () => setShowExpenseForm(true),
                                onMouseEnter: (e) => { e.currentTarget.style.opacity = '0.85'; },
                                onMouseLeave: (e) => { e.currentTarget.style.opacity = '1'; }
                            }, '💰 経費を報告'),
                            dealRoomMap[currentRoom.id] && onOpenDeal ? React.createElement('button', {
                                style: { padding: '4px 12px', borderRadius: 6, border: '1px solid ' + t.border, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: t.accent, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' },
                                onClick: () => onOpenDeal(dealRoomMap[currentRoom.id]),
                                onMouseEnter: (e) => { e.currentTarget.style.background = t.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = t.accent; },
                                onMouseLeave: (e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = t.accent; e.currentTarget.style.borderColor = t.border; }
                            }, '商談詳細 →') : null
                        )
                    ),
                    // Messages
                    React.createElement('div', { style: S.messages },
                        groupedMessages.map((item, idx) => {
                            if (item.type === 'date') {
                                return React.createElement('div', { key: 'date-' + idx, style: { textAlign: 'center', padding: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' } },
                                    React.createElement('div', { style: { height: 1, flex: 1, background: t.borderLight } }),
                                    React.createElement('span', { style: { fontSize: 10, color: t.muted, fontWeight: 600, whiteSpace: 'nowrap' } }, item.date),
                                    React.createElement('div', { style: { height: 1, flex: 1, background: t.borderLight } })
                                );
                            }
                            return renderMessage(item.data, idx);
                        }),
                        React.createElement('div', { ref: messagesEndRef })
                    ),
                    // Pending file preview
                    pendingFile && React.createElement('div', {
                        style: { padding: '6px 14px', background: '#f0f7ff', borderTop: '1px solid ' + t.border, display: 'flex', alignItems: 'center', gap: 8 }
                    },
                        React.createElement('span', { style: { fontSize: 16 } }, pendingFile.type?.startsWith('image/') ? '🖼' : '📄'),
                        React.createElement('span', { style: { fontSize: 11, color: t.primary, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, pendingFile.name),
                        React.createElement('span', { style: { fontSize: 10, color: t.muted } }, (pendingFile.size / 1024).toFixed(0) + ' KB'),
                        React.createElement('button', { type: 'button', style: { background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, fontFamily: 'inherit', padding: '0 4px' }, onClick: () => setPendingFile(null) }, '×')
                    ),
                    // Input
                    React.createElement('div', { style: S.inputArea },
                        React.createElement('form', { onSubmit: handleSend, style: S.inputRow },
                            React.createElement('input', { type: 'file', ref: fileInputRef, style: { display: 'none' }, onChange: handleFileUpload }),
                            React.createElement('button', {
                                type: 'button', style: S.iconBtn, onClick: () => fileInputRef.current?.click(), disabled: loading,
                                onMouseEnter: (e) => { e.currentTarget.style.background = '#f3f3f3'; },
                                onMouseLeave: (e) => { e.currentTarget.style.background = '#fff'; }
                            }, '📎'),
                            React.createElement('input', {
                                type: 'text', value: msgInput, onChange: e => setMsgInput(e.target.value),
                                placeholder: 'メッセージを入力...',
                                disabled: loading,
                                style: S.textInput(isImportant),
                                onFocus: (e) => { e.currentTarget.style.borderColor = isImportant ? t.red : t.accent; },
                                onBlur: (e) => { e.currentTarget.style.borderColor = isImportant ? t.red : t.border; }
                            }),
                            React.createElement('button', {
                                type: 'button',
                                style: { ...S.iconBtn, ...(isImportant ? { background: t.red, color: '#fff', borderColor: t.red } : {}) },
                                onClick: () => setIsImportant(!isImportant),
                                onMouseEnter: (e) => { if (!isImportant) e.currentTarget.style.background = '#f3f3f3'; },
                                onMouseLeave: (e) => { if (!isImportant) e.currentTarget.style.background = '#fff'; }
                            }, '!'),
                            React.createElement('button', {
                                type: 'submit',
                                style: { ...S.sendBtn, opacity: loading || (!msgInput.trim() && !pendingFile) ? 0.4 : 1 },
                                disabled: loading || (!msgInput.trim() && !pendingFile)
                            }, '送信')
                        )
                    )
                ) : React.createElement('div', {
                    style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.muted, fontSize: compact ? 12 : 14, textAlign: 'center' }
                },
                    React.createElement('div', null,
                        React.createElement('p', { style: { fontSize: 24, marginBottom: 8 } }, '💬'),
                        React.createElement('p', { style: { fontWeight: 500 } }, 'チャットを選択してください')
                    )
                )
            ),

            // Create Room Modal (group)
            showCreateModal === true && React.createElement(window.GSChat.CreateRoomModal, {
                supabase, user, allUsers,
                onClose: () => setShowCreateModal(false),
                onCreated: handleRoomCreated,
                theme: t, compact
            }),

            // Create Expense Group Modal
            showCreateModal === 'expense' && React.createElement(window.GSChat.ExpenseGroupModal, {
                user, allUsers, theme: t,
                onClose: () => setShowCreateModal(false),
                onCreate: (name, memberIds) => { setShowCreateModal(false); createExpenseGroup(name, memberIds); }
            }),

            // Expense Form Modal
            showExpenseForm && React.createElement(window.GSChat.ExpenseFormModal, {
                theme: t,
                onClose: () => setShowExpenseForm(false),
                onSubmit: submitExpense,
                loading: loading
            }),

            // DM Create Modal
            showDmCreate && React.createElement(window.GSChat.DmCreateModal, {
                user, allUsers, theme: t,
                onClose: () => setShowDmCreate(false),
                onCreate: createDM
            })
        )
    );
};

// ============================================================
// CreateRoomModal
// ============================================================
window.GSChat.CreateRoomModal = function CreateRoomModal({ supabase, user, allUsers, onClose, onCreated, theme, compact }) {
    const { useState } = React;
    const t = theme || CT;

    const [roomName, setRoomName] = useState('');
    const [selected, setSelected] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const otherUsers = allUsers.filter(u => u.id !== user.id);
    const toggleUser = (id) => { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

    const handleCreate = async () => {
        if (!roomName.trim()) { setErr('グループ名を入力してください'); return; }
        setLoading(true); setErr('');
        try {
            const { data: room, error: roomErr } = await supabase.from('chat_rooms').insert({ name: roomName.trim(), type: 'group', created_by: user.id }).select().single();
            if (roomErr) throw roomErr;
            const members = [user.id, ...selected].map(uid => ({ room_id: room.id, user_id: uid, role: uid === user.id ? 'admin' : 'member' }));
            const { error: memErr } = await supabase.from('chat_room_members').insert(members);
            if (memErr) throw memErr;
            onCreated(room);
        } catch (e) { setErr('作成失敗: ' + e.message); }
        finally { setLoading(false); }
    };

    const I = { width: '100%', padding: '8px 12px', border: `1.5px solid ${t.border}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', outline: 'none' };
    const B = { width: '100%', padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };

    return React.createElement('div', {
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
        onMouseDown: e => { if (e.target === e.currentTarget) onClose(); }
    },
        React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: '24px 26px', width: '90%', maxWidth: 400, boxShadow: '0 12px 40px rgba(0,0,0,.12)' } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 18, color: t.primary } }, 'グループ作成'),
            React.createElement('div', { style: { marginBottom: 14 } },
                React.createElement('label', { style: { display: 'block', fontSize: 11, fontWeight: 600, color: t.sub, marginBottom: 5 } }, 'グループ名'),
                React.createElement('input', { value: roomName, onChange: e => setRoomName(e.target.value), placeholder: '例: 営業チーム', style: I })
            ),
            otherUsers.length > 0 && React.createElement('div', null,
                React.createElement('label', { style: { fontSize: 11, fontWeight: 600, color: t.sub } }, 'メンバーを招待'),
                React.createElement('div', { style: { maxHeight: 200, overflowY: 'auto', marginTop: 6 } },
                    otherUsers.map(u =>
                        React.createElement('div', {
                            key: u.id,
                            style: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', borderBottom: `1px solid ${t.borderLight}`, fontSize: 13, cursor: 'pointer' },
                            onClick: () => toggleUser(u.id)
                        },
                            React.createElement('div', {
                                style: { width: 16, height: 16, borderRadius: 4, border: selected.includes(u.id) ? 'none' : '1.5px solid ' + t.border, background: selected.includes(u.id) ? t.accent : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, transition: 'all 0.1s' }
                            }, selected.includes(u.id) ? '✓' : ''),
                            React.createElement('span', { style: { fontWeight: 500 } }, _chatShortName(u))
                        )
                    )
                )
            ),
            err && React.createElement('div', { style: { fontSize: 11, color: t.red, marginTop: 8 } }, err),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 18 } },
                React.createElement('button', { onClick: onClose, style: { ...B, background: '#f3f3f3', color: t.sub } }, 'キャンセル'),
                React.createElement('button', { onClick: handleCreate, disabled: loading, style: { ...B, background: t.primary, color: '#fff', opacity: loading ? 0.5 : 1 } }, loading ? '作成中...' : '作成')
            )
        )
    );
};

// ============================================================
// ExpenseFormModal — ワンクリック経費報告フォーム
// ============================================================
window.GSChat.ExpenseFormModal = function ExpenseFormModal({ theme, onClose, onSubmit, loading }) {
    const { useState } = React;
    const t = theme || CT;
    const METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'];
    const [vendor, setVendor] = useState('');
    const [product, setProduct] = useState('');
    const [method, setMethod] = useState('Amex');
    const [amount, setAmount] = useState('');
    const [err, setErr] = useState('');

    const handleSubmit = () => {
        if (!vendor.trim()) { setErr('購入先を入力してください'); return; }
        if (!product.trim()) { setErr('商品を入力してください'); return; }
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setErr('金額を正しく入力してください'); return; }
        setErr('');
        onSubmit({ vendor: vendor.trim(), product: product.trim(), method, amount: Number(amount) });
    };

    const I = { width: '100%', padding: '8px 12px', border: '1.5px solid ' + t.border, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', outline: 'none' };
    const L = { display: 'block', fontSize: 11, fontWeight: 600, color: t.sub, marginBottom: 4 };

    return React.createElement('div', {
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
        onMouseDown: e => { if (e.target === e.currentTarget) onClose(); }
    },
        React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: '22px 26px', width: '90%', maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,.12)' } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 } }, '💰', ' 経費報告'),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
                React.createElement('div', null,
                    React.createElement('label', { style: L }, '購入先 *'),
                    React.createElement('input', { value: vendor, onChange: e => setVendor(e.target.value), placeholder: 'Amazon, コンビニ etc.', style: I })
                ),
                React.createElement('div', null,
                    React.createElement('label', { style: L }, '商品 *'),
                    React.createElement('input', { value: product, onChange: e => setProduct(e.target.value), placeholder: '備品、交通費 etc.', style: I })
                ),
                React.createElement('div', null,
                    React.createElement('label', { style: L }, '支払方法'),
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4 } },
                        METHODS.map(m => React.createElement('button', {
                            key: m,
                            onClick: () => setMethod(m),
                            style: {
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                border: method === m ? '1.5px solid #f59e0b' : '1px solid ' + t.border,
                                background: method === m ? '#fffbeb' : '#fff',
                                color: method === m ? '#92400e' : t.sub,
                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s'
                            }
                        }, m))
                    )
                ),
                React.createElement('div', null,
                    React.createElement('label', { style: L }, '金額 (円) *'),
                    React.createElement('input', {
                        value: amount, onChange: e => setAmount(e.target.value.replace(/[^0-9]/g, '')),
                        placeholder: '1000', style: { ...I, fontSize: 16, fontWeight: 700 },
                        inputMode: 'numeric'
                    })
                )
            ),
            err && React.createElement('div', { style: { fontSize: 11, color: t.red, marginTop: 8 } }, err),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 16 } },
                React.createElement('button', {
                    onClick: onClose,
                    style: { flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: t.sub }
                }, 'キャンセル'),
                React.createElement('button', {
                    onClick: handleSubmit, disabled: loading,
                    style: { flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#f59e0b', color: '#fff', opacity: loading ? 0.5 : 1 }
                }, loading ? '送信中...' : '報告する')
            )
        )
    );
};

// ============================================================
// ExpenseGroupModal — 経費グループ作成
// ============================================================
window.GSChat.ExpenseGroupModal = function ExpenseGroupModal({ user, allUsers, theme, onClose, onCreate }) {
    const { useState } = React;
    const t = theme || CT;
    const [name, setName] = useState('');
    const [selected, setSelected] = useState([]);
    const [err, setErr] = useState('');
    const otherUsers = allUsers.filter(u => u.id !== user.id);
    const toggleUser = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const I = { width: '100%', padding: '8px 12px', border: '1.5px solid ' + t.border, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff', outline: 'none' };

    return React.createElement('div', {
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
        onMouseDown: e => { if (e.target === e.currentTarget) onClose(); }
    },
        React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: '22px 26px', width: '90%', maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,.12)' } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: t.primary } }, '💰 経費報告グループ作成'),
            React.createElement('div', { style: { marginBottom: 12 } },
                React.createElement('label', { style: { display: 'block', fontSize: 11, fontWeight: 600, color: t.sub, marginBottom: 4 } }, 'グループ名 *'),
                React.createElement('input', { value: name, onChange: e => setName(e.target.value), placeholder: '例: J-Beauty経費', style: I })
            ),
            otherUsers.length > 0 && React.createElement('div', null,
                React.createElement('label', { style: { fontSize: 11, fontWeight: 600, color: t.sub } }, 'メンバー'),
                React.createElement('div', { style: { maxHeight: 180, overflowY: 'auto', marginTop: 6 } },
                    otherUsers.map(u =>
                        React.createElement('div', {
                            key: u.id,
                            style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid ' + t.borderLight, fontSize: 13, cursor: 'pointer' },
                            onClick: () => toggleUser(u.id)
                        },
                            React.createElement('div', {
                                style: { width: 16, height: 16, borderRadius: 4, border: selected.includes(u.id) ? 'none' : '1.5px solid ' + t.border, background: selected.includes(u.id) ? '#f59e0b' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }
                            }, selected.includes(u.id) ? '✓' : ''),
                            React.createElement('span', { style: { fontWeight: 500 } }, _chatShortName(u))
                        )
                    )
                )
            ),
            err && React.createElement('div', { style: { fontSize: 11, color: t.red, marginTop: 8 } }, err),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 16 } },
                React.createElement('button', {
                    onClick: onClose,
                    style: { flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: t.sub }
                }, 'キャンセル'),
                React.createElement('button', {
                    onClick: () => {
                        if (!name.trim()) { setErr('グループ名を入力してください'); return; }
                        onCreate(name.trim(), selected);
                    },
                    style: { flex: 1, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#f59e0b', color: '#fff' }
                }, '作成')
            )
        )
    );
};

// ============================================================
// DmCreateModal — DM相手選択
// ============================================================
window.GSChat.DmCreateModal = function DmCreateModal({ user, allUsers, theme, onClose, onCreate }) {
    const { useState } = React;
    const t = theme || CT;
    const otherUsers = allUsers.filter(u => u.id !== user.id);

    return React.createElement('div', {
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 },
        onMouseDown: e => { if (e.target === e.currentTarget) onClose(); }
    },
        React.createElement('div', { style: { background: '#fff', borderRadius: 12, padding: '22px 26px', width: '90%', maxWidth: 340, boxShadow: '0 12px 40px rgba(0,0,0,.12)' } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: t.primary } }, '新しいDM'),
            React.createElement('div', { style: { maxHeight: 300, overflowY: 'auto' } },
                otherUsers.map(u =>
                    React.createElement('div', {
                        key: u.id,
                        style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: '1px solid ' + t.borderLight, cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' },
                        onClick: () => onCreate(u.id),
                        onMouseEnter: (e) => { e.currentTarget.style.background = t.bg; },
                        onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent'; }
                    },
                        React.createElement('div', {
                            style: { width: 32, height: 32, borderRadius: '50%', background: t.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }
                        }, _chatInitial(_chatShortName(u))),
                        React.createElement('div', null,
                            React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: t.primary } }, _chatShortName(u)),
                            React.createElement('div', { style: { fontSize: 10, color: t.muted } }, u.email || '')
                        )
                    )
                )
            ),
            React.createElement('button', {
                onClick: onClose,
                style: { width: '100%', marginTop: 14, padding: '9px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: t.sub }
            }, '閉じる')
        )
    );
};
