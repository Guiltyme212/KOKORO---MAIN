/* ScreensV2.jsx — emotional redesign of key screens
   Targets: 01 Welcome, 02 Name, 04 Mode, 08 Reflect
   Philosophy:
     - Breath orb as the heart of every screen
     - One sentence per screen, big and italic
     - CTA cannot be missed: pulses, glows, larger
     - Every interaction leaves a trace (ripple, scale, glow)
*/

const { useState: useStateV2, useEffect: useEffectV2, useRef: useRefV2 } = React;

/* ---------- shared atoms ---------- */

function BreathOrb({ size = "lg", glyph = "心" }) {
  return (
    <div className={"orb " + (size === "sm" ? "orb-sm" : "")}>
      <div className="orb-haze"></div>
      <div className="orb-glow"></div>
      <div className="orb-ring"></div>
      <div className="orb-ring r2"></div>
      <div className="orb-ring r3"></div>
      <div className="orb-core"></div>
      <div className="orb-glyph">{glyph}</div>
    </div>
  );
}

function Aurora() {
  return <div className="aurora"></div>;
}

function CtaBig({ children, onClick }) {
  const ref = useRefV2(null);
  function handleClick(e) {
    // ripple
    const btn = ref.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = (e.clientX - rect.left) + "px";
      ripple.style.top = (e.clientY - rect.top) + "px";
      ripple.style.transform = "translate(-50%,-50%)";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }
    if (onClick) onClick(e);
  }
  return (
    <button ref={ref} className="cta-big" onClick={handleClick}>
      <span>{children}</span>
      <span className="arrow">→</span>
    </button>
  );
}

/* ============================================================
   01 WELCOME V2 — "the breath in cold air"
   - Aurora background drifting
   - Big breath orb center
   - One italic line: "Breathe out. I'm here."
   - Single bold CTA
   ============================================================ */

function ScreenWelcomeV2({ go }) {
  return (
    <div className="fade-in" style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <Aurora />

      {/* tiny header — barely there */}
      <div style={{ position: "absolute", top: 36, left: 0, right: 0, textAlign: "center", zIndex: 4 }}>
        <div style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 500,
          fontSize: 22, letterSpacing: ".4em", paddingLeft: ".4em",
          color: "var(--ink)", opacity: .9
        }}>KOKORO</div>
      </div>

      {/* center stack: orb + line + cta */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 40, zIndex: 3, padding: "0 32px"
      }}>
        <BreathOrb glyph="心" />

        <div className="stagger" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <h1 className="h-mega" style={{ textAlign: "center" }}>
            Breathe out.<br/>
            <span style={{ color: "#f4a06b" }}>I'm here.</span>
          </h1>
          <p className="whisper" style={{ maxWidth: 280, textAlign: "center" }}>
            90 seconds. One ritual. Just for tonight.
          </p>
        </div>
      </div>

      <CtaBig onClick={() => go()}>Begin</CtaBig>

      {/* Library — circular icon, top right, doesn't crowd the logo */}
      <button
        onClick={() => go("library")}
        aria-label="Library"
        style={{
          position: "absolute", top: 28, right: 28, zIndex: 5,
          width: 44, height: 44, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid rgba(243,236,227,.18)",
          background: "rgba(243,236,227,.06)",
          backdropFilter: "blur(8px)",
          color: "#e25a36",
          cursor: "pointer",
          transition: "all .25s var(--ease)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(225,118,68,.6)";
          e.currentTarget.style.background = "rgba(225,118,68,.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(243,236,227,.18)";
          e.currentTarget.style.background = "rgba(243,236,227,.06)";
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, textShadow: "0 0 8px rgba(225,90,54,.6)" }}>♥</span>
        {/* badge */}
        <span style={{
          position: "absolute", top: -4, right: -4,
          minWidth: 18, height: 18, padding: "0 5px",
          borderRadius: 999,
          background: "linear-gradient(180deg, #e25a36, #c84c2b)",
          color: "#fff8ef",
          fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,.4)",
        }}>3</span>
      </button>
    </div>
  );
}

/* ============================================================
   02 NAME V2 — intimate
   - Small orb at top
   - Big italic question
   - Names as warm tactile chips with selected state lighting up
   ============================================================ */

function ScreenNameV2({ go, back, mode = "raw" }) {
  const [picked, setPicked] = useStateV2(null);
  const [custom, setCustom] = useStateV2("");
  const [editing, setEditing] = useStateV2(false);

  // Names matched to each mode's voice + tone
  const byMode = {
    raw: {
      tag: "Gen Z · raw", echo: "#ff5530",
      h1: <>What's your <span style={{ color: "#ff5530" }}>handle?</span></>,
      sub: "no judgement. pick your alias.",
      names: ["Bestie", "Bro", "Babe", "Honey", "Зайчик", "Зай", "Котик", "Малыш", "Solnyshko"],
    },
    cosmic: {
      tag: "Spiritual · cosmic", echo: "#d4af37",
      h1: <>What's your <span style={{ color: "#d4af37" }}>true name?</span></>,
      sub: "the name your soul answers to.",
      names: ["Stardust", "Soul", "Light", "Dear one"],
    },
    iron: {
      tag: "Hard mode · iron", echo: "#c01a0c",
      h1: <>YOUR <span style={{ color: "#ff3a26" }}>NAME, SOLDIER?</span></>,
      sub: "no nicknames. earn it.",
      names: ["MONSTER", "CHAMPION", "BEAST", "SAVAGE", "MACHINE", "WARRIOR", "TITAN", "WOLF"],
    },
    zen: {
      tag: "Zen · 禅", echo: "#a89370",
      h1: <>What should I <span style={{ color: "#d4b78a" }}>call you?</span></>,
      sub: "a name spoken softly.",
      names: ["Friend", "Stillness", "Sweetheart", "My person"],
    },
    sleep: {
      tag: "Bedtime · 夢", echo: "#a8b8e0",
      h1: <>What name lulls <span style={{ color: "#a8b8e0" }}>you to sleep?</span></>,
      sub: "the one whispered at midnight.",
      names: ["Dreamer", "Moonlight", "Sweetheart", "Love"],
    },
  };
  const cfg = byMode[mode] || byMode.raw;
  const display = picked === "__custom" ? (custom || "your own") : picked;

  return (
    <div className="fade-in" style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <Aurora />

      <div style={{ position: "absolute", top: 32, left: 32, right: 32, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        <button className="lnk-soft" onClick={back}>← Back</button>
        
      </div>

      <div style={{ position: "absolute", top: 76, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 3 }}>
        <BreathOrb size="sm" glyph="心" />
      </div>

      <div className="stagger" style={{
        position: "absolute", top: 230, left: 24, right: 24, bottom: 130, zIndex: 4,
        display: "flex", flexDirection: "column", gap: 16
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: ".24em", textTransform: "uppercase",
          color: cfg.echo
        }}>— {cfg.tag}</div>

        <h1 className="h-mega" style={{ fontSize: 36, marginTop: -4 }}>{cfg.h1}</h1>

        <p className="whisper" style={{ marginTop: -8, fontSize: 14 }}>{cfg.sub}</p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          {cfg.names.map(n => (
            <button
              key={n}
              className={"name-chip " + (picked === n ? "sel" : "")}
              onClick={() => setPicked(n)}
              style={{ fontSize: 18, padding: "12px 22px" }}
            >{n}</button>
          ))}
          {editing ? (
            <input
              autoFocus
              value={custom}
              onChange={e => { setCustom(e.target.value); setPicked("__custom"); }}
              onBlur={() => setEditing(false)}
              onKeyDown={e => { if (e.key === "Enter") setEditing(false); }}
              placeholder="type one…"
              className="name-chip sel"
              style={{
                fontSize: 18, padding: "12px 22px",
                outline: "none", minWidth: 140,
                color: "#fff8ef", textAlign: "left",
              }}
            />
          ) : (
            <button
              className={"name-chip " + (picked === "__custom" ? "sel" : "")}
              onClick={() => setEditing(true)}
              style={{ fontSize: 18, padding: "12px 22px" }}
            >{custom ? `"${custom}"` : "+ your own"}</button>
          )}
        </div>
      </div>

      <CtaBig onClick={() => go(5)}>{display ? `Call me ${display}` : "Skip — go without"}</CtaBig>
    </div>
  );
}

/* ============================================================
   04 MODE V2 — choose your weather
   - 2x2 grid of moody tiles
   - Each tile is a tiny world
   - Clear selection state with glow
   ============================================================ */

function ScreenModeV2({ go, back, mode: modeFromApp, setMode: setModeFromApp }) {
  const [localMode, setLocalMode] = useStateV2(modeFromApp || "raw");
  // prefer external state if provided
  const mode = modeFromApp ?? localMode;
  const setMode = setModeFromApp ?? setLocalMode;
  const modes = [
    { key: "raw",    skin: "t-raw",    tag: "Gen Z · raw",      title: "no notes. just real shit.",         desc: "slang, swears, zero corporate.",         glyph: "!?" },
    { key: "cosmic", skin: "t-cosmic", tag: "Spiritual · cosmic", title: "Align with your higher frequency.", desc: "Astrology, chakras, lunar tides.",       glyph: "✦" },
    { key: "iron",   skin: "t-iron",   tag: "Hard mode · iron", title: "NO EXCUSES. ONLY REPS.",           desc: "pre-sale · pre-lift · pre-war.",         glyph: "力" },
    { key: "zen",    skin: "t-zen",    tag: "Zen · 禅",         title: "Sit. Breathe. Watch it pass.",      desc: "One breath, then the next.",             glyph: "無" },
    { key: "sleep",  skin: "t-sleep",  tag: "Bedtime · 夢 · 😴",     title: "Drift. Let the day go.",            desc: "Slow voice, low frequencies, moonlight.", glyph: "夢" },
  ];
  return (
    <div className="fade-in" style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      <Aurora />

      <div style={{ position: "absolute", top: 32, left: 32, right: 32, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 5 }}>
        <button className="lnk-soft" onClick={back}>← Back</button>
        
      </div>

      <div className="stagger" style={{
        position: "absolute", top: 84, left: 32, right: 32, bottom: 130, zIndex: 4,
        display: "flex", flexDirection: "column", gap: 6, overflowY: "auto"
      }}>
        <h1 className="h-mega" style={{ fontSize: 38 }}>
          How should it <span style={{ color: "#f4a06b" }}>hit?</span>
        </h1>

        <div className="mode-grid-v2">
          {modes.map(m => (
            <button
              key={m.key}
              className={"mode-tile " + m.skin + (mode === m.key ? " sel" : "")}
              onClick={() => setMode(m.key)}
            >
              <div className="mode-tile-bg"></div>
              <div className="mode-tile-check">✓</div>
              <div className="mode-tile-glyph">{m.glyph}</div>
              <div className="mode-tile-content">
                <div className="mode-tile-tag">{m.tag}</div>
                <div>
                  <div className="mode-tile-title" style={{ whiteSpace: "pre-line" }}>{m.title}</div>
                  <div className="mode-tile-desc">{m.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <CtaBig onClick={() => go(mode)}>Compose for me</CtaBig>
    </div>
  );
}

/* ============================================================
   08 REFLECT V2 — afterglow
   - Dim breath orb behind, ring expanding
   - Two big feel-buttons (yes / not quite)
   - Floating words you can tap, gently selected
   ============================================================ */

function ScreenReflectV2({ go, back }) {
  const [land, setLand] = useStateV2(null);
  const [word, setWord] = useStateV2(null);
  const [saved, setSaved] = useStateV2(false);
  const words = ["lighter", "steady", "tired", "clear", "softer", "still"];

  return (
    <div className="fade-in" style={{ height: "100%", position: "relative", overflow: "hidden" }}>
      {/* aurora — same DNA as Welcome / Mode / Name */}
      <Aurora />

      {/* dim breathing kanji center, kept from old reflect */}
      <span className="breath-center dim" style={{
        fontSize: 230, opacity: .18,
        animation: "breath 5.5s ease-in-out infinite",
        zIndex: 1
      }}>心</span>

      {/* back */}
      <button className="lnk-soft" onClick={back}
        style={{position:"absolute", top:32, left:32, zIndex:6, background:"transparent", border:"none", cursor:"pointer"}}>
        ← Back
      </button>

      {/* save heart — independent action, top right */}
      <button
        onClick={() => setSaved(s => !s)}
        aria-label={saved ? "Saved to library" : "Save to library"}
        style={{
          position: "absolute", top: 28, right: 28, zIndex: 6,
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 999,
          border: "1px solid " + (saved ? "transparent" : "rgba(243,236,227,.14)"),
          background: saved ? "linear-gradient(180deg, #e25a36, #c84c2b)" : "rgba(243,236,227,.04)",
          color: saved ? "#fff8ef" : "var(--ink-soft)",
          cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: ".18em", textTransform: "uppercase",
          boxShadow: saved ? "0 0 16px -4px rgba(225,118,68,.6)" : "none",
          transition: "all .25s var(--ease)"
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{saved ? "♥" : "♡"}</span>
        {saved ? "saved" : "save"}
      </button>

      {/* centered, quiet heading — old-school style */}
      <div className="content" style={{
        position: "absolute", top: 130, left: 32, right: 32, zIndex: 4,
        display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          letterSpacing: ".24em", textTransform: "uppercase",
          color: "#f4a06b"
        }}>— Reflect</div>

        <h1 style={{
          fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400,
          fontSize: 32, lineHeight: 1.15, color: "var(--ink)",
          margin: 0, textWrap: "balance"
        }}>How does it feel,<br/>right <span style={{ color: "#f4a06b" }}>now?</span></h1>

        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: ".16em", textTransform: "uppercase",
          color: "var(--ink-muted)", marginTop: 4
        }}>Did it land?</div>

        {/* yes / not quite as quiet italic links */}
        <div style={{ display: "flex", gap: 28, marginTop: 2 }}>
          <button onClick={() => setLand("yes")} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19,
            color: land === "yes" ? "var(--ink)" : "var(--ink-soft)",
            transition: "color .2s var(--ease)"
          }}>yes</button>
          <button onClick={() => setLand("not quite")} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 19,
            color: land === "not quite" ? "var(--ink)" : "var(--ink-soft)",
            transition: "color .2s var(--ease)"
          }}>not quite</button>
        </div>
      </div>

      {/* word block — bordered card with mic + chips, like old reflect */}
      <div style={{ position: "absolute", left: 32, right: 32, bottom: 110, zIndex: 4 }}>
        <div style={{
          border: "1px solid var(--ink-faint)", borderRadius: 18,
          padding: "16px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: "rgba(243,236,227,.02)"
        }}>
          <span style={{
            fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 17,
            color: word ? "var(--ink)" : "var(--ink-muted)"
          }}>{word || "a word, a feeling…"}</span>
          <span style={{ color: "var(--ink-soft)", fontSize: 16 }}>🎤</span>
        </div>

        <div style={{
          display: "flex", gap: 16, justifyContent: "center",
          marginTop: 16, flexWrap: "wrap"
        }}>
          {words.map(w => (
            <button key={w} onClick={() => setWord(w)} style={{
              background: "none", border: "none", cursor: "pointer",
              fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 14,
              color: word === w ? "var(--primary)" : "var(--ink-soft)",
              transition: "color .15s var(--ease)"
            }}>{w}</button>
          ))}
        </div>
      </div>

      {/* small close link, bottom — replaces big CTA */}
      <div style={{
        position: "absolute", bottom: 36, left: 0, right: 0, zIndex: 5, textAlign: "center"
      }}>
        <button onClick={() => go(1)} style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          letterSpacing: ".22em", textTransform: "uppercase",
          color: "var(--ink-soft)"
        }}>Close · 心</button>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenWelcomeV2,
  ScreenNameV2,
  ScreenModeV2,
  ScreenReflectV2,
  BreathOrb,
  Aurora,
  CtaBig,
});
