// ============================================
// GS Sales CRM - Dashboard Component v3
// ライトテーマ（index版準拠）
// ============================================

import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, Lead, AppUser } from '@/types/database';
import { STAGES, REV_STAGES, FY_TARGET, fmtYen, countryToFlag, shortName, initial, T } from '@/lib/constants';
import { useToast } from '@/components/shared/ToastProvider';

interface DashboardProps {
  deals: Deal[];
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
}

interface UnreportedEntry {
  user: AppUser | undefined;
  deals: Deal[];
}

interface HitokotoParsed {
  text: string;
  updated_at: string | null;
}

interface HitokotoEntry {
  uid: string;
  name: string;
  initial: string;
  msg: string;
}

interface ActivityRow {
  id: string;
  type: string;
  content: string | null;
  user_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  created_at: string;
  deleted_at: string | null;
  is_todo: boolean | null;
}

export const Dashboard = memo(function Dashboard({
  deals, accounts, contacts: _contacts, leads: _leads, allUsers, client, user,
}: DashboardProps) {
  void _contacts; void _leads;
  const toast = useToast();
  const [unreported, setUnreported] = useState<UnreportedEntry[]>([]);
  const [animPct, setAnimPct] = useState(0);

  // ── アクティビティフィード ──
  const [recentActivities, setRecentActivities] = useState<ActivityRow[]>([]);
  useEffect(() => {
    if (!client) return;
    (async () => {
      const { data } = await client
        .from('sales_activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setRecentActivities((data as ActivityRow[]).filter(a => !a.deleted_at && !a.is_todo));
    })();
  }, [client, deals]);

  // ── ひとこと（Hitokoto）システム ──
  // company_settings の hitokoto_<uid> キーで個別保存（JSON: {text, updated_at}）
  // 毎朝6時(JST)にリセット
  const [companySettings, setCompanySettings] = useState<Record<string, string | null>>({});
  const [hitokotoEdit, setHitokotoEdit] = useState(false);
  const [hitokotoDraft, setHitokotoDraft] = useState('');
  const [hitokotoSaving, setHitokotoSaving] = useState(false);
  const _hitokotoResetDone = useRef(false);
  const _hitokotoLoaded = useRef(false);

  const _today6am = useMemo(() => {
    const n = new Date();
    const jstOff = 9 * 60 * 60 * 1000;
    const jstNow = new Date(n.getTime() + jstOff);
    const jst6am = new Date(
      Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate(), 6, 0, 0) - jstOff,
    );
    if (n < jst6am) jst6am.setTime(jst6am.getTime() - 86400000);
    return jst6am;
  }, []);

  const _parseHitokoto = useCallback((v: string | null | undefined): HitokotoParsed | null => {
    if (!v) return null;
    try {
      const j = JSON.parse(v);
      if (j && j.text) return j as HitokotoParsed;
    } catch { /* ignore */ }
    return { text: String(v), updated_at: null };
  }, []);

  // Load hitokoto entries from company_settings
  useEffect(() => {
    if (!client || _hitokotoLoaded.current) return;
    _hitokotoLoaded.current = true;
    (async () => {
      const { data } = await client
        .from('company_settings')
        .select('key, value')
        .like('key', 'hitokoto_%');
      if (data) {
        const map: Record<string, string | null> = {};
        (data as { key: string; value: string | null }[]).forEach(r => { map[r.key] = r.value; });
        setCompanySettings(map);
      }
    })();
  }, [client]);

  // Auto-archive & reset stale hitokoto on mount
  useEffect(() => {
    if (!client || Object.keys(companySettings).length === 0 || _hitokotoResetDone.current) return;
    _hitokotoResetDone.current = true;
    (async () => {
      const keys = Object.entries(companySettings).filter(([k, v]) => k.startsWith('hitokoto_') && v);
      for (const [k, v] of keys) {
        const parsed = _parseHitokoto(v);
        if (!parsed || !parsed.text) continue;
        const updAt = parsed.updated_at ? new Date(parsed.updated_at) : null;
        if (!updAt || updAt < _today6am) {
          const uid = k.replace('hitokoto_', '');
          try {
            await client.from('hitokoto_history').insert({
              user_id: uid,
              message: parsed.text,
              posted_at: parsed.updated_at || new Date().toISOString(),
            });
          } catch (e) { console.warn('hitokoto archive:', e); }
          try {
            const { data: existing } = await client.from('company_settings').select('id').eq('key', k).limit(1);
            if (existing && existing.length > 0) {
              await client.from('company_settings').update({ value: null, updated_at: new Date().toISOString() }).eq('id', (existing[0] as { id: string }).id);
            }
          } catch (e) { console.warn('hitokoto reset:', e); }
          setCompanySettings(prev => { const next = { ...prev }; delete next[k]; return next; });
        }
      }
    })();
  }, [client, companySettings, _parseHitokoto, _today6am]);

  const hitokotoEntries = useMemo<HitokotoEntry[]>(() => {
    return Object.entries(companySettings)
      .filter(([k, v]) => k.startsWith('hitokoto_') && v)
      .map(([k, v]) => {
        const uid = k.replace('hitokoto_', '');
        const u = allUsers.find(x => x.id === uid);
        const parsed = _parseHitokoto(v);
        const name = shortName(u);
        return { uid, name, initial: (name || '?')[0].toUpperCase(), msg: parsed?.text || '' };
      })
      .filter(e => e.msg);
  }, [companySettings, allUsers, _parseHitokoto]);

  const myHitokoto = useMemo(() => {
    const p = _parseHitokoto(companySettings?.['hitokoto_' + user?.id]);
    return p?.text || '';
  }, [companySettings, user?.id, _parseHitokoto]);

  const saveHitokoto = useCallback(async () => {
    if (!client || !user?.id) return;
    setHitokotoSaving(true);
    try {
      const val = hitokotoDraft.trim();
      const myKey = 'hitokoto_' + user.id;
      const jsonVal = val ? JSON.stringify({ text: val, updated_at: new Date().toISOString() }) : null;
      // Archive old hitokoto before overwriting
      const oldParsed = _parseHitokoto(companySettings?.[myKey]);
      if (oldParsed && oldParsed.text) {
        try {
          await client.from('hitokoto_history').insert({
            user_id: user.id,
            message: oldParsed.text,
            posted_at: oldParsed.updated_at || new Date().toISOString(),
          });
        } catch (e) { console.warn('hitokoto archive:', e); }
      }
      // Check if row exists
      const { data: existing } = await client.from('company_settings').select('id').eq('key', myKey).limit(1);
      if (existing && existing.length > 0) {
        if (jsonVal) {
          await client.from('company_settings').update({ value: jsonVal }).eq('id', (existing[0] as { id: string }).id);
        } else {
          await client.from('company_settings').update({ value: null, updated_at: new Date().toISOString() }).eq('id', (existing[0] as { id: string }).id);
        }
      } else if (jsonVal) {
        await client.from('company_settings').insert({ key: myKey, value: jsonVal });
      }
      // Update local state
      setCompanySettings(prev => {
        const next = { ...prev };
        if (jsonVal) next[myKey] = jsonVal; else delete next[myKey];
        return next;
      });
      toast('ひとことを保存しました');
    } catch (e) {
      console.error('saveHitokoto error:', e);
      toast('保存に失敗しました', 'error');
    }
    setHitokotoEdit(false);
    setHitokotoSaving(false);
  }, [client, user?.id, hitokotoDraft, companySettings, _parseHitokoto, toast]);

  const now = useMemo(() => new Date(), []);
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, '0')}`;

  const getRevMonth = (deal: Deal): string | null => {
    const d = deal.payment_confirmed_date;
    return d ? d.substring(0, 7) : null;
  };

  const revDeals = useMemo(
    () => deals.filter(d => REV_STAGES.includes(d.stage) && d.payment_confirmed_date),
    [deals],
  );

  const thisRev = useMemo(
    () => revDeals.filter(d => getRevMonth(d) === thisMonth).reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [revDeals, thisMonth],
  );
  const lastRev = useMemo(
    () => revDeals.filter(d => getRevMonth(d) === lastMonth).reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [revDeals, lastMonth],
  );
  const changePct = lastRev > 0 ? Math.round((thisRev - lastRev) / lastRev * 100) : 0;

  const thisDay = now.getDate();
  const sameDayLastRev = revDeals.filter(d => {
    const mk = getRevMonth(d); if (mk !== lastMonth) return false;
    const day = parseInt((d.payment_confirmed_date || '').substring(8, 10));
    return day <= thisDay;
  }).reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const sameDayPct = sameDayLastRev > 0 ? Math.round((thisRev - sameDayLastRev) / sameDayLastRev * 100) : 0;

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const bizDaysLeft = useMemo(() => {
    let count = 0;
    for (let d = now.getDate() + 1; d <= daysInMonth; d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      const dow = dt.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  }, [now, daysInMonth]);

  // 決算年度 (Feb - Jan)
  const fyStartYear = now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1;
  const fyMonths = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 12; i++) {
      const md = new Date(fyStartYear, 1 + i, 1);
      arr.push(`${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, [fyStartYear]);

  const fyRev = useMemo(
    () => revDeals.filter(d => { const mk = getRevMonth(d); return mk && fyMonths.includes(mk); }).reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [revDeals, fyMonths],
  );
  const fyPct = Math.min(100, fyRev / FY_TARGET * 100);
  const fyMonthlyRevs = useMemo(
    () => fyMonths.map(mk => ({ key: mk, label: mk.split('-')[1] + '月', rev: revDeals.filter(d => getRevMonth(d) === mk).reduce((s, d) => s + (Number(d.amount) || 0), 0) })),
    [fyMonths, revDeals],
  );
  const fyRemaining = FY_TARGET - fyRev;
  const fyMonthsLeft = fyMonths.filter(m => m > thisMonth).length;
  const fyMonthlyNeeded = fyMonthsLeft > 0 ? Math.round(fyRemaining / fyMonthsLeft) : 0;

  // JBW帰属
  const jbwAcctIds = useMemo(
    () => new Set(accounts.filter(a => a.attributed_to === 'JBW').map(a => a.id)),
    [accounts],
  );

  // ── メンバー別今月売上 ──
  const { monthlyEntries, maxMonthly } = useMemo(() => {
    const ownerRev: Record<string, number> = {};
    let jbwMonth = 0;
    allUsers.filter(u => shortName(u) !== 'Joseph' && shortName(u) !== '-').forEach(u => { ownerRev[u.id] = 0; });
    revDeals.filter(d => getRevMonth(d) === thisMonth).forEach(d => {
      if (jbwAcctIds.has(d.account_id || '')) { jbwMonth += (Number(d.amount) || 0); }
      else { const o = d.owner_id || '?'; ownerRev[o] = (ownerRev[o] || 0) + (Number(d.amount) || 0); }
    });
    const entries: [string, number][] = [
      ...Object.entries(ownerRev).filter(([oid]) => {
        const u = allUsers.find(x => x.id === oid);
        return u && shortName(u) !== 'Joseph' && shortName(u) !== '-';
      }),
      ['__JBW__', jbwMonth],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)) as [string, number][];
    const mx = Math.max(...entries.map(e => e[1]), 1);
    return { monthlyEntries: entries, maxMonthly: mx };
  }, [allUsers, revDeals, thisMonth, jbwAcctIds]);

  // ── メンバー別今期売上 ──
  const { fyEntries, maxFyEntry } = useMemo(() => {
    const ownerRev: Record<string, number> = {};
    let jbwFy = 0;
    allUsers.filter(u => shortName(u) !== 'Joseph' && shortName(u) !== '-').forEach(u => { ownerRev[u.id] = 0; });
    revDeals.filter(d => { const mk = getRevMonth(d); return mk && fyMonths.includes(mk); }).forEach(d => {
      if (jbwAcctIds.has(d.account_id || '')) { jbwFy += (Number(d.amount) || 0); }
      else { const o = d.owner_id || '?'; ownerRev[o] = (ownerRev[o] || 0) + (Number(d.amount) || 0); }
    });
    const entries: [string, number][] = [
      ...Object.entries(ownerRev).filter(([oid]) => {
        const u = allUsers.find(x => x.id === oid);
        return u && shortName(u) !== 'Joseph' && shortName(u) !== '-';
      }),
      ['__JBW__', jbwFy],
    ].sort((a, b) => (b[1] as number) - (a[1] as number)) as [string, number][];
    const mx = Math.max(...entries.map(e => e[1]), 1);
    return { fyEntries: entries, maxFyEntry: mx };
  }, [allUsers, revDeals, fyMonths, jbwAcctIds]);

  // ── 直近の成約 ──
  const recentWins = useMemo(
    () => revDeals.filter(d => d.payment_confirmed_date).sort((a, b) => (b.payment_confirmed_date || '').localeCompare(a.payment_confirmed_date || '')).slice(0, 8),
    [revDeals],
  );

  // ── 成約間近の案件（請求書送付済 = invoice_sent）──
  const hotDeals = useMemo(
    () => deals.filter(d => d.stage === 'invoice_sent').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 10),
    [deals],
  );

  // ── 取引先入力充実度 ──
  const REQUIRED_FIELDS = ['name', 'country', 'website', 'address_billing', 'payment_terms', 'lead_source', 'owner_id'] as const;
  const acctCompleteness = useMemo(() => {
    const byOwner: Record<string, { filled: number; total: number }> = {};
    allUsers.filter(u => shortName(u) !== 'Joseph' && shortName(u) !== '-').forEach(u => { byOwner[u.id] = { filled: 0, total: 0 }; });
    accounts.forEach(a => {
      const oid = a.owner_id || '';
      if (!byOwner[oid]) return;
      REQUIRED_FIELDS.forEach(f => {
        byOwner[oid].total++;
        const val = a[f as keyof Account];
        if (val !== null && val !== undefined && val !== '') byOwner[oid].filled++;
      });
    });
    return Object.entries(byOwner)
      .map(([oid, stats]) => ({
        oid,
        user: allUsers.find(u => u.id === oid),
        pct: stats.total > 0 ? Math.round(stats.filled / stats.total * 100) : 0,
        count: accounts.filter(a => a.owner_id === oid).length,
      }))
      .filter(e => e.count > 0)
      .sort((a, b) => b.pct - a.pct);
  }, [accounts, allUsers]);

  // ── マイルストーン ──
  const milestones = [
    { v: 100000000, l: '1億' }, { v: 300000000, l: '3億' },
    { v: 500000000, l: '5億' }, { v: 700000000, l: '7億' },
    { v: 1000000000, l: '10億' },
  ];

  // ── 未提出レポート ──
  useEffect(() => {
    if (!client) return;
    (async () => {
      const n = new Date();
      const day = n.getDay();
      const diff = n.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(n.getFullYear(), n.getMonth(), diff);
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString();
      const activeDeals = deals.filter(d => d.stage !== 'closed' && d.owner_id);
      const { data: reports } = await client.from('sales_activities').select('deal_id,user_id').eq('type', 'weekly_report').gte('created_at', weekStart);
      const reportedSet = new Set((reports || []).map((r: { deal_id: string }) => r.deal_id));
      const missing = activeDeals.filter(d => !reportedSet.has(d.id));
      const byOwner: Record<string, UnreportedEntry> = {};
      missing.forEach(d => {
        if (!d.owner_id) return;
        if (!byOwner[d.owner_id]) byOwner[d.owner_id] = { user: allUsers.find(u => u.id === d.owner_id), deals: [] };
        byOwner[d.owner_id].deals.push(d);
      });
      setUnreported(Object.values(byOwner).sort((a, b) => b.deals.length - a.deals.length));
    })();
  }, [deals, client, allUsers]);

  // Animate on mount
  useEffect(() => { const t = setTimeout(() => setAnimPct(100), 50); return () => clearTimeout(t); }, []);

  const hour = now.getHours();
  const greet = hour < 12 ? 'おはようございます' : 'お疲れさまです';
  const userName = shortName(allUsers.find(u => u.id === user?.id));

  // カラー定数（ライトテーマ）
  const green = T.green || '#22c55e';
  const red = T.red || '#ef4444';
  const orange = T.orange || '#f59e0b';
  const accent = T.accent || '#2d8cf0';

  // ── ランキング行コンポーネント ──
  const RankRow = ({ oid, amt, max, rank, color }: { oid: string; amt: number; max: number; rank: number; color: string }) => {
    const isJBW = oid === '__JBW__';
    const u = isJBW ? null : allUsers.find(x => x.id === oid);
    const pct = Math.round(amt / max * 100);
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: isJBW ? '#2563eb' : T.border, color: isJBW ? '#fff' : T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, position: 'relative' }}>
              {isJBW ? 'J' : initial(shortName(u))}
              {rank === 0 && <span style={{ position: 'absolute', top: -6, right: -4, fontSize: 10 }}>👑</span>}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.primary, fontStyle: isJBW ? 'italic' : 'normal' }}>{isJBW ? 'JBW' : shortName(u)}</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.primary, fontFeatureSettings: "'tnum'" }}>{fmtYen(amt)}</span>
        </div>
        <div style={{ width: '100%', height: 4, background: T.borderLight, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: (animPct > 0 ? pct : 0) + '%', height: '100%', background: color, borderRadius: 2,
            transition: 'width .8s cubic-bezier(.4,0,.2,1)',
            ...(isJBW ? { backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)' } : {}),
          }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: T.bg }}>

      {/* ━━ SECTION A: ヘッダー ━━ */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>{greet}</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.primary, letterSpacing: '-0.02em', marginTop: 2 }}>{userName}</div>
      </div>

      {/* ━━ HITOKOTO: みんなのひとこと ━━ */}
      {(hitokotoEntries.length > 0 || hitokotoEdit) && (
        <div style={{ padding: '0 24px', marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hitokotoEntries.map(({ uid, name: eName, initial: eInit, msg }) => (
              <div key={uid} style={{ background: T.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${T.border}`, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 13, background: T.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{eInit}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.primary }}>{eName}のひとこと</div>
                  {uid === user?.id && !hitokotoEdit && (
                    <button
                      onClick={() => { setHitokotoDraft(msg); setHitokotoEdit(true); }}
                      style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 4, border: `1px solid ${T.border}`, background: 'transparent', color: T.muted, fontSize: 9, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      編集
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: T.primary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{msg}</div>
              </div>
            ))}
            {hitokotoEdit && (
              <div style={{ background: T.card, borderRadius: 10, padding: '14px 18px', border: `1px solid ${T.accent}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>{shortName(allUsers.find(u => u.id === user?.id))}のひとこと</div>
                <textarea
                  value={hitokotoDraft}
                  onChange={e => setHitokotoDraft(e.target.value)}
                  placeholder="チームへひとことを入力..."
                  style={{ width: '100%', padding: '8px 10px', border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', outline: 'none', background: T.bg, color: T.primary, resize: 'vertical', minHeight: 40, lineHeight: 1.6, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setHitokotoEdit(false)} style={{ padding: '4px 12px', borderRadius: 5, border: `1px solid ${T.border}`, background: 'transparent', color: T.muted, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
                  <button onClick={saveHitokoto} disabled={hitokotoSaving} style={{ padding: '4px 12px', borderRadius: 5, border: 'none', background: T.primary, color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: hitokotoSaving ? 0.5 : 1 }}>{hitokotoSaving ? '保存中...' : '保存'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {!myHitokoto && !hitokotoEdit && (
        <div style={{ padding: '0 24px', marginTop: hitokotoEntries.length > 0 ? 10 : 16 }}>
          <button
            onClick={() => { setHitokotoDraft(''); setHitokotoEdit(true); }}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: `2px dashed ${T.border}`, background: 'transparent', color: T.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            + ひとことを追加
          </button>
        </div>
      )}

      <div style={{ padding: '16px 24px' }}>

        {/* ━━ SECTION B: メインKPI（2カラム）━━ */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>

          {/* B-左: 今月の売上 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '0.03em', marginBottom: 12 }}>今月の売上</div>

            {/* 棒グラフ: 先月 vs 今月 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 80, marginBottom: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, color: T.muted, fontWeight: 600 }}>{fmtYen(lastRev)}</span>
                <div style={{ width: '100%', maxWidth: 50, background: T.borderLight, borderRadius: 3, height: Math.max(6, lastRev > 0 ? Math.round(lastRev / Math.max(thisRev, lastRev, 1) * 60) : 6), transition: 'height .8s ease' }} />
                <span style={{ fontSize: 8.5, color: T.muted }}>先月</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, color: T.primary, fontWeight: 700 }}>{fmtYen(thisRev)}</span>
                <div style={{ width: '100%', maxWidth: 50, background: changePct >= 0 ? green : red, borderRadius: 3, height: Math.max(6, thisRev > 0 ? Math.round(thisRev / Math.max(thisRev, lastRev, 1) * 60) : 6), transition: 'height .8s ease' }} />
                <span style={{ fontSize: 8.5, color: T.primary, fontWeight: 600 }}>今月</span>
              </div>
            </div>

            {/* 大きな金額表示 */}
            <div style={{ fontSize: 22, fontWeight: 900, color: T.primary, letterSpacing: '-0.03em', marginBottom: 6 }}>{fmtYen(thisRev)}</div>

            {/* 前月比 */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 16, background: changePct >= 0 ? `${green}15` : `${red}15`, marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: changePct >= 0 ? green : red }}>
                {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct)}%
              </span>
              <span style={{ fontSize: 9, color: T.muted }}>vs 先月</span>
            </div>

            {/* サブ情報 */}
            <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>先月同日比</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: sameDayPct >= 0 ? green : red }}>{sameDayPct >= 0 ? '+' : ''}{sameDayPct}%</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>残り営業日</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>{bizDaysLeft}日</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>先月最終実績</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{fmtYen(lastRev)}</div>
              </div>
            </div>
          </div>

          {/* B-右: 今期目標マイルストーン進捗 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.muted, letterSpacing: '0.03em' }}>今期目標</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.primary, letterSpacing: '-0.02em' }}>10億円</div>
            </div>

            {/* マイルストーンプログレスバー */}
            <div style={{ position: 'relative', margin: '8px 0' }}>
              <div style={{ width: '100%', height: 10, background: T.borderLight, borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ width: (animPct > 0 ? fyPct : 0) + '%', height: '100%', background: `linear-gradient(90deg, ${green}, #86efac)`, borderRadius: 5, transition: 'width 1.2s cubic-bezier(.4,0,.2,1)' }} />
              </div>
              {/* マイルストーンマーカー */}
              <div style={{ position: 'relative', height: 22, marginTop: 3 }}>
                {milestones.map(ms => {
                  const pos = ms.v / FY_TARGET * 100;
                  const reached = fyRev >= ms.v;
                  const isFirst = ms.v === 100000000;
                  return (
                    <div key={ms.v} style={{ position: 'absolute', left: pos + '%', transform: 'translateX(-50%)', textAlign: 'center' }}>
                      <div style={{ width: 1.5, height: 6, background: reached ? green : T.border, margin: '0 auto 2px', borderRadius: 1 }} />
                      <div style={{
                        fontSize: isFirst ? 9.5 : 8,
                        fontWeight: reached ? 800 : isFirst ? 700 : 400,
                        color: reached ? green : isFirst ? orange : T.muted,
                      }}>
                        {ms.l}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 現在値 */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, marginTop: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: T.primary }}>{fmtYen(fyRev)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: green }}>{fyPct.toFixed(1)}%</span>
            </div>

            {/* サブ情報 */}
            <div style={{ display: 'flex', gap: 14 }}>
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>残り</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{fmtYen(fyRemaining)}</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>残月数</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{fyMonthsLeft}ヶ月</div>
              </div>
              <div style={{ width: 1, background: T.border }} />
              <div>
                <div style={{ fontSize: 8.5, color: T.muted }}>月あたり必要</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.sub }}>{fmtYen(fyMonthlyNeeded)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ━━ SECTION C: 今期月別売上グラフ ━━ */}
        <div style={{ background: T.card, borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>今期 月別売上</div>
            <div style={{ fontSize: 10, color: T.muted }}>{fmtYen(fyRev)} / 10億円</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {(() => {
              const maxFy = Math.max(...fyMonthlyRevs.map(m => m.rev), 1);
              return fyMonthlyRevs.map(m => {
                const h = maxFy > 0 ? Math.max(3, Math.round(m.rev / maxFy * 60)) : 3;
                const isCurrent = m.key === thisMonth;
                const isPast = m.key < thisMonth;
                return (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 7.5, fontWeight: 700, color: isCurrent ? T.primary : m.rev > 0 ? T.sub : 'transparent' }}>
                      {m.rev > 0 ? (m.rev >= 1000000 ? `${(m.rev / 1000000).toFixed(1)}M` : `${Math.round(m.rev / 1000)}K`) : ''}
                    </span>
                    <div style={{
                      width: '100%', height: h, borderRadius: 2,
                      background: isCurrent ? T.primary : isPast && m.rev > 0 ? T.border : `${T.muted}20`,
                      border: !isPast && !isCurrent ? `1px dashed ${T.border}` : 'none',
                      transition: 'height .6s cubic-bezier(.4,0,.2,1)',
                    }} />
                    <span style={{ fontSize: 7.5, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? T.primary : T.muted }}>{m.label}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ━━ SECTION D: メンバー別売上（2カラム）━━ */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* D-左: メンバー別今月売上 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 14 }}>メンバー別 今月売上</div>
            {monthlyEntries.length === 0 && <div style={{ fontSize: 10, color: T.muted, padding: '8px 0' }}>データなし</div>}
            {monthlyEntries.map(([oid, amt], i) => (
              <RankRow key={oid} oid={oid} amt={amt} max={maxMonthly} rank={i} color={i === 0 ? T.primary : i === 1 ? T.sub : T.border} />
            ))}
          </div>

          {/* D-右: メンバー別今期売上 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary, marginBottom: 14 }}>メンバー別 今期売上</div>
            {fyEntries.length === 0 && <div style={{ fontSize: 10, color: T.muted, padding: '8px 0' }}>データなし</div>}
            {fyEntries.map(([oid, amt], i) => (
              <RankRow key={oid} oid={oid} amt={amt} max={maxFyEntry} rank={i} color={i === 0 ? green : i === 1 ? accent : T.border} />
            ))}
          </div>
        </div>

        {/* ━━ SECTION E: 直近の成約 + 成約間近（2カラム）━━ */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* E-左: 直近の成約 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: green }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>直近の成約</span>
            </div>
            {recentWins.length === 0 && <div style={{ fontSize: 10, color: T.muted, padding: '6px 0' }}>まだ成約がありません</div>}
            {recentWins.map((d, i) => {
              const acct = accounts.find(a => a.id === d.account_id);
              const ow = allUsers.find(u => u.id === d.owner_id);
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < recentWins.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                  <span style={{ fontSize: 12 }}>{countryToFlag(acct?.country ?? null)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct?.name || d.name}</div>
                    <div style={{ fontSize: 8.5, color: T.muted }}>{d.payment_confirmed_date} · {shortName(ow)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: green, fontFeatureSettings: "'tnum'" }}>{fmtYen(Number(d.amount) || 0)}</span>
                </div>
              );
            })}
          </div>

          {/* E-右: 成約間近の案件 */}
          <div style={{ flex: 1, background: T.card, borderRadius: 10, padding: '16px 20px', border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: orange }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>成約間近の案件</span>
              <span style={{ fontSize: 8.5, color: T.muted }}>請求書送付済</span>
            </div>
            {hotDeals.length === 0 && <div style={{ fontSize: 10, color: T.muted, padding: '6px 0' }}>該当案件なし</div>}
            {hotDeals.map((d, i) => {
              const acct = accounts.find(a => a.id === d.account_id);
              const stg = STAGES.find(s => s.id === d.stage);
              const ow = allUsers.find(u => u.id === d.owner_id);
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < hotDeals.length - 1 ? `1px solid ${T.borderLight}` : 'none' }}>
                  <span style={{ fontSize: 12 }}>{countryToFlag(acct?.country ?? null)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acct?.name || d.name}</div>
                    <div style={{ fontSize: 8.5, color: T.muted }}>{stg?.ja || d.stage} · {shortName(ow)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: T.primary, fontFeatureSettings: "'tnum'" }}>{fmtYen(Number(d.amount) || 0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ━━ SECTION F: 未提出レポート ━━ */}
        {unreported.length > 0 && (
          <div style={{ background: T.card, borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: red }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>未提出レポート</span>
              <span style={{ fontSize: 8.5, color: T.muted }}>今週</span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {unreported.map((u, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: T.bg, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: T.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: T.sub }}>
                    {initial(shortName(u.user))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.primary }}>{shortName(u.user)}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: red, background: `${red}12`, padding: '1px 6px', borderRadius: 8 }}>{u.deals.length}件</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ━━ SECTION G: 取引先の入力充実度 ━━ */}
        <div style={{ background: T.card, borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>取引先 入力充実度</div>
            <div style={{ fontSize: 8.5, color: T.muted }}>必須フィールド充填率</div>
          </div>
          {acctCompleteness.length === 0 && <div style={{ fontSize: 10, color: T.muted }}>データなし</div>}
          {acctCompleteness.map(entry => (
            <div key={entry.oid} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, background: T.borderLight, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800 }}>
                    {initial(shortName(entry.user))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.primary }}>{shortName(entry.user)}</span>
                  <span style={{ fontSize: 8.5, color: T.muted }}>{entry.count}社</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: entry.pct >= 80 ? green : entry.pct >= 50 ? orange : red }}>{entry.pct}%</span>
              </div>
              <div style={{ position: 'relative', width: '100%', height: 4, background: T.borderLight, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: (animPct > 0 ? entry.pct : 0) + '%', height: '100%', background: entry.pct >= 80 ? green : entry.pct >= 50 ? orange : red, borderRadius: 2, transition: 'width .8s cubic-bezier(.4,0,.2,1)' }} />
                <div style={{ position: 'absolute', left: '80%', top: -1, width: 1.5, height: 6, background: red, borderRadius: 1 }} />
              </div>
            </div>
          ))}
        </div>

        {/* ━━ SECTION H: 最近のアクティビティ ━━ */}
        {recentActivities.length > 0 && (
          <div style={{ background: T.card, borderRadius: 10, padding: '16px 20px', marginBottom: 16, border: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: T.accent }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.primary }}>最近のアクティビティ</span>
              </div>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {recentActivities.slice(0, 10).map(a => {
                const actUser = allUsers.find(x => x.id === a.user_id);
                const acct = accounts.find(x => x.id === a.account_id);
                const d = new Date(a.created_at);
                const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                const typeLabels: Record<string, string> = {
                  stage_change: 'ステージ変更', note: 'メモ', call: '電話', email: 'メール',
                  meeting: 'ミーティング', weekly_report: '週報', file: 'ファイル',
                  audit_update: '更新', audit_insert: '新規作成', report: 'レポート',
                  todo: 'ToDo', action: 'アクション',
                };
                const typeLabel = typeLabels[a.type] || a.type;
                const typeIcons: Record<string, string> = {
                  stage_change: '🔄', note: '📝', call: '📞', email: '✉️',
                  meeting: '🤝', weekly_report: '📊', file: '📎',
                  audit_update: '✏️', audit_insert: '✨', report: '📋',
                  todo: '☑️', action: '⚡',
                };
                const typeIcon = typeIcons[a.type] || '📌';
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                    <div style={{ width: 24, height: 24, borderRadius: 12, background: T.borderLight, color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                      {typeIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: T.primary }}>
                        <span style={{ fontWeight: 600 }}>{shortName(actUser)}</span>
                        <span style={{ color: T.muted, marginLeft: 4 }}>{typeLabel}</span>
                        {acct && <span style={{ color: T.accent, marginLeft: 4, fontWeight: 500 }}>{acct.name}</span>}
                      </div>
                      {a.content && (
                        <div style={{ fontSize: 10, color: T.sub, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.content}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 9, color: T.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>{timeStr}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
});
