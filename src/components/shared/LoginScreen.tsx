import { useState, type FormEvent } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('メールとパスワードを入力してください'); return; }
    setLoading(true); setError('');
    try {
      const client = await getSupabaseClient();
      const { error: ae } = await client.auth.signInWithPassword({ email, password });
      if (ae) throw ae;
      onLogin();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 340, boxShadow: '0 8px 30px rgba(0,0,0,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 4 }}>GS Sales</div>
          <div style={{ fontSize: 12, color: '#999' }}>Global Stride 営業管理システム</div>
        </div>
        <form onSubmit={handleLogin}>
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3 }}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: '#999', marginBottom: 3 }}>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, outline: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }}
          />
          {error && <div style={{ fontSize: 11, color: '#c00', marginBottom: 10 }}>{error}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '9px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#111', color: '#fff', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
