// ============================================
// GS Sales CRM - Master Data Hook
// マスターテーブル（stages, shipping, currencies, roles）
// テーブルが存在しない場合もエラーにならない設計
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MasterStage, MasterShippingType, MasterCurrency,
  MasterLeadStatus, UserRoleRow, UserRole,
} from '@/types/database';

interface UseMasterDataOptions {
  client: SupabaseClient | null;
  userId: string | null;
}

export function useMasterData({ client, userId }: UseMasterDataOptions) {
  const [masterStages, setMasterStages] = useState<MasterStage[]>([]);
  const [masterShipping, setMasterShipping] = useState<MasterShippingType[]>([]);
  const [masterCurrencies, setMasterCurrencies] = useState<MasterCurrency[]>([]);
  const [masterLeadStatuses, setMasterLeadStatuses] = useState<MasterLeadStatus[]>([]);
  const [myRole, setMyRole] = useState<UserRole>('member');
  const [loaded, setLoaded] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!client) return;

    // 各マスタを個別にtry-catchで取得（テーブルがなくてもOK）
    const safeFetch = async <T>(table: string, options?: { eq?: [string, unknown]; order?: string }): Promise<T[]> => {
      try {
        let query = client.from(table).select('*');
        if (options?.eq) query = query.eq(options.eq[0], options.eq[1]);
        if (options?.order) query = query.order(options.order);
        const { data } = await query;
        return (data as T[]) || [];
      } catch {
        return [];
      }
    };

    const [stages, shipping, currencies, leadStatuses, roles] = await Promise.all([
      safeFetch<MasterStage>('master_stages', { eq: ['is_active', true], order: 'sort_order' }),
      safeFetch<MasterShippingType>('master_shipping_types', { eq: ['is_active', true], order: 'sort_order' }),
      safeFetch<MasterCurrency>('master_currencies', { eq: ['is_active', true], order: 'sort_order' }),
      safeFetch<MasterLeadStatus>('master_lead_statuses', { eq: ['is_active', true], order: 'sort_order' }),
      safeFetch<UserRoleRow>('user_roles'),
    ]);

    if (stages.length > 0) setMasterStages(stages);
    if (shipping.length > 0) setMasterShipping(shipping);
    if (currencies.length > 0) setMasterCurrencies(currencies);
    if (leadStatuses.length > 0) setMasterLeadStatuses(leadStatuses);

    if (userId && roles.length > 0) {
      const me = roles.find(r => r.user_id === userId);
      if (me) setMyRole(me.role);
    }

    setLoaded(true);
  }, [client, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return {
    masterStages, masterShipping, masterCurrencies, masterLeadStatuses,
    myRole, loaded, refresh: fetchAll,
    isAdmin: myRole === 'admin',
    isManagerOrAbove: myRole === 'admin' || myRole === 'manager',
  };
}
