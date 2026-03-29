// ============================================
// GS Sales CRM - Layout Component
// ヘッダー + 52pxアイコンサイドバー + メインコンテンツ
// モバイル対応（768px以下でボトムナビ）
// ============================================

import React, { memo, useState, useEffect } from 'react';
import { T, IS_MOBILE } from '@/lib/constants';

export type Page = 'home' | 'deals' | 'accounts' | 'contacts' | 'leads' | 'reports' | 'settings' | 'todos' | 'expenses' | 'documents' | 'chat';

interface LayoutProps {
  page: Page;
  onPageChange: (page: Page) => void;
  userName?: string;
  chatUnread?: number;
  children: React.ReactNode;
}

const ini = (name?: string) => name ? name.charAt(0).toUpperCase() : '?';

const NAV_ITEMS: { id: Page; icon: React.ReactNode; label: string }[] = [
  { id: 'home', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="8" width="3" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3"/><rect x="6.5" y="4" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.3"/><rect x="12" y="1" width="3" height="13" rx="0.5" stroke="currentColor" strokeWidth="1.3"/></svg>
  ), label: 'ホーム' },
  { id: 'deals', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M4 3V2a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.2"/></svg>
  ), label: '商談' },
  { id: 'accounts', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  ), label: '取引先' },
  { id: 'contacts', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
  ), label: 'コンタクト' },
  { id: 'leads', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
  ), label: 'リード' },
  { id: 'reports', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 9h6M5 12h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  ), label: 'レポート' },
  { id: 'todos', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ), label: 'ToDo' },
  { id: 'expenses', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4v8M6 6h4M6 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
  ), label: '経費' },
  { id: 'documents', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v4h4" stroke="currentColor" strokeWidth="1.2"/></svg>
  ), label: '書類' },
  { id: 'chat', icon: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3V3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ), label: 'チャット' },
];

const MOBILE_NAV: Page[] = ['home', 'deals', 'chat', 'expenses', 'settings'];

export const Layout = memo(function Layout({ page, onPageChange, userName, chatUnread, children }: LayoutProps) {
  const [isMobile, setIsMobile] = useState(IS_MOBILE);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif" }}>
        {/* Mobile Header */}
        <div style={{
          height: 42, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#fff', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.primary }}>GS Sales</span>
          {userName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{ini(userName)}</div>
            </div>
          )}
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: T.bg }}>{children}</div>
        {/* Bottom Nav */}
        <div style={{
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          height: 56, background: '#fff', borderTop: `1px solid ${T.border}`,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {MOBILE_NAV.map(navId => {
            const nav = navId === 'settings'
              ? { id: 'settings' as Page, icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M8.325 3.15c.37-1.533 2.533-1.533 2.903 0a1.493 1.493 0 002.234.92c1.31-.794 2.81.706 2.016 2.016a1.493 1.493 0 00.92 2.234c1.533.37 1.533 2.533 0 2.903a1.493 1.493 0 00-.92 2.234c.794 1.31-.706 2.81-2.016 2.016a1.493 1.493 0 00-2.234.92c-.37 1.533-2.533 1.533-2.903 0a1.493 1.493 0 00-2.234-.92c-1.31.794-2.81-.706-2.016-2.016a1.493 1.493 0 00-.92-2.234c-1.533-.37-1.533-2.533 0-2.903a1.493 1.493 0 00.92-2.234C2.78 4.63 4.28 3.13 5.59 3.924a1.493 1.493 0 002.234-.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.776" cy="9.776" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>, label: '設定' }
              : NAV_ITEMS.find(n => n.id === navId)!;
            return (
              <button key={nav.id} onClick={() => onPageChange(nav.id)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '6px 0', border: 'none', background: 'transparent', cursor: 'pointer', color: page === nav.id ? T.primary : T.muted, fontSize: 9, fontWeight: 600, fontFamily: 'inherit', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  {nav.icon}
                  {nav.id === 'chat' && (chatUnread || 0) > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -8, minWidth: 14, height: 14, borderRadius: 7, background: T.red, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                      {(chatUnread || 0) > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </div>
                <span>{nav.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* Header */}
      <div style={{
        height: 38, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.primary }}>GS Sales</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {/* 検索ボタン */}
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5,
            border: `1px solid ${T.border}`, background: '#f9f9f9', cursor: 'pointer', color: T.muted, fontSize: 10, fontFamily: 'inherit',
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <span>検索</span>
            <span style={{ fontSize: 9, color: '#ccc', marginLeft: 4 }}>⌘K</span>
          </button>
          {/* ユーザーアバター */}
          {userName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 2 }}>
              <div style={{
                width: 16, height: 16, borderRadius: 4, background: T.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff',
              }}>{ini(userName)}</div>
              <span style={{ fontSize: 10, color: T.sub, fontWeight: 500 }}>{userName}</span>
            </div>
          )}
          {/* 設定ギア */}
          <button onClick={() => onPageChange('settings')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4,
            border: `1px solid ${T.border}`, background: '#fff', cursor: 'pointer', color: '#bbb', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M8.325 3.15c.37-1.533 2.533-1.533 2.903 0a1.493 1.493 0 002.234.92c1.31-.794 2.81.706 2.016 2.016a1.493 1.493 0 00.92 2.234c1.533.37 1.533 2.533 0 2.903a1.493 1.493 0 00-.92 2.234c.794 1.31-.706 2.81-2.016 2.016a1.493 1.493 0 00-2.234.92c-.37 1.533-2.533 1.533-2.903 0a1.493 1.493 0 00-2.234-.92c-1.31.794-2.81-.706-2.016-2.016a1.493 1.493 0 00-.92-2.234c-1.533-.37-1.533-2.533 0-2.903a1.493 1.493 0 00.92-2.234C2.78 4.63 4.28 3.13 5.59 3.924a1.493 1.493 0 002.234-.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.776" cy="9.776" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar (52px icon style) */}
        <div style={{
          width: 52, minWidth: 52, background: T.card, borderRight: `1px solid ${T.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 2,
        }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, overflowY: 'auto' }}>
            {NAV_ITEMS.map(nav => (
              <button
                key={nav.id}
                onClick={() => onPageChange(nav.id)}
                style={{
                  width: 44, padding: '6px 0', borderRadius: 6, border: 'none',
                  background: page === nav.id ? T.primary : 'transparent',
                  color: page === nav.id ? '#fff' : T.muted,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 2, fontSize: 8.5, fontWeight: 600, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ position: 'relative' }}>
                  {nav.icon}
                  {nav.id === 'chat' && (chatUnread || 0) > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: T.red, color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', lineHeight: 1 }}>
                      {(chatUnread || 0) > 99 ? '99+' : chatUnread}
                    </span>
                  )}
                </div>
                <span>{nav.label}</span>
              </button>
            ))}
          </div>
          {/* 設定ボタン（下部） */}
          <button
            onClick={() => onPageChange('settings')}
            style={{
              width: 44, padding: '6px 0', borderRadius: 6, border: 'none',
              background: page === 'settings' ? T.primary : 'transparent',
              color: page === 'settings' ? '#fff' : T.muted, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, fontSize: 8.5, fontWeight: 600, fontFamily: 'inherit', marginBottom: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M8.325 3.15c.37-1.533 2.533-1.533 2.903 0a1.493 1.493 0 002.234.92c1.31-.794 2.81.706 2.016 2.016a1.493 1.493 0 00.92 2.234c1.533.37 1.533 2.533 0 2.903a1.493 1.493 0 00-.92 2.234c.794 1.31-.706 2.81-2.016 2.016a1.493 1.493 0 00-2.234.92c-.37 1.533-2.533 1.533-2.903 0a1.493 1.493 0 00-2.234-.92c-1.31.794-2.81-.706-2.016-2.016a1.493 1.493 0 00-.92-2.234c-1.533-.37-1.533-2.533 0-2.903a1.493 1.493 0 00.92-2.234C2.78 4.63 4.28 3.13 5.59 3.924a1.493 1.493 0 002.234-.92z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9.776" cy="9.776" r="2.5" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>設定</span>
          </button>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: T.bg }}>
          {children}
        </div>
      </div>
    </div>
  );
});
