import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { recordError } from '../lib/errorLog';

type Props = { children: ReactNode };
type State = { error: Error | null };

function RecoveryScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: '32px 28px',
        textAlign: 'center',
        background: 'var(--k3-cream, #F6EBD7)',
        color: '#3a3327',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        zIndex: 99999,
      }}
    >
      <div style={{ fontSize: 44, lineHeight: 1 }} aria-hidden="true">🍃</div>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Let&rsquo;s take a breath</h2>
      <p style={{ margin: 0, maxWidth: 320, fontSize: 16, lineHeight: 1.45, opacity: 0.85 }}>
        Something interrupted us for a moment. Your progress is safe — tap below and
        we&rsquo;ll pick right back up.
      </p>
      <button
        type="button"
        onClick={onContinue}
        style={{
          marginTop: 6,
          padding: '14px 34px',
          fontSize: 17,
          fontWeight: 700,
          color: '#fff',
          background: '#566246',
          border: 'none',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        Continue
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordError('react-render', error, info.componentStack ?? undefined);
    // If the crash happened before App's mount effect ran initNative(), the
    // native splash (launchAutoHide:false) is still up and would cover this
    // recovery screen — leaving the user on a blank-looking splash. Force-hide
    // it so the recovery UI is always visible.
    void SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});
  }

  private handleContinue = () => {
    // Recover to a known-safe screen BEFORE clearing the error, so resetting
    // does not immediately re-render the same crashing route and re-throw.
    try {
      if (window.location.hash && window.location.hash !== '#home') {
        window.location.hash = '#home';
      }
    } catch {
      /* ignore */
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <RecoveryScreen onContinue={this.handleContinue} />;
    }
    return this.props.children;
  }
}
