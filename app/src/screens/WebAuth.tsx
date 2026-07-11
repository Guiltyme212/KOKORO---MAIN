import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, Download, Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { Route } from '../lib/router';
import { webAuthApi, useWebAuth } from '../state/webAuth';
import { pwaApi, usePwa, clearInstallOffer } from '../state/pwa';
import { hasCompletedLocalProfile } from '../lib/profile';
import { answersApi } from '../state/answers';
import { personaApi } from '../state/persona';
import './WebAuth.css';

type ScreenProps = { goto: (route: Route) => void };

const TURNSTILE_SITE_KEY = (
  import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
)?.trim() ?? '';

type TurnstileApi = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="web-auth-screen">
      <section className="web-auth-card">
        <div className="web-auth-mark" aria-hidden="true">こ</div>
        {children}
      </section>
    </main>
  );
}

function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !host.current) return;
    let widgetId = '';
    let canceled = false;
    const render = () => {
      if (canceled || !host.current || !window.turnstile) return;
      widgetId = window.turnstile.render(host.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-kokoro-turnstile]');
    if (window.turnstile) render();
    else if (existing) existing.addEventListener('load', render, { once: true });
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.kokoroTurnstile = 'true';
      script.addEventListener('load', render, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      canceled = true;
      if (existing) existing.removeEventListener('load', render);
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div className="web-auth-turnstile" ref={host} />;
}

export function LoginScreen({ goto }: ScreenProps) {
  const auth = useWebAuth();
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(auth.error);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim()) return;
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Complete the security check first.');
      return;
    }
    setBusy(true);
    try {
      await webAuthApi.requestCode(email, captchaToken || undefined);
      goto('verifyEmail');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <p className="web-auth-eyebrow">Kokoro membership</p>
      <h1>Welcome back.</h1>
      <p className="web-auth-copy">Enter the email you used when you purchased Kokoro.</p>
      <form onSubmit={submit} className="web-auth-form">
        <label htmlFor="kokoro-login-email">Email</label>
        <input
          id="kokoro-login-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <Turnstile onToken={setCaptchaToken} />
        {error && <p className="web-auth-error" role="alert">{error}</p>}
        <button className="web-auth-primary" disabled={busy}>
          {busy ? <Loader2 className="web-auth-spin" size={20} /> : 'Send code'}
        </button>
      </form>
      <p className="web-auth-note">We’ll send a six-digit code. No password needed.</p>
    </AuthShell>
  );
}
export function VerifyEmailScreen({ goto }: ScreenProps) {
  const auth = useWebAuth();
  const [otp, setOtp] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await webAuthApi.verifyCode(otp);
      goto('checkingAccess');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'That code could not be verified.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    if (!auth.handoffToken && TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Complete the security check first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await webAuthApi.resendCode(captchaToken || undefined);
      setSeconds(60);
      setCaptchaToken('');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const destination = auth.maskedEmail || auth.pendingEmail;
  return (
    <AuthShell>
      <button className="web-auth-back" onClick={() => {
        webAuthApi.beginEmailLogin();
        goto('login');
      }} aria-label="Change email">
        <ArrowLeft size={20} />
      </button>
      <p className="web-auth-eyebrow">Check your inbox</p>
      <h1>Enter your code.</h1>
      <p className="web-auth-copy">We sent a six-digit code to <strong>{destination}</strong>.</p>
      <form onSubmit={verify} className="web-auth-form">
        <label htmlFor="kokoro-login-code">Six-digit code</label>
        <input
          id="kokoro-login-code"
          className="web-auth-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          autoFocus
        />
        {!auth.handoffToken && seconds === 0 && <Turnstile onToken={setCaptchaToken} />}
        {error && <p className="web-auth-error" role="alert">{error}</p>}
        <button className="web-auth-primary" disabled={busy || otp.length !== 6}>
          {busy ? <Loader2 className="web-auth-spin" size={20} /> : 'Continue'}
        </button>
      </form>
      <button className="web-auth-link" onClick={resend} disabled={busy || seconds > 0}>
        {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
      </button>
      <button className="web-auth-link" onClick={() => {
        webAuthApi.beginEmailLogin();
        goto('login');
      }}>Change email</button>
    </AuthShell>
  );
}

export function CheckingAccessScreen() {
  return (
    <AuthShell>
      <Loader2 className="web-auth-spin web-auth-large-spin" size={34} />
      <h1>Checking access…</h1>
      <p className="web-auth-copy">This usually takes just a moment.</p>
    </AuthShell>
  );
}

export function AccessRequiredScreen({ goto }: ScreenProps) {
  const auth = useWebAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const unavailable = auth.status === 'accessError';
  const purchaseUrl = auth.access?.purchaseUrl ?? 'https://kokoromind.com/funnel/standard/';
  const manageUrl = auth.access?.manageUrl ?? 'https://kokoromind.com/manage';

  const refresh = async () => {
    setBusy(true);
    setError('');
    try {
      await webAuthApi.checkAccess(true);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh access.');
    } finally {
      setBusy(false);
    }
  };

  const useAnotherEmail = async () => {
    setBusy(true);
    try {
      await webAuthApi.signOut();
      goto('login');
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <p className="web-auth-eyebrow">{unavailable ? 'Temporary issue' : 'Membership required'}</p>
      <h1>{unavailable ? 'We couldn’t check your access.' : 'Kokoro access isn’t active.'}</h1>
      <p className="web-auth-copy">
        {unavailable
          ? 'Your account is signed in. Try the access check again in a moment.'
          : 'Use the email connected to an active Kokoro subscription, or get access on our website.'}
      </p>
      {auth.session?.email && <p className="web-auth-signed-in">Signed in as {auth.session.email}</p>}
      {(error || auth.error) && <p className="web-auth-error" role="alert">{error || auth.error}</p>}
      <div className="web-auth-actions">
        {!unavailable && <a className="web-auth-primary" href={purchaseUrl}>Get access</a>}
        <a className="web-auth-secondary" href={manageUrl}>Manage subscription</a>
        <button className="web-auth-secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={18} className={busy ? 'web-auth-spin' : ''} /> Refresh access
        </button>
        <button className="web-auth-link" onClick={useAnotherEmail} disabled={busy}>
          Sign in with another email
        </button>
        <button className="web-auth-link" onClick={useAnotherEmail} disabled={busy}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </AuthShell>
  );
}

export function InstallAppScreen({ goto }: ScreenProps) {
  const pwa = usePwa();
  const [busy, setBusy] = useState(false);

  const proceed = () => {
    clearInstallOffer();
    goto(hasCompletedLocalProfile(answersApi.getSnapshot(), personaApi.getSnapshot())
      ? 'home'
      : 'welcome');
  };

  const install = async () => {
    setBusy(true);
    try {
      await pwaApi.install();
    } finally {
      setBusy(false);
      proceed();
    }
  };

  return (
    <AuthShell>
      <p className="web-auth-eyebrow">You're in</p>
      <h1>Install Kokoro on your phone.</h1>
      <p className="web-auth-copy">
        One tap puts Kokoro on your home screen — full screen, no browser bars,
        always a tap away.
      </p>
      {!pwa.canInstall && (
        <p className="web-auth-copy">
          In your browser menu choose <strong>“Add to Home screen”</strong> —
          or continue in the browser below.
        </p>
      )}
      <div className="web-auth-actions">
        {pwa.canInstall && (
          <button className="web-auth-primary" onClick={() => void install()} disabled={busy}>
            <Download size={18} /> Install the app
          </button>
        )}
        <button className="web-auth-link" onClick={proceed} disabled={busy}>
          Continue in browser
        </button>
      </div>
    </AuthShell>
  );
}
