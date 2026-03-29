import React, { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, Category, AppUser } from '@/types/database';
import {
  T,
  LEAD_STATUSES,
  ACTION_TYPES,
  LOST_REASONS,
  fmt,
  shortName,
  countryToFlag,
  stripCorp,
  IS_MOBILE,
  fmtPhone,
} from '@/lib/constants';
import { useToast } from '@/components/shared/ToastProvider';
// TODO: Import LeadFormModal once available (Phase 5)
// import LeadFormModal from './LeadFormModal';

interface Props {
  lead: Lead & { business_id?: string; lost_reason?: string; linkedin_url?: string };
  categories: Category[];
  allUsers: AppUser[];
  client: SupabaseClient;
  user: AppUser;
  leadActions?: any[];
  onBack: () => void;
  onUpdated: () => void;
  onConvert?: (deal: any) => void;
  currentBiz?: string;
}

export default function LeadDetail({
  lead,
  categories,
  allUsers,
  client,
  user,
  leadActions,
  onBack,
  onUpdated,
  onConvert,
  currentBiz,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<any>(null);
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionType, setActionType] = useState<string>('電話');
  const [actionMemo, setActionMemo] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lostReason, setLostReason] = useState<string>('反応なし');
  const [lostMemo, setLostMemo] = useState('');
  const [savingLost, setSavingLost] = useState(false);
  const [editingCats, setEditingCats] = useState(false);
  const [editCatIds, setEditCatIds] = useState<string[]>(lead.category_ids || []);
  const [localActions, setLocalActions] = useState<any[]>(leadActions || []);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editActionType, setEditActionType] = useState('');
  const [editActionMemo, setEditActionMemo] = useState('');
  const [savingEditAction, setSavingEditAction] = useState(false);

  useEffect(() => {
    setLocalActions(leadActions || []);
  }, [leadActions]);

  const [leadFiles, setLeadFiles] = useState<any[]>([]);
  const leadFileRef = useRef<HTMLInputElement | null>(null);
  const [confirmLeadFileDeleteId, setConfirmLeadFileDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadLeadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  const toast = useToast();

  const loadLeadFiles = async () => {
    const { data } = await client
      .from('lead_files')
      .select('*')
      .eq('lead_id', lead.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (data) setLeadFiles(data);
  };

  const handleLeadFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const fp = 'leads/' + lead.id + '/' + Date.now() + '_' + file.name;
      const ct = file.type || 'application/octet-stream';
      const { error: ue } = await client.storage
        .from('chat-files')
        .upload(fp, file, { cacheControl: '3600', upsert: true, contentType: ct });
      if (ue) throw ue;
      const { data: ud } = client.storage.from('chat-files').getPublicUrl(fp);
      await client.from('lead_files').insert({
        lead_id: lead.id,
        name: file.name,
        url: ud?.publicUrl || '',
        file_type: ct,
        size: file.size,
        uploaded_by: user.id,
      });
      loadLeadFiles();
    } catch (err: any) {
      toast('アップロードエラー: ' + err.message, 'error');
    }
  };

  const deleteLeadFile = async (fileId: string) => {
    if (confirmLeadFileDeleteId === fileId) {
      const { error } = await client
        .from('lead_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);
      if (!error) loadLeadFiles();
      setConfirmLeadFileDeleteId(null);
    } else {
      setConfirmLeadFileDeleteId(fileId);
      setTimeout(
        () => setConfirmLeadFileDeleteId((prev) => (prev === fileId ? null : prev)),
        3000,
      );
    }
  };

  const saveAction = async () => {
    if (!actionMemo.trim()) return;
    setSavingAction(true);
    try {
      const { data: newAction, error } = await client
        .from('lead_actions')
        .insert({
          lead_id: lead.id,
          action_type: actionType,
          memo: actionMemo.trim(),
          created_by: user.id,
          action_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) {
        toast('アクション保存エラー: ' + error.message, 'error');
        setSavingAction(false);
        return;
      }
      setLocalActions((prev) => [newAction, ...prev]);
      setActionMemo('');
      setShowActionForm(false);
      onUpdated();
    } catch (e: any) {
      toast('エラー: ' + e.message, 'error');
    }
    setSavingAction(false);
  };

  const startEditAction = (a: any) => {
    setEditingActionId(a.id);
    setEditActionType(a.action_type);
    setEditActionMemo(a.memo || '');
  };

  const cancelEditAction = () => {
    setEditingActionId(null);
    setEditActionType('');
    setEditActionMemo('');
  };

  const saveEditAction = async () => {
    if (!editActionMemo.trim()) return;
    setSavingEditAction(true);
    try {
      const { error } = await client
        .from('lead_actions')
        .update({ action_type: editActionType, memo: editActionMemo.trim() })
        .eq('id', editingActionId);
      if (error) {
        toast('編集エラー: ' + error.message, 'error');
        setSavingEditAction(false);
        return;
      }
      setLocalActions((prev) =>
        prev.map((a) =>
          a.id === editingActionId
            ? { ...a, action_type: editActionType, memo: editActionMemo.trim() }
            : a,
        ),
      );
      cancelEditAction();
    } catch (e: any) {
      toast('エラー: ' + e.message, 'error');
    }
    setSavingEditAction(false);
  };

  const markLost = async () => {
    setSavingLost(true);
    try {
      const upd: Record<string, unknown> = {
        status: 'lost',
        updated_at: new Date().toISOString(),
      };
      upd.lost_reason = lostReason + (lostMemo.trim() ? ' - ' + lostMemo.trim() : '');
      const { error } = await client.from('sales_leads').update(upd).eq('id', lead.id);
      if (error) throw error;
      try {
        await client.from('lead_actions').insert({
          lead_id: lead.id,
          action_type: 'その他',
          memo: '見送り: ' + lostReason + (lostMemo.trim() ? ' - ' + lostMemo.trim() : ''),
          created_by: user.id,
          action_date: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('lead_actions insert failed:', e);
      }
      setShowLostModal(false);
      onUpdated();
    } catch (e: any) {
      toast('エラー: ' + e.message, 'error');
    }
    setSavingLost(false);
  };

  const reactivateLead = async () => {
    try {
      const { error } = await client
        .from('sales_leads')
        .update({ status: 'contacted', lost_reason: null, updated_at: new Date().toISOString() })
        .eq('id', lead.id);
      if (error) throw error;
      try {
        await client.from('lead_actions').insert({
          lead_id: lead.id,
          action_type: 'その他',
          memo: 'リード復活',
          created_by: user.id,
          action_date: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('lead_actions insert failed:', e);
      }
      onUpdated();
    } catch (e: any) {
      toast('エラー: ' + e.message, 'error');
    }
  };

  const deleteLead = async () => {
    setDeleting(true);
    try {
      await client
        .from('sales_leads')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lead.id);
      setShowDeleteConfirm(false);
      setDeleting(false);
      onUpdated();
      onBack();
    } catch (e: any) {
      toast('削除エラー: ' + e.message, 'error');
      setDeleting(false);
    }
  };

  const executeConvertFromDetail = async () => {
    setConverting(true);
    const errors: string[] = [];
    try {
      const acctRow: Record<string, any> = {
        name: stripCorp(lead.company_name),
        country: lead.country || null,
        website: lead.website || null,
        lead_source: lead.source || null,
        owner_id: lead.owner_id || user.id,
        notes: lead.notes || null,
        category_ids: lead.category_ids || null,
        created_by: user.id,
        business_id: (lead as any).business_id || currentBiz || 'jbeauty',
      };
      const { data: newAcct, error: ae } = await client
        .from('sales_accounts')
        .insert(acctRow)
        .select()
        .single();
      if (ae) throw ae;

      let newContact: any = null;
      if (lead.contact_name || lead.contact_email || lead.phone) {
        const baseCt: Record<string, any> = {
          name: lead.contact_name || lead.company_name,
          email: lead.contact_email || null,
          phone: lead.phone || null,
          whatsapp: lead.whatsapp || lead.phone || null,
          account_id: newAcct.id,
          business_id: (lead as any).business_id || currentBiz || 'jbeauty',
        };
        const { data: ctData, error: ce } = await client
          .from('sales_contacts')
          .insert(baseCt)
          .select()
          .single();
        if (ce) {
          errors.push('Contact: ' + ce.message);
        } else {
          newContact = ctData;
        }
      }

      const _now = new Date();
      const _ym = `${String(_now.getFullYear()).slice(2)}${String(_now.getMonth() + 1).padStart(2, '0')}`;
      const _dealName = `${stripCorp(lead.company_name)} ${_ym}-01`;
      const dealRow: Record<string, any> = {
        name: _dealName,
        account_id: newAcct.id,
        deal_number: 0,
        stage: 'negotiation',
        amount: 0,
        confidence: 50,
        owner_id: lead.owner_id || user.id,
        notes: lead.notes || null,
        created_by: user.id,
        deal_date: _now.toISOString().split('T')[0],
        business_id: (lead as any).business_id || currentBiz || 'jbeauty',
      };
      let newDeal: any = null;
      const { data: dealData, error: de } = await client
        .from('sales_deals')
        .insert(dealRow)
        .select()
        .single();
      if (de) {
        errors.push('Deal(1): ' + de.message);
        const minDeal: Record<string, any> = {
          name: _dealName,
          account_id: newAcct.id,
          stage: 'negotiation',
          owner_id: lead.owner_id || user.id,
          deal_date: _now.toISOString().split('T')[0],
          business_id: (lead as any).business_id || currentBiz || 'jbeauty',
        };
        const r2 = await client.from('sales_deals').insert(minDeal).select().single();
        if (r2.error) {
          errors.push('Deal(2): ' + r2.error.message);
        } else {
          newDeal = r2.data;
        }
      } else {
        newDeal = dealData;
      }

      await client
        .from('sales_leads')
        .update({ status: 'converted', updated_at: new Date().toISOString() })
        .eq('id', lead.id);
      setShowConvertConfirm(false);
      setConverting(false);
      setConvertResult({ acct: newAcct, contact: newContact, deal: newDeal, errors });
      onUpdated();
      if (newDeal && onConvert) onConvert(newDeal);
    } catch (e: any) {
      setConverting(false);
      toast('変換エラー: ' + e.message, 'error');
    }
  };

  const lastActionDate =
    localActions && localActions.length > 0 ? new Date(localActions[0].action_date) : null;
  const daysSinceAction = lastActionDate
    ? Math.floor((Date.now() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale =
    daysSinceAction !== null &&
    daysSinceAction >= 7 &&
    lead.status !== 'converted' &&
    lead.status !== 'lost';
  const st = LEAD_STATUSES.find((s) => s.id === lead.status);
  const owner = allUsers.find((u) => u.id === lead.owner_id);
  const L: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: T.muted, minWidth: 80 };

  // InfoRow helper
  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 0',
        borderBottom: `1px solid ${T.borderLight}`,
        gap: 12,
      }}
    >
      <div style={L}>{label}</div>
      <div
        style={{ flex: 1, fontSize: 12, color: value ? T.primary : T.muted, fontWeight: 500 }}
      >
        {value || '-'}
      </div>
    </div>
  );

  const cardStyle: React.CSSProperties = {
    background: T.card,
    borderRadius: 10,
    border: `1px solid ${T.border}`,
    padding: 16,
    marginBottom: 12,
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: T.sub,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };

  const btnBase: React.CSSProperties = {
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 12px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 20,
  };

  const modalBox: React.CSSProperties = {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  };

  return (
    <div style={{ padding: IS_MOBILE ? 12 : 20, maxWidth: 800, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={onBack}
          style={{
            ...btnBase,
            background: T.bg,
            color: T.sub,
            border: `1px solid ${T.border}`,
          }}
        >
          ← 戻る
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {lead.country && (
              <span style={{ fontSize: 18 }}>{countryToFlag(lead.country)}</span>
            )}
            <h2
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: T.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lead.company_name}
            </h2>
            {st && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  background: st.color,
                  borderRadius: 4,
                  padding: '2px 8px',
                }}
              >
                {st.label}
              </span>
            )}
          </div>
          {owner && (
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
              担当: {shortName(owner)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lead.status !== 'converted' && lead.status !== 'lost' && (
            <button
              onClick={() => setShowConvertConfirm(true)}
              style={{ ...btnBase, background: T.accent, color: '#fff' }}
            >
              商談化
            </button>
          )}
          {lead.status !== 'converted' && lead.status !== 'lost' && (
            <button
              onClick={() => setShowLostModal(true)}
              style={{ ...btnBase, background: T.red, color: '#fff' }}
            >
              見送り
            </button>
          )}
          {lead.status === 'lost' && (
            <button
              onClick={reactivateLead}
              style={{ ...btnBase, background: T.green, color: '#fff' }}
            >
              復活
            </button>
          )}
          <button
            onClick={() => setShowEditModal(true)}
            style={{
              ...btnBase,
              background: T.bg,
              color: T.sub,
              border: `1px solid ${T.border}`,
            }}
          >
            編集
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              ...btnBase,
              background: '#fff0f0',
              color: T.red,
              border: `1px solid #fecaca`,
            }}
          >
            削除
          </button>
        </div>
      </div>

      {/* ── Stale warning ── */}
      {isStale && (
        <div
          style={{
            background: '#fffbeb',
            border: `1px solid ${T.orange}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 12,
            color: '#92400e',
            fontWeight: 500,
          }}
        >
          ⚠ 最後のアクションから {daysSinceAction} 日経過しています。フォローアップを検討してください。
        </div>
      )}

      {/* ── Lost reason ── */}
      {lead.status === 'lost' && lead.lost_reason && (
        <div
          style={{
            background: '#fef2f2',
            border: `1px solid #fecaca`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 12,
            fontSize: 12,
            color: T.red,
            fontWeight: 500,
          }}
        >
          見送り理由: {lead.lost_reason}
        </div>
      )}

      {/* ── Body ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: IS_MOBILE ? '1fr' : '1fr 1fr',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {/* 会社情報 */}
        <div style={cardStyle}>
          <div style={sectionTitle}>会社情報</div>
          <InfoRow label="会社名" value={lead.company_name} />
          <InfoRow label="国" value={lead.country ? `${countryToFlag(lead.country)} ${lead.country}` : null} />
          <InfoRow
            label="ウェブサイト"
            value={
              lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
                >
                  {lead.website}
                </a>
              ) : null
            }
          />
          <InfoRow label="ソース" value={lead.source} />
          <InfoRow label="担当" value={owner ? shortName(owner) : null} />
          <InfoRow label="作成日" value={fmt(lead.created_at)} />
          <InfoRow label="更新日" value={fmt(lead.updated_at)} />
          {lead.linkedin_url && (
            <InfoRow
              label="LinkedIn"
              value={
                <a
                  href={lead.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
                >
                  プロフィール
                </a>
              }
            />
          )}
          {/* Categories */}
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.muted }}>カテゴリ</span>
              <button
                onClick={() => {
                  setEditCatIds(lead.category_ids || []);
                  setEditingCats(!editingCats);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 10,
                  color: T.accent,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {editingCats ? 'キャンセル' : '編集'}
              </button>
            </div>
            {!editingCats ? (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(lead.category_ids || []).length === 0 && (
                  <span style={{ fontSize: 11, color: T.muted }}>-</span>
                )}
                {(lead.category_ids || []).map((cid) => {
                  const cat = categories.find((c) => c.id === cid);
                  return cat ? (
                    <span
                      key={cid}
                      style={{
                        fontSize: 10,
                        background: cat.color + '22',
                        color: cat.color,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontWeight: 600,
                      }}
                    >
                      {cat.name}
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {categories.map((cat) => {
                    const selected = editCatIds.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() =>
                          setEditCatIds((prev) =>
                            selected ? prev.filter((x) => x !== cat.id) : [...prev, cat.id],
                          )
                        }
                        style={{
                          fontSize: 10,
                          background: selected ? cat.color + '33' : T.bg,
                          color: selected ? cat.color : T.muted,
                          border: `1px solid ${selected ? cat.color : T.border}`,
                          borderRadius: 4,
                          padding: '2px 6px',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={async () => {
                    const { error } = await client
                      .from('sales_leads')
                      .update({ category_ids: editCatIds })
                      .eq('id', lead.id);
                    if (!error) {
                      setEditingCats(false);
                      onUpdated();
                    } else {
                      toast('カテゴリ保存エラー: ' + error.message, 'error');
                    }
                  }}
                  style={{ ...btnBase, background: T.accent, color: '#fff', fontSize: 10 }}
                >
                  保存
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 担当者情報 */}
        <div style={cardStyle}>
          <div style={sectionTitle}>担当者情報</div>
          <InfoRow label="名前" value={lead.contact_name} />
          <InfoRow
            label="メール"
            value={
              lead.contact_email ? (
                <a
                  href={`mailto:${lead.contact_email}`}
                  style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
                >
                  {lead.contact_email}
                </a>
              ) : null
            }
          />
          <InfoRow
            label="電話"
            value={
              lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
                >
                  {fmtPhone(lead.phone, lead.country)}
                </a>
              ) : null
            }
          />
          <InfoRow
            label="WhatsApp"
            value={
              lead.whatsapp ? (
                <a
                  href={`https://wa.me/${lead.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.accent, textDecoration: 'none', fontSize: 12 }}
                >
                  {lead.whatsapp}
                </a>
              ) : null
            }
          />
        </div>
      </div>

      {/* メモ */}
      {lead.notes && (
        <div style={cardStyle}>
          <div style={sectionTitle}>メモ</div>
          <div
            style={{
              fontSize: 12,
              color: T.primary,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {lead.notes}
          </div>
        </div>
      )}

      {/* ファイル */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={sectionTitle}>ファイル</div>
          <button
            onClick={() => leadFileRef.current?.click()}
            style={{ ...btnBase, background: T.bg, color: T.sub, border: `1px solid ${T.border}` }}
          >
            + アップロード
          </button>
          <input
            ref={leadFileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleLeadFileUpload}
          />
        </div>
        {leadFiles.length === 0 && (
          <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', padding: 12 }}>
            ファイルなし
          </div>
        )}
        {leadFiles.map((f: any) => (
          <div
            key={f.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderBottom: `1px solid ${T.borderLight}`,
            }}
          >
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                fontSize: 12,
                color: T.accent,
                textDecoration: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {f.name}
            </a>
            <span style={{ fontSize: 10, color: T.muted }}>{fmt(f.created_at)}</span>
            <button
              onClick={() => deleteLeadFile(f.id)}
              style={{
                background: confirmLeadFileDeleteId === f.id ? T.red : 'none',
                border: 'none',
                color: confirmLeadFileDeleteId === f.id ? '#fff' : T.muted,
                cursor: 'pointer',
                fontSize: 10,
                borderRadius: 4,
                padding: '2px 6px',
                fontWeight: 600,
              }}
            >
              {confirmLeadFileDeleteId === f.id ? '確認' : '削除'}
            </button>
          </div>
        ))}
      </div>

      {/* アクション履歴 */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div style={sectionTitle}>アクション履歴</div>
          <button
            onClick={() => setShowActionForm(!showActionForm)}
            style={{ ...btnBase, background: T.accent, color: '#fff' }}
          >
            {showActionForm ? 'キャンセル' : '+ アクション'}
          </button>
        </div>

        {/* Action form */}
        {showActionForm && (
          <div
            style={{
              background: T.bg,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {ACTION_TYPES.map((at) => (
                <button
                  key={at}
                  onClick={() => setActionType(at)}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${actionType === at ? T.accent : T.border}`,
                    background: actionType === at ? T.accent + '15' : '#fff',
                    color: actionType === at ? T.accent : T.sub,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {at}
                </button>
              ))}
            </div>
            <textarea
              value={actionMemo}
              onChange={(e) => setActionMemo(e.target.value)}
              placeholder="アクション内容を入力..."
              style={{
                width: '100%',
                minHeight: 60,
                border: `1px solid ${T.border}`,
                borderRadius: 6,
                padding: 8,
                fontSize: 12,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                onClick={saveAction}
                disabled={savingAction || !actionMemo.trim()}
                style={{
                  ...btnBase,
                  background: savingAction || !actionMemo.trim() ? T.border : T.accent,
                  color: '#fff',
                }}
              >
                {savingAction ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}

        {localActions.length === 0 && (
          <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', padding: 12 }}>
            アクション履歴なし
          </div>
        )}
        {localActions.map((a: any) => (
          <div
            key={a.id}
            style={{
              padding: '8px 0',
              borderBottom: `1px solid ${T.borderLight}`,
            }}
          >
            {editingActionId === a.id ? (
              <div style={{ background: T.bg, borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  {ACTION_TYPES.map((at) => (
                    <button
                      key={at}
                      onClick={() => setEditActionType(at)}
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: `1px solid ${editActionType === at ? T.accent : T.border}`,
                        background: editActionType === at ? T.accent + '15' : '#fff',
                        color: editActionType === at ? T.accent : T.sub,
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {at}
                    </button>
                  ))}
                </div>
                <textarea
                  value={editActionMemo}
                  onChange={(e) => setEditActionMemo(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 50,
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    padding: 8,
                    fontSize: 12,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                  <button
                    onClick={cancelEditAction}
                    style={{
                      ...btnBase,
                      background: T.bg,
                      color: T.sub,
                      border: `1px solid ${T.border}`,
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={saveEditAction}
                    disabled={savingEditAction}
                    style={{ ...btnBase, background: T.accent, color: '#fff' }}
                  >
                    {savingEditAction ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: T.accent,
                      background: T.accent + '15',
                      borderRadius: 4,
                      padding: '1px 6px',
                    }}
                  >
                    {a.action_type}
                  </span>
                  <span style={{ fontSize: 10, color: T.muted }}>{fmt(a.action_date)}</span>
                  {a.created_by && (
                    <span style={{ fontSize: 10, color: T.muted }}>
                      {shortName(allUsers.find((u) => u.id === a.created_by) || null)}
                    </span>
                  )}
                  <button
                    onClick={() => startEditAction(a)}
                    style={{
                      marginLeft: 'auto',
                      background: 'none',
                      border: 'none',
                      fontSize: 10,
                      color: T.muted,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    編集
                  </button>
                </div>
                {a.memo && (
                  <div
                    style={{
                      fontSize: 12,
                      color: T.primary,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.5,
                    }}
                  >
                    {a.memo}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Modals ── */}

      {/* LeadFormModal will be integrated in Phase 5 */}
      {/* TODO: Replace this placeholder with <LeadFormModal /> once available */}
      {showEditModal && (
        <div style={modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: T.primary }}>リード編集</h3>
            <p style={{ fontSize: 12, color: T.muted }}>
              LeadFormModal は Phase 5 で統合されます。
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ ...btnBase, background: T.bg, color: T.sub, border: `1px solid ${T.border}` }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div style={modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: T.red }}>リード削除</h3>
            <p style={{ fontSize: 12, color: T.sub, marginBottom: 16 }}>
              「{lead.company_name}」を削除しますか？この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ ...btnBase, background: T.bg, color: T.sub, border: `1px solid ${T.border}` }}
              >
                キャンセル
              </button>
              <button
                onClick={deleteLead}
                disabled={deleting}
                style={{ ...btnBase, background: T.red, color: '#fff' }}
              >
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert confirm */}
      {showConvertConfirm && (
        <div style={modalOverlay} onClick={() => setShowConvertConfirm(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: T.accent }}>商談化</h3>
            <p style={{ fontSize: 12, color: T.sub, marginBottom: 16 }}>
              「{lead.company_name}」を商談に変換しますか？
              <br />
              アカウント・コンタクト・商談が自動作成されます。
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConvertConfirm(false)}
                style={{ ...btnBase, background: T.bg, color: T.sub, border: `1px solid ${T.border}` }}
              >
                キャンセル
              </button>
              <button
                onClick={executeConvertFromDetail}
                disabled={converting}
                style={{ ...btnBase, background: T.accent, color: '#fff' }}
              >
                {converting ? '変換中...' : '商談化する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert result */}
      {convertResult && (
        <div style={modalOverlay} onClick={() => setConvertResult(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: T.green }}>変換完了</h3>
            <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>
              <div style={{ marginBottom: 6 }}>
                アカウント: <strong>{convertResult.acct?.name || '-'}</strong>
              </div>
              {convertResult.contact && (
                <div style={{ marginBottom: 6 }}>
                  コンタクト: <strong>{convertResult.contact?.name || '-'}</strong>
                </div>
              )}
              <div style={{ marginBottom: 6 }}>
                商談: <strong>{convertResult.deal?.name || '作成失敗'}</strong>
              </div>
              {convertResult.errors && convertResult.errors.length > 0 && (
                <div style={{ color: T.orange, marginTop: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>警告:</div>
                  {convertResult.errors.map((err: string, i: number) => (
                    <div key={i} style={{ fontSize: 11 }}>
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConvertResult(null)}
                style={{ ...btnBase, background: T.accent, color: '#fff' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lost modal */}
      {showLostModal && (
        <div style={modalOverlay} onClick={() => setShowLostModal(false)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14, color: T.red }}>見送り</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.sub, marginBottom: 6 }}>
                理由
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {LOST_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setLostReason(r)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 5,
                      border: `1px solid ${lostReason === r ? T.red : T.border}`,
                      background: lostReason === r ? T.red + '15' : '#fff',
                      color: lostReason === r ? T.red : T.sub,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.sub, marginBottom: 6 }}>
                補足メモ
              </div>
              <textarea
                value={lostMemo}
                onChange={(e) => setLostMemo(e.target.value)}
                placeholder="補足があれば入力..."
                style={{
                  width: '100%',
                  minHeight: 50,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 12,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowLostModal(false)}
                style={{ ...btnBase, background: T.bg, color: T.sub, border: `1px solid ${T.border}` }}
              >
                キャンセル
              </button>
              <button
                onClick={markLost}
                disabled={savingLost}
                style={{ ...btnBase, background: T.red, color: '#fff' }}
              >
                {savingLost ? '保存中...' : '見送りにする'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { LeadDetail };
