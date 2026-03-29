// ============================================
// GS Sales CRM - Deals Hook
// 商談データの取得・購読・CRUD操作
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, DealStage } from '@/types/database';

interface UseDealsOptions {
  client: SupabaseClient | null;
  /** ソフトデリート済みのレコードも含めるか */
  includeDeleted?: boolean;
}

interface UseDealsReturn {
  deals: Deal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  updateStage: (id: string, stage: DealStage) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
}

export function useDeals({ client, includeDeleted = false }: UseDealsOptions): UseDealsReturn {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);

    try {
      let query = client
        .from('sales_deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setDeals((data as Deal[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '商談の取得に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client, includeDeleted]);

  // 初回ロード
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // リアルタイム購読
  useEffect(() => {
    if (!client) return;

    const subscription = client
      .channel('deals-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_deals' }, () => {
        fetchDeals();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [client, fetchDeals]);

  const updateDeal = useCallback(async (id: string, updates: Partial<Deal>) => {
    if (!client) return;
    const { error: updateError } = await client
      .from('sales_deals')
      .update(updates)
      .eq('id', id);

    if (updateError) throw updateError;
    await fetchDeals();
  }, [client, fetchDeals]);

  const updateStage = useCallback(async (id: string, stage: DealStage) => {
    await updateDeal(id, { stage });
  }, [updateDeal]);

  const softDelete = useCallback(async (id: string) => {
    if (!client) return;
    const { error: deleteError } = await client
      .from('sales_deals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchDeals();
  }, [client, fetchDeals]);

  return { deals, loading, error, refresh: fetchDeals, updateDeal, updateStage, softDelete };
}
