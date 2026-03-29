// ============================================
// GS Sales CRM - Accounts Hook
// 取引先データの取得・CRUD操作
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account } from '@/types/database';

interface UseAccountsOptions {
  client: SupabaseClient | null;
  includeDeleted?: boolean;
}

interface UseAccountsReturn {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useAccounts({ client, includeDeleted = false }: UseAccountsOptions): UseAccountsReturn {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);

    try {
      let query = client
        .from('sales_accounts')
        .select('*')
        .order('name', { ascending: true });

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setAccounts((data as Account[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '取引先の取得に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client, includeDeleted]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!client) return;
    const subscription = client
      .channel('accounts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_accounts' }, () => {
        fetchAccounts();
      })
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [client, fetchAccounts]);

  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    if (!client) return;
    const { error: updateError } = await client
      .from('sales_accounts')
      .update(updates)
      .eq('id', id);
    if (updateError) throw updateError;
    await fetchAccounts();
  }, [client, fetchAccounts]);

  const softDelete = useCallback(async (id: string) => {
    if (!client) return;
    const { error: deleteError } = await client
      .from('sales_accounts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (deleteError) throw deleteError;
    await fetchAccounts();
  }, [client, fetchAccounts]);

  return { accounts, loading, error, refresh: fetchAccounts, updateAccount, softDelete };
}
