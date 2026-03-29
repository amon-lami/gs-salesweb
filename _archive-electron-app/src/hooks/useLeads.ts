// ============================================
// GS Sales CRM - Leads Hook
// リードデータの取得・CRUD・RPC変換
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, ConvertLeadResult } from '@/types/database';

interface UseLeadsOptions {
  client: SupabaseClient | null;
}

interface UseLeadsReturn {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createLead: (lead: Partial<Lead>) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  convertToAccount: (leadId: string, userId: string) => Promise<ConvertLeadResult>;
}

export function useLeads({ client }: UseLeadsOptions): UseLeadsReturn {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await client
        .from('sales_leads')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (e) throw e;
      setLeads((data as Lead[]) || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'リードの取得に失敗しました';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const createLead = useCallback(async (lead: Partial<Lead>) => {
    if (!client) return;
    const { error: e } = await client.from('sales_leads').insert(lead);
    if (e) throw e;
    await fetchLeads();
  }, [client, fetchLeads]);

  const updateLead = useCallback(async (id: string, updates: Partial<Lead>) => {
    if (!client) return;
    const { error: e } = await client.from('sales_leads').update(updates).eq('id', id);
    if (e) throw e;
    await fetchLeads();
  }, [client, fetchLeads]);

  const softDelete = useCallback(async (id: string) => {
    if (!client) return;
    const { error: e } = await client
      .from('sales_leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (e) throw e;
    await fetchLeads();
  }, [client, fetchLeads]);

  // RPC: リード → 取引先+商談 トランザクション変換
  const convertToAccount = useCallback(async (leadId: string, userId: string): Promise<ConvertLeadResult> => {
    if (!client) throw new Error('Client not initialized');
    const { data, error: e } = await client.rpc('rpc_convert_lead_to_deal', {
      p_lead_id: leadId,
      p_user_id: userId,
    });
    if (e) throw e;
    await fetchLeads();
    return data as ConvertLeadResult;
  }, [client, fetchLeads]);

  return { leads, loading, error, refresh: fetchLeads, createLead, updateLead, softDelete, convertToAccount };
}
