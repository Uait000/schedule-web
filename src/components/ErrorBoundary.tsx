import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  componentDidMount() {
    // Catch unhandled errors that happen OUTSIDE React render
    this._onError = (event: ErrorEvent) => {
      event.preventDefault();
      this.setState({ hasError: true, error: event.error || new Error(event.message) });
    };
    this._onUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      this.setState({ hasError: true, error: new Error(String(event.reason)) });
    };
    window.addEventListener('error', this._onError);
    window.addEventListener('unhandledrejection', this._onUnhandledRejection);
  }

  componentWillUnmount() {
    if (this._onError) window.removeEventListener('error', this._onError);
    if (this._onUnhandledRejection) window.removeEventListener('unhandledrejection', this._onUnhandledRejection);
  }

  private _onError: ((e: ErrorEvent) => void) | null = null;
  private _onUnhandledRejection: ((e: PromiseRejectionEvent) => void) | null = null;

  handleReload = () => {
    try { localStorage.removeItem('app_purge_ver'); } catch {}
    window.location.reload();
  };

  handleClearAndRestart = () => {
    try {
      localStorage.clear();
      if ('caches' in window) {
        caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs =>
          Promise.all(regs.map(r => r.unregister()))
        );
      }
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          fontFamily: 'Inter, -apple-system, sans-serif',
          background: 'var(--color-background, #1c1b1f)',
          color: 'var(--color-text, #e6e1e5)',
          textAlign: 'center',
          gap: '16px'
        }}>
          <span className="material-icons" style={{ fontSize: '64px', color: 'var(--color-primary, #d0bcff)', opacity: 0.8 }}>
            error_outline
          </span>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '22px' }}>Что-то пошло не так</h2>
          <p style={{ margin: 0, opacity: 0.6, fontSize: '14px', maxWidth: '300px' }}>
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          {this.state.error && (
            <details style={{ fontSize: '12px', opacity: 0.4, maxWidth: '400px', wordBreak: 'break-all' }}>
              <summary>Подробности ошибки</summary>
              <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
            </details>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '14px 28px',
                borderRadius: '16px',
                border: 'none',
                background: 'var(--color-primary, #6650a4)',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Обновить
            </button>
            <button
              onClick={this.handleClearAndRestart}
              style={{
                padding: '14px 28px',
                borderRadius: '16px',
                border: '2px solid var(--color-border, #333)',
                background: 'transparent',
                color: 'var(--color-text, #e6e1e5)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            >
              Сбросить кэш
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
