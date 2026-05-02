import { useState, type ReactNode, type CSSProperties } from 'react';

/**
 * Subtle ambient persimmon glow background.
 * Two radial gradients — one centered, one bottom-anchored.
 */
export function Glow({ intensity = 0.16 }: { intensity?: number }) {
  return (
    <>
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(60% 50% at 50% 30%, rgba(200,76,43,${intensity}) 0%, transparent 65%)`,
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(50% 40% at 50% 100%, rgba(200,76,43,${intensity * 0.6}) 0%, transparent 70%)`,
        }}
      />
    </>
  );
}

/**
 * Top chrome — left slot, mono center label, right slot.
 * If `onBack` is given without `left`, renders a default back button.
 */
export function TopBar({
  left,
  center,
  right,
  onBack,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '56px 24px 0', height: 56, gap: 12,
    }}>
      <div style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-start' }}>
        {left ?? (onBack ? (
          <button
            onClick={onBack}
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            ← Back
          </button>
        ) : null)}
      </div>
      <div style={{
        flex: 1, textAlign: 'center',
        fontFamily: 'var(--mono)', fontSize: 9.5,
        letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--stone)',
      }}>
        {center}
      </div>
      <div style={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

/**
 * Small uppercase mono label — eyebrow over a heading.
 */
export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.28em', textTransform: 'uppercase',
      color: color ?? 'var(--persimmon)',
    }}>
      {children}
    </div>
  );
}

/**
 * Large serif display heading. Italic by default.
 */
export function Display({
  children,
  size = 44,
  italic = true,
}: {
  children: ReactNode;
  size?: number;
  italic?: boolean;
}) {
  return (
    <h1 style={{
      fontFamily: 'var(--serif)',
      fontStyle: italic ? 'italic' : 'normal',
      fontWeight: 300,
      fontSize: size, lineHeight: 1.05, letterSpacing: -0.7,
      margin: 0, color: 'var(--washi)',
      textWrap: 'balance',
    }}>
      {children}
    </h1>
  );
}

/**
 * Persimmon pill (default) or ghost-bordered pill button.
 */
export function Btn({
  children,
  onClick,
  ghost,
  dim,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  ghost?: boolean;
  dim?: boolean;
  full?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const base: CSSProperties = {
    appearance: 'none',
    fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500,
    letterSpacing: '0.18em', textTransform: 'uppercase',
    padding: '17px 28px',
    borderRadius: 100,
    transition: 'all 240ms var(--ease)',
    width: full ? '100%' : 'auto',
  };
  const style: CSSProperties = ghost
    ? {
        ...base,
        background: 'transparent',
        border: '1px solid rgba(244,239,230,0.25)',
        color: dim ? 'var(--stone)' : 'var(--washi)',
      }
    : {
        ...base,
        background: hover ? '#a83e22' : 'var(--persimmon)',
        border: 'none',
        color: 'var(--washi)',
        boxShadow: hover
          ? '0 12px 40px rgba(200,76,43,0.35)'
          : '0 6px 20px rgba(200,76,43,0.25)',
      };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={style}
    >
      {children}
    </button>
  );
}
