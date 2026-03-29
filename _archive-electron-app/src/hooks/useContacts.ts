// ============================================
// GS Sales CRM - Contacts Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Contact } from '@/types/database';

interface UseContactsOptions {
  client: SupabaseClient | null;
}

export function useContacts({ client }: UseContactsOptions) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await client
        .from('sales_contacts')
        .select('*')
        .is('deleted_at', null);
      if (e) throw e;
      setContacts((data as Contact[]) || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'コンタクトの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const createContact = useCallback(async (contact: Partial<Contact>) => {
    if (!client) return;
    const { error: e } = await client.from('sales_contacts').insert(contact);
    if (e) throw e;
    await fetchContacts();
  }, [client, fetchContacts]);

  const updateContact = useCallback(async (id: string, updates: Partial<Contact>) => {
    if (!client) return;
    const { error: e } = await client.from('sales_contacts').update(updates).eq('id', id);
    if (e) throw e;
    await fetchContacts();
  }, [client, fetchContacts]);

  const softDelete = useCallback(async (id: string) => {
    if (!client) return;
    const { error: e } = await client
      .from('sales_contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (e) throw e;
    await fetchContacts();
  }, [client, fetchContacts]);

  return { contacts, loading, error, refresh: fetchContacts, createContact, updateContact, softDelete };
}
