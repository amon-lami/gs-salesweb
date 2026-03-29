// ============================================
// GS Sales CRM - Chat Page (Full-page GS-Chat)
// chat-core.js の GSChat.ChatScreen を使用
// ============================================

import { createElement, useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Deal, Account, AppUser, Category } from '@/types/database';
import { T, IS_MOBILE } from '@/lib/constants';

interface Props {
  client: SupabaseClient;
  user: AppUser;
  allUsers: AppUser[];
  accounts: Account[];
  categories: Category[];
  deals: Deal[];
  onOpenDeal?: (dealId: string) => void;
}

declare global {
  interface Window {
    GSChat?: {
      ChatScreen: React.ComponentType<any>;
    };
  }
}

export function ChatPage({ client, user, allUsers, accounts, categories, onOpenDeal }: Props) {
  const [ready, setReady] = useState(!!window.GSChat?.ChatScreen);

  // chat-core.js が後から読み込まれる場合に備えてポーリング
  useEffect(() => {
    if (ready) return;
    const interval = setInterval(() => {
      if (window.GSChat?.ChatScreen) {
        setReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [ready]);

  const profile = allUsers.find(u => u.id === user.id);

  if (!ready) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: IS_MOBILE ? 'calc(100vh - 116px)' : '100%',
        color: T.muted,
        fontSize: 13,
      }}>
        チャット読み込み中...
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflow: 'hidden',
      height: IS_MOBILE ? 'calc(100vh - 116px)' : '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {createElement(window.GSChat!.ChatScreen, {
        supabase: client,
        user,
        profile,
        allUsers,
        accounts,
        categories,
        theme: T,
        compact: true,
        onOpenDeal: (dealInfo: { id: string }) => {
          if (onOpenDeal) {
            onOpenDeal(dealInfo.id);
          }
        },
      })}
    </div>
  );
}
