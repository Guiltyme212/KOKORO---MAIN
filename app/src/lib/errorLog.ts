// Crash logger shared by the ErrorBoundary (render crashes) and the global
// window error/unhandledrejection handlers. Records to localStorage (so a
// "just goes blank" report leaves an inspectable trace even off-device) and to
// console.error (which main.tsx does NOT silence in the PROD console guard).
// Must never throw itself.

export type CapturedError = {
  stage: string;
  message: string;
  stack?: string;
  componentStack?: string;
  at: string;
  route: string;
  ua: string;
};

export function recordError(stage: string, error: unknown, componentStack?: string): void {
  try {
    const payload: CapturedError = {
      stage,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack,
      at: new Date().toISOString(),
      route: typeof window !== 'undefined' ? window.location.hash : '',
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };
    try {
      localStorage.setItem('kokoro_last_error', JSON.stringify(payload));
    } catch {
      /* storage unavailable — still log below */
    }
    (window as unknown as { __kokoroLastError?: CapturedError }).__kokoroLastError = payload;
    console.error('[kokoro:error]', stage, payload.message, payload.stack ?? '', componentStack ?? '');
  } catch {
    /* diagnostics must never make things worse */
  }
}
