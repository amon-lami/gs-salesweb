// ============================================
// GS Sales CRM - Auth Hook
// 認証 + プロフィール + 全ユーザー一覧
// ============================================

import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppUser } from '@/types/database';

type AuthStatus = 'loading' | 'ready' | 'needSetup' | 'error';

interface UseAuthOptions {
  client: SupabaseClient | null;
}

interface UseAuthReturn {
  user: AppUser | null;
  allUsers: AppUser[];
  status: AuthStatus;
  error: string | null;
  refreshUsers: () => Promise<void>;
}

export function useAuth({ client }: UseAuthOptions): UseAuthReturn {
  const [user, setUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!client) return;
    try {
      const { data } = await client.from('profiles').select('*');
      setAllUsers((data as AppUser[]) || []);
    } catch { /* profiles is non-critical */ }
  }, [client]);

  useEffect(() => {
    if (!client) return;

    async function init() {
      try {
        // セッション確認
        const { data: { session } } = await client!.auth.getSession();

        if (!session) {
          // Electron環境: 保存済みのメール/パスワードで自動ログイン
          if (typeof window !== 'undefined' && 'api' in window) {
            const config = await (window as any).api.getConfig();
            if (config.email && config.password) {
              const { data, error: authErr } = await client!.auth.signInWithPassword({
                email: config.email,
                password: config.password,
              });
              if (authErr || !data.session) {
                setStatus('needSetup');
                setError('ログイン情報を設定してください');
                return;
              }
            } else {
              setStatus('needSetup');
              setError('ログイン情報を設定してください');
              return;
            }
          } else {
            setStatus('needSetup');
            setError('ログインが必要です');
            return;
          }
        }

        // ユーザー情報取得
        const { data: { user: authUser } } = await client!.auth.getUser();
        if (authUser) {
          const { data: profile } = await client!
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();

          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.user_metadata?.name,
            avatar_url: profile?.avatar_url,
          });
        }

        // 全ユーザー一覧
        await fetchUsers();
        setStatus('ready');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '初期化に失敗しました');
        setStatus('error');
      }
    }

    init();
  }, [client, fetchUsers]);

  return { user, allUsers, status, error, refreshUsers: fetchUsers };
}
