import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warn';
type ShowToast = (msg: string, type?: ToastType) => void;

interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}

const ToastCtx = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show: ShowToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    const dur = type === 'success' ? 3500 : type === 'error' ? 5000 : 3000;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), dur);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div
            key={t.id}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              animation: 'fadeIn .2s',
              maxWidth: 320,
              background: t.type === 'error' ? '#ef4444' : t.type === 'warn' ? '#f59e0b' : '#22c55e',
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = (): ShowToast => useContext(ToastCtx);
