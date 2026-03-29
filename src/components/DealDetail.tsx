// ============================================
// GS Sales CRM - Deal Detail View
// 商談詳細画面（3カラムレイアウト）
// ============================================

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, Contact, AppUser, DealFile, DealStage } from '@/types/database';
import { STAGES, T, fmtDealAmt, fmt, shortName } from '@/lib/constants';
import { ShipBadge, IncoBadge, PayBadge } from './Badges';
import { ActivityTimeline } from './deals/ActivityTimeline';
import { ChatPanel } from './chat/ChatPanel';

interface DealDetailProps {
  deal: Deal;
  accounts: Account[];
  contacts: Contact[];
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  onBack: () => void;
  onUpdated: () => void;
  onEdit: () => void;
}

export const DealDetail = memo(function DealDetail({
  deal, accounts, contacts, client, user, allUsers, onBack, onUpdated, onEdit,
}: DealDetailProps) {
  const acct = accounts.find(a => a.id === deal.account_id);
  const dealContacts = contacts.filter(c => c.account_id === deal.account_id);
  const stageObj = STAGES.find(s => s.id === deal.stage);
  const stageIdx = STAGES.findIndex(s => s.id === deal.stage);
  const owner = allUsers.find(u => u.id === deal.owner_id);
  const [files, setFiles] = useState<DealFile[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadFiles = useCallback(async () => {
    const { data } = await client
      .from('sales_deal_files')
      .select('*')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false });
    if (data) setFiles(data as DealFile[]);
  }, [client, deal.id]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const quickUpdate = useCallback(async (field: string, value: unknown) => {
    try {
      const { data: result, error: re } = await client.rpc('rpc_safe_update_deal', {
        p_deal_id: deal.id,
        p_expected_updated_at: deal.updated_at,
        p_updates: { [field]: value },
      });
      if (re) throw re;
      if (result && !result.success) {
        alert(result.message || '他のユーザーが先に更新しています。');
        onUpdated();
        return;
      }
      onUpdated();
    } catch (e: unknown) {
      console.error(e);
      alert('更新エラー: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [client, deal.id, deal.updated_at, onUpdated]);

  const moveSta = useCallback(async (newStage: DealStage) => {
    const currentPhase = STAGES.find(s => s.id === deal.stage)?.phase || 'pre';
    const targetPhase = STAGES.find(s => s.id === newStage)?.phase;
    const updateData: Record<string, unknown> = { stage: newStage, updated_at: new Date().toISOString() };
    if (currentPhase === 'pre' && (targetPhase === 'post' || targetPhase === 'done') && !deal.payment_confirmed_date) {
      updateData.payment_confirmed_date = new Date().toISOString().split('T')[0];
    }
    const { error: ue } = await client.from('sales_deals').update(updateData).eq('id', deal.id);
    if (ue) { alert('ステージ更新エラー: ' + ue.message); return; }
    await client.from('sales_activities').insert({
      deal_id: deal.id, account_id: deal.account_id, user_id: user.id, type: 'stage_change',
      content: `${stageObj?.ja} → ${STAGES.find(s => s.id === newStage)?.ja}`,
    });
    onUpdated();
  }, [client, deal, user.id, stageObj, onUpdated]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const fp = 'sales/' + deal.id + '/' + Date.now() + '_' + file.name;
      const { error: ue } = await client.storage.from('chat-files').upload(fp, file, { cacheControl: '3600', upsert: false });
      if (ue) throw ue;
      const { data: ud } = client.storage.from('chat-files').getPublicUrl(fp);
      await client.from('sales_deal_files').insert({
        deal_id: deal.id, name: file.name, url: ud?.publicUrl || '',
        file_type: file.type, size: file.size, uploaded_by: user.id,
      });
      loadFiles();
    } catch (err: unknown) {
      alert('アップロードエラー: ' + (err instanceof Error ? err.message : String(err)));
    }
    e.target.value = '';
  };

  const deleteDeal = async () => {
    try {
      await client.from('sales_activities').delete().eq('deal_id', deal.id);
      await client.from('sales_deal_files').delete().eq('deal_id', deal.id);
      await client.from('sales_deals').delete().eq('id', deal.id);
      onUpdated();
      onBack();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const phase = stageObj?.phase;
  const isPost = phase === 'post' || phase === 'done';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
      {/* Back + Title + Edit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: `1px solid ${T.border}`, marginBottom: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, fontSize: 12, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>戻る
        </button>
        <div style={{ flex: 1, marginLeft: 4 }}>
          <div style={{ fontSize: 9.5, color: T.muted }}>商談</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.primary }}>{deal.name}</div>
        </div>
        <ShipBadge type={deal.shipping_type} />
        <button onClick={onEdit} style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>編集</button>
      </div>

      {/* Stage Progress Bar + Supplier Paid */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, flex: 1 }}>
          {STAGES.map((s, i) => {
            const isCurrent = s.id === deal.stage;
            const isPast = i < stageIdx;
            return (
              <div
                key={s.id}
                onClick={() => moveSta(s.id)}
                style={{
                  flex: 1, padding: '6px 4px', borderRadius: 4, cursor: 'pointer', textAlign: 'center',
                  background: isCurrent ? T.primary : isPast ? T.green + '20' : '#f5f5f5',
                  color: isCurrent ? '#fff' : isPast ? T.green : T.muted,
                  fontSize: 9.5, fontWeight: isCurrent ? 700 : 500, transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#eee'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = isCurrent ? T.primary : isPast ? T.green + '20' : '#f5f5f5'; }}
              >
                {isPast && '✓ '}{s.ja}
              </div>
            );
          })}
        </div>
        {isPost && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9.5, color: T.muted, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={!!deal.supplier_paid}
              onChange={async (e) => {
                const val = e.target.checked;
                const { error: se } = await client.from('sales_deals').update({ supplier_paid: val, updated_at: new Date().toISOString() }).eq('id', deal.id);
                if (!se) onUpdated();
              }}
              style={{ width: 12, height: 12, accentColor: T.primary, cursor: 'pointer' }}
            />
            仕入入金済
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* Left: Deal Info */}
        <div style={{ width: 280, minWidth: 280, overflowY: 'auto' }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 10 }}>商談情報</div>
            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '5px 6px', fontSize: 11.5 }}>
              <span style={{ color: T.muted }}>取引先</span>
              <span style={{ color: T.primary, fontWeight: 500 }}>{acct?.name || '-'}</span>
              <span style={{ color: T.muted }}>金額</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{fmtDealAmt(deal.amount)}</span>

              {/* Payment status (post/done only) */}
              {isPost && (
                <>
                  <span style={{ color: T.muted }}>入金状況</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 5, background: '#e5e5e5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: (deal.prepayment_percent || 0) + '%', height: '100%', background: T.primary, transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: T.sub, fontWeight: 500 }}>{deal.prepayment_percent || 0}%</span>
                    {(deal.prepayment_percent || 0) > 0 && (deal.prepayment_percent || 0) < 100 && <PayBadge status="partial" />}
                    {(deal.prepayment_percent || 0) >= 100 && <PayBadge status="full" />}
                  </span>
                </>
              )}

              {/* Confidence (pre only) */}
              {!isPost && phase === 'pre' && (
                <>
                  <span style={{ color: T.muted }}>確度</span>
                  <span style={{ fontWeight: 600, color: T.primary }}>{deal.confidence || 50}%</span>
                </>
              )}

              {/* Shipping */}
              {(deal.shipping_type || deal.incoterms) && (
                <>
                  <span style={{ color: T.muted }}>配送</span>
                  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <ShipBadge type={deal.shipping_type} />
                    <IncoBadge incoterms={deal.incoterms} />
                  </span>
                </>
              )}

              <span style={{ color: T.muted }}>商談開始日</span>
              <span>{fmt(deal.deal_date)}</span>

              {isPost && (
                <>
                  <span style={{ color: T.muted }}>入金日</span>
                  <span>{fmt(deal.payment_confirmed_date || deal.payment_date)}</span>
                </>
              )}

              <span style={{ color: T.muted }}>GS責任者</span>
              <span>{shortName(owner)}</span>
            </div>

            {/* Invoice */}
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              {deal.invoice_file_url ? (
                <a href={deal.invoice_file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  請求書を表示
                </a>
              ) : (
                <span style={{ fontSize: 11, color: T.muted }}>請求書未添付</span>
              )}
            </div>
          </div>

          {/* Spreadsheet link */}
          {deal.spreadsheet_url && (
            <div
              style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => window.open(deal.spreadsheet_url || '', '_blank')}
            >
              <span style={{ fontSize: 16 }}>📊</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.accent }}>スプレッドシートを開く</div>
                <div style={{ fontSize: 9, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.spreadsheet_url}</div>
              </div>
            </div>
          )}

          {/* Contacts */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>コンタクト ({dealContacts.length})</div>
            {dealContacts.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <div style={{ width: 22, height: 22, borderRadius: 4, background: '#e8e8e8', color: T.sub, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 9.5, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[c.role, c.email, c.phone, c.whatsapp, c.linkedin].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
            {dealContacts.length === 0 && <div style={{ fontSize: 11, color: '#ccc' }}>コンタクトなし</div>}
          </div>
        </div>

        {/* Center: Activity Timeline */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <ActivityTimeline
            deal={deal}
            client={client}
            user={user}
            allUsers={allUsers}
            onUpdated={onUpdated}
          />
        </div>

        {/* Right: Files + Notes */}
        <div style={{ width: 260, minWidth: 260, overflowY: 'auto' }}>
          {/* Files */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 8 }}>ファイル ({files.length})</div>
            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', padding: '6px', borderRadius: 5, border: `1px dashed ${T.border}`, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: T.bg, color: T.sub, fontFamily: 'inherit', marginBottom: 8 }}
            >
              + アップロード
            </button>
            {files.map(f => (
              <div key={f.id} style={{ padding: '4px 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: 'none' }}>{f.name}</a>
              </div>
            ))}
            {files.length === 0 && <div style={{ fontSize: 11, color: '#ccc' }}>ファイルなし</div>}
          </div>

          {/* Chat */}
          <ChatPanel
            deal={deal}
            client={client}
            user={user}
            allUsers={allUsers}
            accounts={accounts}
            onUpdated={onUpdated}
          />
          <div style={{ marginBottom: 12 }} />

          {/* Notes */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '14px 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, marginBottom: 6 }}>メモ</div>
            <textarea
              defaultValue={deal.notes || ''}
              placeholder="商談の詳細・備考を記入..."
              onBlur={async (e) => {
                const val = e.target.value.trim();
                if (val === (deal.notes || '')) return;
                await quickUpdate('notes', val || null);
              }}
              style={{
                width: '100%', minHeight: 60, padding: '8px', border: `1px solid ${T.border}`,
                borderRadius: 5, fontSize: 11.5, outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, resize: 'vertical', color: T.primary,
              }}
            />
          </div>
        </div>
      </div>

      {/* Delete button */}
      <div style={{ marginTop: 20, paddingTop: 12, borderTop: `1px solid ${T.border}`, textAlign: 'center' }}>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{ fontSize: 10.5, color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            削除
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: T.primary }}>本当に削除しますか？</span>
            <button onClick={deleteDeal} style={{ padding: '3px 8px', borderRadius: 3, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: T.red, color: '#fff', fontFamily: 'inherit' }}>削除する</button>
            <button onClick={() => setDeleteConfirm(false)} style={{ padding: '3px 8px', borderRadius: 3, border: `1px solid ${T.border}`, fontSize: 10, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.sub, fontFamily: 'inherit' }}>キャンセル</button>
          </div>
        )}
      </div>
    </div>
  );
});
