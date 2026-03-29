// ============================================
// GS Sales CRM - Supabase Client
// ============================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Supabaseクライアントを初期化または取得
 * Electron版: window.api.getConfig() から取得
 * Web版: 環境変数から取得
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (client) return client;

  let url: string;
  let key: string;

  // Electron環境の場合
  if (typeof window !== 'undefined' && 'api' in window) {
    const config = await (window as any).api.getConfig();
    url = config.supabaseUrl;
    key = config.supabaseKey;
  } else {
    // Web環境の場合
    url = import.meta.env.VITE_SUPABASE_URL;
    key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  }

  if (!url || !key) {
    throw new Error('Supabase設定が見つかりません');
  }

  client = createClient(url, key);
  return client;
}

/**
 * 既存のクライアントを返す（初期化済みの場合のみ）
 */
export function getClient(): SupabaseClient | null {
  return client;
}
