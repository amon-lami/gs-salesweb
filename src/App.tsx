// ============================================
// GS Sales CRM - App Entry Point (v2)
// Vite + React + TypeScript
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth, useDeals, useAccounts, useLeads, useContacts, useCategories, useMasterData, useSafeUpdate } from '@/hooks';
import {
  Layout, LeadPage, DealPage, Dashboard, AccountPage, ContactPage,
  ErrorBoundary, ToastProvider, LoginScreen,
  WeeklyReportPage, TodoOverviewPage, ExpensePage, DocumentsPage,
  ChatPage,
  SettingsManager, BusinessManager, CSVImporter,
} from '@/components';
import type { Page } from '@/components';
import type { Business } from '@/types/database';
import { T, shortName } from '@/lib/constants';

export default function App() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [page, setPage] = useState<Page>('home');
  const [initError, setInitError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);

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
  const masterData = useMasterData({ client, userId: user?.id || null });
  const _safeUpdate = useSafeUpdate({ client });

  // ビジネス一覧の読み込み
  const loadBusinesses = useCallback(async () => {
    if (!client || !user) return;
    const { data } = await client.from('businesses').select('*').order('created_at');
    if (data) setBusinesses(data as Business[]);
  }, [client, user]);

  useEffect(() => { loadBusinesses(); }, [loadBusinesses]);

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

  // 初期化エラー（.envの設定ミスなど）— ローディングより先にチェック
  if (initError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: T.red }}>{initError}</span>
        <span style={{ fontSize: 11, color: '#999' }}>.env ファイルに VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY が設定されているか確認してください</span>
      </div>
    );
  }

  // ローディング
  if (status === 'loading' || !client) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: '#999' }}>読み込み中...</span>
      </div>
    );
  }

  // 認証エラー
  if (status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, fontFamily: 'Noto Sans JP, sans-serif' }}>
        <span style={{ fontSize: 13, color: T.red }}>{authError}</span>
      </div>
    );
  }

  // ログインが必要
  if (status === 'needSetup') {
    return <LoginScreen onLogin={() => window.location.reload()} />;
  }

  return (
    <ErrorBoundary>
    <ToastProvider>
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

      {page === 'reports' && user && (
        <WeeklyReportPage
          deals={deals}
          accounts={accounts}
          client={client}
          user={user}
          allUsers={allUsers}
        />
      )}

      {page === 'todos' && user && (
        <TodoOverviewPage
          deals={deals}
          accounts={accounts}
          client={client}
          user={user}
          allUsers={allUsers}
        />
      )}

      {page === 'expenses' && user && (
        <ExpensePage
          client={client}
          user={user}
          allUsers={allUsers}
          accounts={accounts}
        />
      )}

      {page === 'documents' && user && (
        <DocumentsPage
          client={client}
          user={user}
          allUsers={allUsers}
          accounts={accounts}
          contacts={contacts}
          deals={deals}
        />
      )}

      {page === 'chat' && user && (
        <ChatPage
          client={client}
          user={user}
          allUsers={allUsers}
          accounts={accounts}
          categories={categories}
          deals={deals}
        />
      )}

      {page === 'settings' && user && (
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.primary, marginBottom: 16 }}>設定</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setShowSettings(true)} style={{ padding: '8px 16px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>一般設定</button>
            <button onClick={() => setShowCSVImport(true)} style={{ padding: '8px 16px', borderRadius: 6, border: `1px solid ${T.border}`, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#fff', color: T.primary, fontFamily: 'inherit' }}>CSVインポート</button>
          </div>
          <BusinessManager client={client} businesses={businesses} onUpdated={loadBusinesses} />
        </div>
      )}
    </Layout>

    {/* Settings Modal */}
    {showSettings && user && (
      <SettingsManager
        categories={categories}
        client={client}
        user={user}
        allUsers={allUsers}
        accounts={accounts}
        onClose={() => setShowSettings(false)}
        onUpdated={reloadAll}
        onOpenSupabaseSettings={() => {}}
        businesses={businesses.map(b => ({ id: b.id, label: b.label || b.id, color: b.color || '#2d8cf0' }))}
        onBusinessUpdated={loadBusinesses}
      />
    )}

    {/* CSV Import Modal */}
    {showCSVImport && user && (
      <CSVImporter
        client={client}
        user={user}
        allUsers={allUsers}
        accounts={accounts}
        onDone={() => { setShowCSVImport(false); reloadAll(); }}
      />
    )}

    </ToastProvider>
    </ErrorBoundary>
  );
}
