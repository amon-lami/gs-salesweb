// ============================================
// GS Sales CRM - Categories Hook
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category } from '@/types/database';

interface UseCategoriesOptions {
  client: SupabaseClient | null;
}

export function useCategories({ client }: UseCategoriesOptions) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    try {
      const { data, error } = await client
        .from('sales_categories')
        .select('*')
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      setCategories((data as Category[]) || []);
    } catch {
      // カテゴリは補助データなので、エラーでもアプリを止めない
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const createCategory = useCallback(async (name: string, userId: string) => {
    if (!client) return;
    const { error } = await client.from('sales_categories').insert({ name: name.trim(), owner_id: userId });
    if (error) throw error;
    await fetchCategories();
  }, [client, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!client) return;
    const { error } = await client.from('sales_categories').delete().eq('id', id);
    if (error) throw error;
    await fetchCategories();
  }, [client, fetchCategories]);

  return { categories, loading, refresh: fetchCategories, createCategory, deleteCategory };
}
