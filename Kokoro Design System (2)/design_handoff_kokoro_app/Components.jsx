/* Components.jsx — Kokoro UI kit components, all small + reusable */

const { useState, useEffect, useRef } = React;

/* ---------- Atoms ---------- */
function Stepper({ step }) {
  return (
    <div className="stepper">
      {[1,2,3,4,5,6,7,8].map(n => (
        <div key={n} className={"pip" + (n === step ? " active" : "")}>{String(n).padStart(2,'0')}</div>
      ))}
    </div>
  );
}

function TopRow({ onBack, title, right }) {
  return (
    <div className="top-row">
      {onBack ? <button className="back-btn" onClick={onBack}>← Back</button> : <span />}
      {title && <span className="top-title">{title}</span>}
      {right || <span />}
    </div>
  );
}

function Eyebrow({ children, align }) {
  return <span className={"eyebrow" + (align==="left" ? " left" : "")}>{children}</span>;
}

function KanjiBg({ items }) {
  return <>{items.map((it,i) => (
    <span key={i} className="kanji-bg" style={it.style}>{it.ch}</span>
  ))}</>;
}

function Cta({ children, onClick, variant, className }) {
  return <button className={"cta " + (variant||"") + " " + (className||"")} onClick={onClick}>{children}</button>;
}

function Chip({ selected, onClick, children, dot }) {
  return (
    <button className={"chip" + (selected?" sel":"")} onClick={onClick}>
      {dot && <span className="dot" />}
      {children}
    </button>
  );
}

function ShapeCard({ glyph, eyebrow, title, desc, selected, onClick }) {
  return (
    <button className={"shape-card" + (selected?" sel":"")} onClick={onClick}>
      <div className="glyph">{glyph}</div>
      <div style={{flex:1}}>
        <div className="row-eyebrow">{eyebrow}</div>
        <div className="row-title">{title}</div>
        <div className="row-desc">{desc}</div>
      </div>
    </button>
  );
}

function VoiceTile({ name, meta, selected, onClick }) {
  return (
    <button className={"voice-tile" + (selected?" sel":"")} onClick={onClick}>
      <div className="play">▶</div>
      <div>
        <div className="name">{name}</div>
        <div className="meta">{meta}</div>
      </div>
    </button>
  );
}

function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs">
      {options.map(o => (
        <button key={o} className={"tab" + (value===o?" active":"")} onClick={()=>onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function MicVisualiser({ recording, seconds }) {
  const bars = Array.from({length:36}, (_,i)=>{
    const h = recording ? 4 + Math.abs(Math.sin(i*0.7 + seconds*2))*10 : 2;
    return <div key={i} className="b" style={{height: h+"px"}} />;
  });
  return (
    <div className="mic-stack">
      <div className="mic-rings">
        <div className="ring r1" />
        <div className="ring r2" />
        <div className="ring r3" />
        <button className={"mic-btn" + (recording?" recording":"")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>
          </svg>
        </button>
      </div>
      <div className="waveform">{bars}</div>
      <div className="timer">{formatTime(seconds)} · {recording ? "listening" : "paused"}</div>
    </div>
  );
}
function formatTime(s){const m=Math.floor(s/60);const ss=s%60;return String(m).padStart(2,'0')+":"+String(ss).padStart(2,'0');}

Object.assign(window, { Stepper, TopRow, Eyebrow, KanjiBg, Cta, Chip, ShapeCard, VoiceTile, Tabs, MicVisualiser });
