// ============================================
// GS Sales CRM - App Entry Point (v2)
// Vite + React + TypeScript
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth, useDeals, useAccounts, useLeads, useContacts, useCategories, useMasterData, useSafeUpdate } from '@/hooks';
import { Layout, LeadPage, DealPage, Dashboard, AccountPage, ContactPage } from '@/components';
import type { Page } from '@/components';
import { T, shortName } from '@/lib/constants';

export default function App() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [initError, setInitError] = useState<string | null>(null);

  // Supabaseクライアント初期化
  useEffect(() => {
    getSupabaseClient().then(setClient).catch(e => setInitError(e.message));
  }, []);

  // Auth
  const { user, allUsers, status, error: authError } = useAuth({ client });

  // Data hooks
  const { deals, refresh: refreshDeals } = useDeals({ client });
  const { accounts, refresh: refreshAccounts } = useAccounts({ client });
  const { leads, refresh: refreshLeads, convertToAccount } = useLeads({ client });
  const { contacts, refresh: refreshContacts } = useContacts({ client });
  const { categories, refresh: refreshCategories } = useCategories({ client });
  // マスターデータ・楽観的ロック（ページ移行時に使用）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const masterData = useMasterData({ client, userId: user?.id || null });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const safeUpdate = useSafeUpdate({ client });

  // 全データリロード
  const reloadAll = useCallback(async () => {
    await Promise.all([
      refreshDeals(), refreshAccounts(), refreshLeads(),
      refreshContacts(), refreshCategories(),
    ]);
  }, [refreshDeals, refreshAccounts, refreshLeads, refreshContacts, refreshCategories]);

  // リード→商談化
  const handleConvertLead = useCallback(async (leadId: string) => {
    if (!user) return;
    await convertToAccount(leadId, user.id);
    await reloadAll();
  }, [user, convertToAccount, reloadAll]);

  // ローディング
  if (status === 'loading' || !client) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: '#999' }}>読み込み中...</span>
      </div>
    );
  }

  // エラー
  if (status === 'error' || initError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: T.red }}>{authError || initError}</span>
      </div>
    );
  }

  // 設定が必要
  if (status === 'needSetup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: T.sub }}>Supabase接続情報を設定してください</span>
        <span style={{ fontSize: 11, color: T.muted }}>設定画面は開発中です</span>
      </div>
    );
  }

  return (
    <Layout page={page} onPageChange={setPage} userName={user ? shortName(user) : undefined}>
      {page === 'home' && user && (
        <Dashboard
          deals={deals}
          accounts={accounts}
          contacts={contacts}
          leads={leads}
          allUsers={allUsers}
          client={client}
          user={user}
        />
      )}

      {page === 'leads' && user && (
        <LeadPage
          leads={leads}
          categories={categories}
          allUsers={allUsers}
          client={client}
          user={user}
          onReload={reloadAll}
          onConvert={handleConvertLead}
        />
      )}

      {page === 'deals' && user && (
        <DealPage
          deals={deals}
          accounts={accounts}
          contacts={contacts}
          categories={categories}
          allUsers={allUsers}
          client={client}
          user={user}
          onReload={reloadAll}
        />
      )}

      {page === 'accounts' && user && (
        <AccountPage
          accounts={accounts}
          contacts={contacts}
          deals={deals}
          categories={categories}
          allUsers={allUsers}
          client={client}
          user={user}
          onReload={reloadAll}
        />
      )}

      {page === 'contacts' && user && (
        <ContactPage
          contacts={contacts}
          accounts={accounts}
          deals={deals}
          allUsers={allUsers}
          client={client}
          user={user}
          onReload={reloadAll}
        />
      )}

      {page === 'reports' && (
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: T.primary }}>レポート</h2>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>週次レポートは移行中です。</p>
        </div>
      )}
    </Layout>
  );
}
