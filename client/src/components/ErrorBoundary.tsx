import { Component, type ReactNode } from 'react';
import { T, RADIUS } from '@/tokens';
import { captureException } from '@/lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureException(error);
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: T.bg,
          color: T.text,
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: T.card,
            border: `1px solid ${T.border}`,
            borderRadius: RADIUS.card,
            padding: 28,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(201,84,84,0.12)',
              color: T.red,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 900,
              margin: '0 auto 16px',
            }}
          >
            !
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.5, marginBottom: 20 }}>
            We&rsquo;ve been notified and are looking into it. You can try again or
            reload the page.
          </div>
          <button
            onClick={this.reset}
            style={{
              background: T.accent,
              color: T.bg,
              border: 'none',
              borderRadius: RADIUS.pill,
              padding: '10px 22px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
