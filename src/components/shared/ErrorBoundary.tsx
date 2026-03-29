import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#9888;&#65039;</div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
            エラーが発生しました
          </h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16, maxWidth: 500, margin: '0 auto 16px' }}>
            {this.state.error?.message || '予期しないエラー'}
          </p>
          <details style={{ textAlign: 'left', maxWidth: 500, margin: '0 auto 16px', fontSize: 11, color: '#999' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 4 }}>詳細</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f5f5f5', padding: 10, borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
              {this.state.error?.stack || ''}
              {'\n'}
              {this.state.errorInfo?.componentStack || ''}
            </pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            style={{ padding: '8px 20px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#1a1a1a', color: '#fff', marginRight: 8 }}
          >
            再試行
          </button>
          <button
            onClick={() => location.reload()}
            style={{ padding: '8px 20px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#333' }}
          >
            ページを再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
