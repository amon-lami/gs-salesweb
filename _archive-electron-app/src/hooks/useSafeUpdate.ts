// ============================================
// GS Sales CRM - Safe Update Hook (楽観的ロック)
// updated_atを比較して同時編集の衝突を防止
// ============================================

import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SafeUpdateResult } from '@/types/database';

interface UseSafeUpdateOptions {
  client: SupabaseClient | null;
}

export function useSafeUpdate({ client }: UseSafeUpdateOptions) {
  /**
   * 商談を安全に更新（楽観的ロック付き）
   * @returns SafeUpdateResult - success=false の場合はCONFLICTエラー
   */
  const safeUpdateDeal = useCallback(async (
    dealId: string,
    expectedUpdatedAt: string,
    updates: Record<string, unknown>,
  ): Promise<SafeUpdateResult> => {
    if (!client) throw new Error('Client not initialized');

    const { data, error } = await client.rpc('rpc_safe_update_deal', {
      p_deal_id: dealId,
      p_expected_updated_at: expectedUpdatedAt,
      p_updates: updates,
    });

    if (error) throw error;
    return data as SafeUpdateResult;
  }, [client]);

  /**
   * 取引先を安全に更新（楽観的ロック付き）
   */
  const safeUpdateAccount = useCallback(async (
    accountId: string,
    expectedUpdatedAt: string,
    updates: Record<string, unknown>,
  ): Promise<SafeUpdateResult> => {
    if (!client) throw new Error('Client not initialized');

    const { data, error } = await client.rpc('rpc_safe_update_account', {
      p_account_id: accountId,
      p_expected_updated_at: expectedUpdatedAt,
      p_updates: updates,
    });

    if (error) throw error;
    return data as SafeUpdateResult;
  }, [client]);

  return { safeUpdateDeal, safeUpdateAccount };
}
