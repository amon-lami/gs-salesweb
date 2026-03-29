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
    const _isMobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    const [rooms, setRooms] = useState([]);
    const [currentRoom, _setCurrentRoom] = useState(null);
    const setCurrentRoom = (room) => { _setCurrentRoom(room); if (room) { try { window._gsChatLastRoomId = room.id; } catch(e){} } };
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
    const [editingRoomName, setEditingRoomName] = useState(false);
    const [editRoomNameVal, setEditRoomNameVal] = useState('');
    const saveRoomName = async () => {
        if (!editRoomNameVal.trim() || !currentRoom) return;
        const { error } = await supabase.from('chat_rooms').update({ name: editRoomNameVal.trim() }).eq('id', currentRoom.id);
        if (!error) {
            setRooms(prev => prev.map(r => r.id === currentRoom.id ? { ...r, name: editRoomNameVal.trim() } : r));
            setCurrentRoom(prev => prev ? { ...prev, name: editRoomNameVal.trim() } : prev);
        }
        setEditingRoomName(false);
    };
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const roomsRef = useRef([]);
    const allUsersRef = useRef([]);
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
    // Mobile: show room list or chat area
    const [showMobileRoomList, setShowMobileRoomList] = useState(_isMobile);
    // Delete message confirmation
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null);
    // Drag & drop reordering for group rooms
    const [dragRoomId, setDragRoomId] = useState(null);
    const [dragOverRoomId, setDragOverRoomId] = useState(null);
    const [roomOrder, setRoomOrder] = useState(() => { try { const s = localStorage.getItem('gs_chat_room_order'); return s ? JSON.parse(s) : []; } catch(e) { return []; } });
    const saveRoomOrder = useCallback((order) => { setRoomOrder(order); try { localStorage.setItem('gs_chat_room_order', JSON.stringify(order)); } catch(e) {} }, []);

    // Categories from external or internal
    const categories = externalCategories || [];
    const accounts = externalAccounts || [];

    useEffect(() => { loadRooms(); if (!externalUsers || externalUsers.length === 0) loadAllUsers(); requestNotificationPermission(); }, []);

    // Auto-switch to deal room when ChatPanel sets _gsChatLastRoomId
    useEffect(() => {
        const interval = setInterval(() => {
            const wantId = window._gsChatLastRoomId;
            if (wantId && currentRoom && wantId !== currentRoom.id) {
                const target = rooms.find(r => r.id === wantId);
                if (target) { setCurrentRoom(target); }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [rooms, currentRoom]);
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

    // Sync rooms and allUsers to refs for use in subscription handlers
    useEffect(() => { roomsRef.current = rooms; }, [rooms]);
    useEffect(() => { allUsersRef.current = allUsers; }, [allUsers]);

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
                    const room = roomsRef.current.find(r => r.id === msg.room_id);
                    const sender = allUsersRef.current.find(u => u.id === msg.user_id);
                    const sName = sender ? _chatShortName(sender) : 'メンバー';
                    const rName = room?.name || 'チャット';
                    const body = msg.content || '';
                    showBrowserNotification('🔴 重要 / ' + sName + ' / ' + rName, body.substring(0, 120));
                }
                if (isViewing) return;
                setUnreadMap(prev => ({ ...prev, [msg.room_id]: (prev[msg.room_id] || 0) + 1 }));
                // Normal browser notification for non-important
                if (!msg.is_important) {
                    const room = roomsRef.current.find(r => r.id === msg.room_id);
                    const sender = allUsersRef.current.find(u => u.id === msg.user_id);
                    const sName = sender ? _chatShortName(sender) : 'メンバー';
                    const rName = room?.name || 'チャット';
                    const body = msg.type === 'expense' ? '経費報告を投稿しました' : (msg.content || 'ファイルを送信しました');
                    showBrowserNotification(sName + ' / ' + rName, body.substring(0, 100));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [currentRoomId, user?.id]);

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
            if (r.length > 0 && !currentRoom) { const lastId = window._gsChatLastRoomId; const restored = lastId ? r.find(rm => rm.id === lastId) : null; const allRoom = r.find(rm => rm.name === 'All'); setCurrentRoom(restored || allRoom || r[0]); if (_isMobile) setShowMobileRoomList(false); }
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
        if (data) {
            // Load reply counts for thread display
            const msgIds = data.map(m => m.id);
            if (msgIds.length > 0) {
                const { data: replies } = await supabase.from('chat_messages').select('parent_id').in('parent_id', msgIds);
                if (replies) {
                    const countMap = {};
                    replies.forEach(r => { countMap[r.parent_id] = (countMap[r.parent_id] || 0) + 1; });
                    const enriched = data.map(m => ({ ...m, _replyCount: countMap[m.id] || 0 }));
                    setMessages(enriched);
                    return;
                }
            }
            setMessages(data);
        }
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

    const MAX_CHAT_FILE = 20 * 1024 * 1024;
    const CHAT_BLOCKED_EXTS = new Set(['exe', 'bat', 'cmd', 'sh', 'msi', 'dll', 'scr', 'com', 'vbs', 'ps1']);
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentRoom) return;
        if (file.size > MAX_CHAT_FILE) { alert('ファイルサイズが20MBを超えています'); e.target.value = ''; return; }
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (CHAT_BLOCKED_EXTS.has(ext)) { alert('このファイル形式はアップロードできません'); e.target.value = ''; return; }
        setPendingFile(file);
        e.target.value = '';
    };

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

    const deleteMessage = async (msgId) => {
        try {
            await supabase.from('chat_messages').delete().eq('id', msgId).eq('user_id', user.id);
            if (currentRoom) loadMessages(currentRoom.id);
        } catch (e) { console.error('Delete message error:', e); }
        setDeleteConfirmMsg(null);
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
    const selectRoom = (room) => { setCurrentRoom(room); setUnreadMap(prev => { const n = { ...prev }; delete n[room.id]; return n; }); if(_isMobile) setShowMobileRoomList(false); };

    // Expense report submission
    const EXPENSE_METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'];
    const submitExpense = async (data) => {
        if (!currentRoom) return;
        setLoading(true);
        try {
            let receiptUrl = null;
            if (data.receiptFile) {
                const file = data.receiptFile;
                const ext = file.name.split('.').pop();
                const filePath = 'receipts/' + currentRoom.id + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
                const { error: upErr } = await supabase.storage.from('chat-files').upload(filePath, file);
                if (!upErr) {
                    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(filePath);
                    receiptUrl = urlData?.publicUrl || null;
                }
            }
            const expContent = JSON.stringify({ type: 'expense', vendor: data.vendor, product: data.product, method: data.method, amount: data.amount, ...(receiptUrl ? { receipt_url: receiptUrl, receipt_name: data.receiptFile.name } : {}) });
            await supabase.from('chat_messages').insert({
                room_id: currentRoom.id, user_id: user.id,
                content: expContent, type: 'expense', is_important: false
            });
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
        const parts = (room.name || '').split(/\s*↔\s*/);
        const other = parts.find(p => p !== myShortName);
        return other || parts[0] || 'DM';
    };

    // Filter sidebar rooms by search (exclude deal, expense, dm rooms), respect custom order
    const filteredGeneralRooms = useMemo(() => {
        const general = rooms.filter(r => !dealRoomMap[r.id] && r.type !== 'expense' && r.type !== 'dm');
        // Apply custom ordering
        if (roomOrder.length > 0) {
            const orderMap = {};
            roomOrder.forEach((id, i) => { orderMap[id] = i; });
            general.sort((a, b) => {
                const ia = orderMap[a.id] !== undefined ? orderMap[a.id] : 9999;
                const ib = orderMap[b.id] !== undefined ? orderMap[b.id] : 9999;
                return ia - ib;
            });
        }
        if (!sidebarSearch.trim()) return general;
        const q = sidebarSearch.toLowerCase();
        return general.filter(r => r.name.toLowerCase().includes(q));
    }, [rooms, dealRoomMap, sidebarSearch, roomOrder]);

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
        layout: { display: 'flex', height: _isMobile ? 'calc(100vh - 116px)' : '100%', overflow: 'hidden', background: t.bg, width: '100%', position: 'relative' },
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
        chatArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, width: _isMobile ? '100%' : 'auto' },
        chatHeader: { padding: compact ? '10px 14px' : '14px 20px', borderBottom: `1px solid ${t.border}`, background: t.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
        messages: { flex: 1, overflowY: 'auto', padding: compact ? '12px 14px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 },
        inputArea: { padding: compact ? '8px 10px' : '12px 20px', borderTop: `1px solid ${t.border}`, background: t.card, boxSizing: 'border-box' },
        inputRow: { display: 'flex', gap: 6, alignItems: 'center', width: '100%' },
        textInput: (imp) => ({
            flex: 1, padding: compact ? '8px 12px' : '10px 14px',
            border: `1.5px solid ${imp ? t.red : t.border}`, borderRadius: 10,
            fontFamily: 'inherit', fontSize: compact ? 13 : 14,
            background: imp ? '#fff5f5' : '#fff', outline: 'none',
            transition: 'border-color 0.15s',
        }),
        sendBtn: { padding: compact ? '8px 14px' : '10px 20px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: compact ? 12 : 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', flexShrink: 0, whiteSpace: 'nowrap' },
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
                    ...(msg.is_important ? {} : {})
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
                        React.createElement('span', { style: { display: 'inline-flex', color: '#92400e' } }, React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }, React.createElement('rect', { x: 2, y: 3, width: 12, height: 11, rx: 1.5 }), React.createElement('path', { d: 'M2 6h12M6 6v8M10 6v8', strokeWidth: 1.1 }))),
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
                    ),
                    exp.receipt_url && React.createElement('a', {
                        href: exp.receipt_url, target: '_blank', rel: 'noopener',
                        style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#fff', border: '1px solid #fcd34d', borderRadius: 6, textDecoration: 'none', color: t.primary, fontSize: 11, fontWeight: 500 }
                    },
                        exp.receipt_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                            ? React.createElement('img', { src: exp.receipt_url, style: { width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0 } })
                            : React.createElement('span', { style: { fontSize: 16 } }, '📄'),
                        React.createElement('span', null, exp.receipt_name || 'レシート')
                    )
                );
            })(),
            // File
            msg.type === 'file' && msg.file_data && React.createElement('a', {
                href: msg.file_data.url, target: '_blank', rel: 'noopener',
                style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: isOwn ? '#ebebeb' : '#f5f5f5', border: `1px solid ${t.border}`, cursor: 'pointer', textDecoration: 'none', color: 'inherit' }
            },
                React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none', stroke: t.sub, strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M14 7.5l-5.5 5.5a3.5 3.5 0 01-5-5L9 2.5a2.12 2.12 0 013 3L6.5 11a.71.71 0 01-1-1L11 4.5' })),
                React.createElement('div', null,
                    React.createElement('div', { style: { fontSize: 13, fontWeight: 600 } }, msg.file_data.name),
                    React.createElement('div', { style: { fontSize: 11, color: t.muted } }, _chatFormatBytes(msg.file_data.size))
                )
            ),
            // Completions
            msg.completions?.length > 0 && React.createElement('div', { style: { fontSize: 11, color: t.green, marginTop: 2 } }, '✓ ', msg.completions.map(c => _chatShortName(c.profiles)).join(', ')),
            // Thread reply count link
            msg._replyCount > 0 && React.createElement('div', {
                style: { fontSize: 11, color: t.accent, marginTop: 4, cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 0', borderBottom: '1px solid transparent' },
                onClick: (e) => { e.stopPropagation(); openThread(msg); },
                onMouseEnter: (e) => { e.currentTarget.style.borderBottomColor = t.accent; },
                onMouseLeave: (e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }
            }, React.createElement('svg', { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3z' })), msg._replyCount + '件の返信'),
            // Action row (shown on hover)
            isHovered && React.createElement('div', {
                style: {
                    position: 'absolute', top: -6, ...(isOwn ? { left: 0 } : { right: 0 }),
                    display: 'flex', gap: 2, background: '#fff', border: '1px solid ' + t.border,
                    borderRadius: 6, padding: '2px 3px', boxShadow: '0 2px 8px rgba(0,0,0,.08)', zIndex: 10
                }
            },
                // Reply (thread)
                threadEnabled && React.createElement('button', {
                    onClick: (e) => { e.stopPropagation(); openThread(msg); },
                    style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4, color: t.muted, fontFamily: 'inherit', fontWeight: 600 },
                    onMouseEnter: (e) => { e.currentTarget.style.background = '#f3f3f3'; },
                    onMouseLeave: (e) => { e.currentTarget.style.background = 'none'; },
                    title: '返信'
                }, '返信'),
                // Delete own message
                isOwn && React.createElement('button', {
                    onClick: (e) => { e.stopPropagation(); setDeleteConfirmMsg(msg); },
                    style: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4, color: t.muted, fontFamily: 'inherit', fontWeight: 600 },
                    onMouseEnter: (e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = t.red; },
                    onMouseLeave: (e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = t.muted; },
                    title: '取り消す'
                }, '取消')
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
            // ── Sidebar (hidden on mobile if showing chat) ──
            (!showMobileRoomList && _isMobile) ? null : React.createElement('div', { style: { ...S.sidebar, ...(_isMobile && { width: '100%', minWidth: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2, background: t.card }) } },
                React.createElement('div', { style: { ...S.sideHeader, flexDirection: 'column', gap: 6, alignItems: 'stretch' } },
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                        React.createElement('span', { style: { fontSize: compact ? 13 : 15, fontWeight: 700, color: t.primary } }, 'チャット'),
                        React.createElement('button', {
                            style: { ...S.iconBtn, width: 26, height: 26, fontSize: 14, borderRadius: 6 },
                            onClick: () => {
                                setShowCreateModal(true);
                            },
                            onMouseEnter: (e) => { e.currentTarget.style.background = '#f3f3f3'; },
                            onMouseLeave: (e) => { e.currentTarget.style.background = '#fff'; }
                        }, '+')
                    ),
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
                    // === グループ section ===
                    React.createElement('div', {
                        style: { padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
                        onClick: () => setCollapsedCategories(prev => ({ ...prev, _groups: !prev._groups }))
                    },
                        React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                            React.createElement('span', { style: { fontSize: 7, transition: 'transform 0.15s', transform: collapsedCategories._groups ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
                            'グループ'
                        ),
                        (() => {
                            const groupUnread = Object.entries(unreadMap).filter(([rid]) => filteredGeneralRooms.some(r => r.id === rid)).reduce((s, [, c]) => s + c, 0);
                            return groupUnread > 0 ? React.createElement('span', { style: { background: t.red, color: '#fff', borderRadius: 8, padding: '0 4px', fontSize: 8, fontWeight: 700, minWidth: 14, textAlign: 'center', lineHeight: '14px' } }, groupUnread) : null;
                        })()
                    ),
                    !collapsedCategories._groups && React.createElement('div', null,
                        filteredGeneralRooms.map((room, idx) =>
                            React.createElement('div', {
                                key: room.id,
                                draggable: !sidebarSearch.trim(),
                                onDragStart: (e) => { setDragRoomId(room.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', room.id); },
                                onDragEnd: () => { setDragRoomId(null); setDragOverRoomId(null); },
                                onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverRoomId !== room.id) setDragOverRoomId(room.id); },
                                onDragLeave: () => { if (dragOverRoomId === room.id) setDragOverRoomId(null); },
                                onDrop: (e) => {
                                    e.preventDefault();
                                    const fromId = dragRoomId;
                                    const toId = room.id;
                                    if (fromId && fromId !== toId) {
                                        const ids = filteredGeneralRooms.map(r => r.id);
                                        const fromIdx = ids.indexOf(fromId);
                                        const toIdx = ids.indexOf(toId);
                                        if (fromIdx !== -1 && toIdx !== -1) {
                                            const newIds = [...ids];
                                            newIds.splice(fromIdx, 1);
                                            newIds.splice(toIdx, 0, fromId);
                                            saveRoomOrder(newIds);
                                        }
                                    }
                                    setDragRoomId(null); setDragOverRoomId(null);
                                },
                                style: { ...S.roomItem(currentRoom?.id === room.id), ...(dragRoomId === room.id ? { opacity: 0.4 } : {}), ...(dragOverRoomId === room.id && dragRoomId !== room.id ? { borderTop: '2px solid ' + t.primary } : {}), cursor: sidebarSearch.trim() ? 'pointer' : 'grab' },
                                onClick: () => selectRoom(room),
                                onContextMenu: (e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, room }); },
                                onMouseEnter: (e) => { if (currentRoom?.id !== room.id && !dragRoomId) e.currentTarget.style.background = t.bg; },
                                onMouseLeave: (e) => { if (currentRoom?.id !== room.id && !dragRoomId) e.currentTarget.style.background = 'transparent'; }
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
                    // === 商談 section ===
                    (() => {
                        if (dealRoomsByCategory.all.length === 0) return null;
                        const toggleCat = (catId) => setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
                        const dealUnread = Object.entries(unreadMap).filter(([rid]) => !!dealRoomMap[rid]).reduce((s, [, c]) => s + c, 0);
                        return React.createElement('div', { style: { marginTop: 4, borderTop: '1px solid ' + t.border, paddingTop: 4 } },
                            React.createElement('div', {
                                style: { padding: '6px 8px 3px', fontSize: 10, fontWeight: 700, color: t.muted, letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' },
                                onClick: () => setCollapsedCategories(prev => ({ ...prev, _deals: !prev._deals }))
                            },
                                React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
                                    React.createElement('span', { style: { fontSize: 7, transition: 'transform 0.15s', transform: collapsedCategories._deals ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
                                    '商談'
                                ),
                                dealUnread > 0 ? React.createElement('span', { style: { background: t.red, color: '#fff', borderRadius: 8, padding: '0 4px', fontSize: 8, fontWeight: 700, minWidth: 14, textAlign: 'center', lineHeight: '14px' } }, dealUnread) : null
                            ),
                            !collapsedCategories._deals && React.createElement('div', null,
                            filteredDealGroups.map(group =>
                                React.createElement('div', { key: group.id, style: { marginTop: 2 } },
                                    React.createElement('div', {
                                        style: { padding: '3px 8px', fontSize: 10, fontWeight: 600, color: t.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' },
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
                        )
                        );
                    })(),
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
                            _isMobile && React.createElement('button', {
                                style: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 8px', color: t.primary },
                                onClick: () => setShowMobileRoomList(true),
                                title: 'ルーム一覧'
                            }, '←'),
                            (!_isMobile && editingRoomName) ?
                                React.createElement('form', {
                                    onSubmit: (e) => { e.preventDefault(); saveRoomName(); },
                                    style: { display: 'inline-flex', alignItems: 'center', gap: 4 }
                                },
                                    React.createElement('input', {
                                        value: editRoomNameVal,
                                        onChange: (e) => setEditRoomNameVal(e.target.value),
                                        autoFocus: true,
                                        onBlur: () => saveRoomName(),
                                        onKeyDown: (e) => { if (e.key === 'Escape') setEditingRoomName(false); },
                                        style: { fontSize: compact ? 14 : 16, fontWeight: 700, color: t.primary, border: '1px solid ' + t.accent, borderRadius: 4, padding: '2px 6px', outline: 'none', fontFamily: 'inherit', width: 180 }
                                    })
                                ) :
                                React.createElement('span', {
                                    style: { fontSize: compact ? 14 : 16, fontWeight: 700, color: t.primary, cursor: _isMobile ? 'default' : 'pointer' },
                                    onDoubleClick: () => { if (!_isMobile && currentRoom.type !== 'dm') { setEditRoomNameVal(currentRoom.name); setEditingRoomName(true); } },
                                    title: _isMobile ? '' : 'ダブルクリックで名前変更'
                                }, currentRoom.type === 'dm' ? dmDisplayName(currentRoom) : currentRoom.name),
                            (() => {
                                const deal = dealRoomMap[currentRoom.id];
                                if (!deal) return null;
                                return stageBadge(deal.stage);
                            })(),
                            currentRoom.description && React.createElement('span', { style: { fontSize: 11, color: t.muted } }, currentRoom.description)
                        ),
                        React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },

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
                            }, React.createElement('svg', { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M14 7.5l-5.5 5.5a3.5 3.5 0 01-5-5L9 2.5a2.12 2.12 0 013 3L6.5 11a.71.71 0 01-1-1L11 4.5' }))),
                            React.createElement('textarea', {
                                value: msgInput, onChange: e => setMsgInput(e.target.value),
                                placeholder: 'メッセージ...（Shift+Enterで改行）',
                                disabled: loading,
                                rows: 1,
                                style: { ...S.textInput(isImportant), resize: 'none', minHeight: 34, maxHeight: 100, overflowY: 'auto', lineHeight: '1.4', fontFamily: 'inherit' },
                                onFocus: (e) => { e.currentTarget.style.borderColor = isImportant ? t.red : t.accent; },
                                onBlur: (e) => { e.currentTarget.style.borderColor = isImportant ? t.red : t.border; },
                                onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } },
                                onInput: (e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }
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
                        React.createElement('div', { style: { marginBottom: 8, color: t.muted } }, React.createElement('svg', { width: 28, height: 28, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }, React.createElement('path', { d: 'M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3z' }))),
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
            

            // Expense Form Modal
            

            

            // Thread Panel (slide-over)
            threadParent && React.createElement('div', {
                style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', justifyContent: 'flex-end', zIndex: 200 },
                onClick: () => setThreadParent(null)
            },
                React.createElement('div', {
                    style: { width: _isMobile ? '100%' : 380, height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 20px rgba(0,0,0,.08)' },
                    onClick: (e) => e.stopPropagation()
                },
                    // Thread header
                    React.createElement('div', { style: { padding: '12px 16px', borderBottom: '1px solid ' + t.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
                        React.createElement('span', { style: { fontSize: 14, fontWeight: 700, color: t.primary } }, 'スレッド'),
                        React.createElement('button', {
                            style: { background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: t.muted, padding: '4px 8px' },
                            onClick: () => setThreadParent(null)
                        }, '✕')
                    ),
                    // Parent message
                    React.createElement('div', { style: { padding: '12px 16px', borderBottom: '1px solid ' + t.borderLight, background: '#fafafa' } },
                        React.createElement('div', { style: { fontSize: 11, color: t.muted, fontWeight: 600, marginBottom: 4 } }, senderShortName(threadParent)),
                        React.createElement('div', { style: { fontSize: 13, color: t.primary, lineHeight: 1.6, wordWrap: 'break-word' } },
                            threadParent.type === 'expense' ? '経費報告' : (threadParent.content || '')
                        ),
                        React.createElement('div', { style: { fontSize: 10, color: t.muted, marginTop: 4 } }, _chatFormatDate(threadParent.created_at) + ' ' + _chatFormatTime(threadParent.created_at))
                    ),
                    // Thread replies
                    React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 16px' } },
                        threadMessages.length === 0 && React.createElement('div', { style: { padding: '20px 0', textAlign: 'center', color: t.muted, fontSize: 12 } }, 'まだ返信はありません'),
                        threadMessages.map(reply => {
                            const rIsOwn = reply.user_id === user.id;
                            const rName = senderShortName(reply);
                            return React.createElement('div', { key: reply.id, style: { padding: '6px 0', display: 'flex', gap: 8, alignItems: 'flex-start' } },
                                React.createElement('div', {
                                    style: { width: 26, height: 26, borderRadius: '50%', background: rIsOwn ? '#c8c8c8' : '#e0e0e0', color: rIsOwn ? '#fff' : t.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }
                                }, _chatInitial(rName)),
                                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                                    React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6 } },
                                        React.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: t.primary } }, rName),
                                        React.createElement('span', { style: { fontSize: 10, color: t.muted } }, _chatFormatTime(reply.created_at))
                                    ),
                                    React.createElement('div', { style: { fontSize: 13, color: t.primary, lineHeight: 1.6, marginTop: 2, wordWrap: 'break-word' } }, reply.content)
                                )
                            );
                        }),
                        React.createElement('div', { ref: threadEndRef })
                    ),
                    // Thread input
                    React.createElement('div', { style: { padding: '10px 16px', borderTop: '1px solid ' + t.border, display: 'flex', gap: 6 } },
                        React.createElement('input', {
                            type: 'text', value: threadInput, onChange: e => setThreadInput(e.target.value),
                            placeholder: '返信を入力...',
                            style: { flex: 1, padding: '8px 12px', border: '1.5px solid ' + t.border, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' },
                            onKeyDown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendThreadReply(); } }
                        }),
                        React.createElement('button', {
                            onClick: sendThreadReply,
                            disabled: !threadInput.trim() || loading,
                            style: { padding: '8px 16px', background: t.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !threadInput.trim() || loading ? 0.4 : 1 }
                        }, '送信')
                    )
                )
            ),

            // Delete message confirmation
            deleteConfirmMsg && React.createElement('div', {
                style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 },
                onClick: () => setDeleteConfirmMsg(null)
            },
                React.createElement('div', {
                    style: { background: '#fff', borderRadius: 12, padding: '22px 26px', maxWidth: 360, boxShadow: '0 12px 40px rgba(0,0,0,.15)' },
                    onClick: (e) => e.stopPropagation()
                },
                    React.createElement('div', { style: { fontSize: 15, fontWeight: 700, color: t.primary, marginBottom: 8 } }, 'メッセージを取り消す'),
                    React.createElement('div', { style: { fontSize: 13, color: t.sub, marginBottom: 6, lineHeight: 1.6 } },
                        'このメッセージを取り消しますか？'),
                    React.createElement('div', { style: { padding: '8px 12px', background: '#f9f9f9', borderRadius: 6, fontSize: 12, color: t.sub, marginBottom: 16, maxHeight: 60, overflow: 'hidden', lineHeight: 1.5 } },
                        deleteConfirmMsg.type === 'expense' ? '経費報告' : (deleteConfirmMsg.content || '').substring(0, 100)),
                    React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                        React.createElement('button', {
                            style: { padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f3f3f3', color: '#666', fontFamily: 'inherit' },
                            onClick: () => setDeleteConfirmMsg(null)
                        }, 'キャンセル'),
                        React.createElement('button', {
                            style: { padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: t.red, color: '#fff', fontFamily: 'inherit' },
                            onClick: () => deleteMessage(deleteConfirmMsg.id)
                        }, '取り消す')
                    )
                )
            )
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
window.GSChat.ExpenseFormModal = function ExpenseFormModal({ theme, onClose, onSubmit, loading, supabase }) {
    const { useState, useRef } = React;
    const t = theme || CT;
    const _isMob = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const METHODS = ['Amex', 'マネフォ', 'JCB', '現金', '現金建て替え', 'その他'];
    const [vendor, setVendor] = useState('');
    const [product, setProduct] = useState('');
    const [method, setMethod] = useState('Amex');
    const [customMethod, setCustomMethod] = useState('');
    const [amount, setAmount] = useState('');
    const [amountDisplay, setAmountDisplay] = useState('');
    const [receipt, setReceipt] = useState(null);
    const [receiptPreview, setReceiptPreview] = useState(null);
    const [dragOverReceipt, setDragOverReceipt] = useState(false);
    const receiptRef = useRef(null);
    const [err, setErr] = useState('');

    const formatAmount = (val) => {
        const num = val.replace(/[^0-9]/g, '');
        setAmount(num);
        setAmountDisplay(num ? Number(num).toLocaleString() : '');
    };

    const handleReceipt = (file) => {
        if (!file) return;
        if (file.size > MAX_CHAT_FILE) { alert('ファイルサイズが20MBを超えています'); return; }
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (CHAT_BLOCKED_EXTS.has(ext)) { alert('このファイル形式はアップロードできません'); return; }
        setReceipt(file);
        if (file.type?.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => setReceiptPreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setReceiptPreview(null);
        }
    };

    const handleSubmit = () => {
        if (!vendor.trim()) { setErr('購入先を入力してください'); return; }
        if (!product.trim()) { setErr('商品を入力してください'); return; }
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setErr('金額を正しく入力してください'); return; }
        const finalMethod = method === 'その他' ? (customMethod.trim() || 'その他') : method;
        setErr('');
        onSubmit({ vendor: vendor.trim(), product: product.trim(), method: finalMethod, amount: Number(amount), receiptFile: receipt || null });
    };

    const I = { width: '100%', padding: _isMob ? '10px 12px' : '8px 12px', border: '1.5px solid ' + t.border, borderRadius: 8, fontFamily: 'inherit', fontSize: _isMob ? 16 : 13, background: '#fff', outline: 'none' };
    const L = { display: 'block', fontSize: 11, fontWeight: 600, color: t.sub, marginBottom: 4 };

    return React.createElement('div', {
        style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: _isMob ? 'flex-end' : 'center', justifyContent: 'center', zIndex: 300 },
        onMouseDown: e => { if (e.target === e.currentTarget) onClose(); }
    },
        React.createElement('div', { style: { background: '#fff', borderRadius: _isMob ? '16px 16px 0 0' : 12, padding: _isMob ? '20px 20px 28px' : '22px 26px', width: _isMob ? '100%' : '90%', maxWidth: _isMob ? 'none' : 380, maxHeight: _isMob ? '90vh' : 'none', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.12)' } },
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 } }, React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }, React.createElement('rect', { x: 2, y: 3, width: 12, height: 11, rx: 1.5 }), React.createElement('path', { d: 'M2 6h12M6 6v8M10 6v8', strokeWidth: 1.1 })), ' 経費報告'),
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
                // Receipt upload area
                React.createElement('div', null,
                    React.createElement('label', { style: L }, 'レシート添付（任意）'),
                    React.createElement('input', { type: 'file', ref: receiptRef, accept: 'image/*,.pdf', capture: _isMob ? 'environment' : undefined, style: { display: 'none' }, onChange: (e) => { const f = e.target.files?.[0]; if (f) handleReceipt(f); e.target.value = ''; } }),
                    !receipt ? React.createElement('div', {
                        style: { border: '2px dashed ' + (dragOverReceipt ? '#f59e0b' : t.border), borderRadius: 8, padding: _isMob ? '16px 12px' : '12px', textAlign: 'center', cursor: 'pointer', background: dragOverReceipt ? '#fffbeb' : '#fafafa', transition: 'all 0.15s' },
                        onClick: () => receiptRef.current?.click(),
                        onDragOver: (e) => { e.preventDefault(); setDragOverReceipt(true); },
                        onDragLeave: () => setDragOverReceipt(false),
                        onDrop: (e) => { e.preventDefault(); setDragOverReceipt(false); const f = e.dataTransfer.files?.[0]; if (f) handleReceipt(f); }
                    },
                        React.createElement('div', { style: { fontSize: _isMob ? 13 : 11, color: t.muted, fontWeight: 500 } },
                            _isMob ? '📷 タップして撮影 or 選択' : '📎 クリック or ドラッグ&ドロップ')
                    ) : React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 } },
                        receiptPreview ? React.createElement('img', { src: receiptPreview, style: { width: 40, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 } }) : React.createElement('span', { style: { fontSize: 20 } }, '📄'),
                        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                            React.createElement('div', { style: { fontSize: 11, fontWeight: 600, color: t.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, receipt.name),
                            React.createElement('div', { style: { fontSize: 10, color: t.muted } }, (receipt.size / 1024).toFixed(0) + ' KB')
                        ),
                        React.createElement('button', { type: 'button', onClick: () => { setReceipt(null); setReceiptPreview(null); }, style: { background: 'none', border: 'none', cursor: 'pointer', color: t.muted, fontSize: 14, padding: '0 4px' } }, '×')
                    )
                ),
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
                            type: 'button',
                            style: {
                                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                border: method === m ? '1.5px solid #f59e0b' : '1px solid ' + t.border,
                                background: method === m ? '#fffbeb' : '#fff',
                                color: method === m ? '#92400e' : t.sub,
                                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s'
                            }
                        }, m))
                    ),
                    method === 'その他' && React.createElement('input', {
                        value: customMethod, onChange: e => setCustomMethod(e.target.value),
                        placeholder: '支払方法を入力...', style: { ...I, marginTop: 6 }
                    })
                ),
                React.createElement('div', null,
                    React.createElement('label', { style: L }, '金額 (円) *'),
                    React.createElement('input', {
                        value: amountDisplay, onChange: e => formatAmount(e.target.value),
                        placeholder: '1,000', style: { ...I, fontSize: 16, fontWeight: 700 },
                        inputMode: 'numeric'
                    })
                )
            ),
            err && React.createElement('div', { style: { fontSize: 11, color: t.red, marginTop: 8 } }, err),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 16 } },
                React.createElement('button', {
                    onClick: onClose,
                    style: { flex: 1, padding: _isMob ? '12px' : '9px', border: 'none', borderRadius: 8, fontSize: _isMob ? 15 : 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#f3f3f3', color: t.sub }
                }, 'キャンセル'),
                React.createElement('button', {
                    onClick: handleSubmit, disabled: loading,
                    style: { flex: 1, padding: _isMob ? '12px' : '9px', border: 'none', borderRadius: 8, fontSize: _isMob ? 15 : 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', background: '#f59e0b', color: '#fff', opacity: loading ? 0.5 : 1 }
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
            React.createElement('div', { style: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: t.primary, display: 'flex', alignItems: 'center', gap: 8 } }, React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }, React.createElement('rect', { x: 2, y: 3, width: 12, height: 11, rx: 1.5 }), React.createElement('path', { d: 'M2 6h12M6 6v8M10 6v8', strokeWidth: 1.1 })), '経費報告グループ作成'),
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
