/* Screens.jsx — one component per Kokoro screen */

const { useState: useStateS, useEffect: useEffectS } = React;

function ScreenWelcome({ go }) {
  return (
    <div className="fade-in" style={{height:"100%",position:"relative"}}>
      <KanjiBg items={[
        {ch:"感",style:{top:140,left:18,fontSize:78}},
        {ch:"思",style:{top:230,right:18,fontSize:62}},
        {ch:"光",style:{top:380,left:6,fontSize:60}},
        {ch:"道",style:{top:430,right:6,fontSize:60}},
        {ch:"志",style:{top:570,left:30,fontSize:64}},
        {ch:"静",style:{top:620,right:30,fontSize:64}},
      ]} />
      <span className="kanji-bg" style={{top:340,left:"50%",transform:"translateX(-50%)",fontSize:280,opacity:.05}}>心</span>
      <div style={{position:"absolute",top:60,left:0,right:0,textAlign:"center",zIndex:3}}>
        <div style={{fontFamily:"var(--font-serif)",fontStyle:"italic",fontWeight:500,fontSize:34,letterSpacing:".36em",paddingLeft:".36em",color:"var(--ink)"}}>KOKORO</div>
        <div style={{marginTop:6,display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"var(--ink-muted)",fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".32em",textTransform:"uppercase"}}>
          <span style={{width:30,height:1,background:"var(--ink-faint)"}}></span>
          <span style={{fontFamily:"var(--font-cjk)",color:"var(--primary)",fontSize:12,letterSpacing:0}}>心</span>
          <span>The heart-mind</span>
          <span style={{width:30,height:1,background:"var(--ink-faint)"}}></span>
        </div>
      </div>
      <div className="content" style={{top:200,bottom:160,alignItems:"center",textAlign:"center",gap:18}}>
        <Eyebrow>Welcome</Eyebrow>
        <h1 className="h-display" style={{textAlign:"center"}}>What is your <span className="emph">kokoro</span><br/>holding?</h1>
        <p className="prose" style={{textAlign:"center",maxWidth:320}}>Speak it, type it, or just let go. We'll build tonight's ritual around it.</p>
        <div style={{display:"flex",gap:24,marginTop:14}}>
          {[["感","Heart"],["思","Mind"],["志","Spirit"]].map(([g,l],i,a)=>(
            <React.Fragment key={l}>
              <div style={{textAlign:"center"}}>
                <div style={{fontFamily:"var(--font-cjk)",color:"var(--primary)",fontSize:24,marginBottom:4}}>{g}</div>
                <div style={{fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:".18em",textTransform:"uppercase",color:"var(--ink-soft)"}}>{l}</div>
              </div>
              {i<a.length-1 && <span style={{color:"var(--ink-faint)",alignSelf:"center"}}>—</span>}
            </React.Fragment>
          ))}
        </div>
        <button className="cta outline" style={{position:"static",marginTop:24,width:240}} onClick={()=>go(2)}>Begin</button>
        <button className="lnk" onClick={()=>go(2)} style={{marginTop:6}}>No story · Just reset me</button>
        <button className="lnk" onClick={()=>go("library")}>Library</button>
      </div>
      <div className="footer-mono">Takes 90 seconds · Private</div>
    </div>
  );
}

function ScreenName({ go, back }) {
  const [picked, setPicked] = useStateS("By my name");
  const names = ["Love","Babe","Honey","Baby","Sweetheart","Sunshine","Kitten"];
  return (
    <div className="fade-in" style={{height:"100%",position:"relative"}}>
      <span className="kanji-bg" style={{top:130,right:-20,fontSize:200,color:"var(--primary-dim)",opacity:.18}}>心</span>
      <TopRow onBack={back} title="How to call you" />
      <div className="content" style={{gap:18}}>
        <Eyebrow align="left">How to call you</Eyebrow>
        <h1 className="h-display">What should<br/>I call you?</h1>
        <p className="prose">Not your username. The name that<br/>lands when someone says it softly.</p>
        <div style={{marginTop:8}}>
          <Chip dot selected={picked==="By my name"} onClick={()=>setPicked("By my name")}>By my name</Chip>
        </div>
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:".16em",textTransform:"uppercase",color:"var(--ink-muted)",margin:"14px 0 8px",display:"flex",alignItems:"center",gap:10}}>
          <span style={{width:30,height:1,background:"var(--ink-faint)"}}/>Or something softer<span style={{flex:1,height:1,background:"var(--ink-faint)"}}/>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {names.map(n => <Chip key={n} selected={picked===n} onClick={()=>setPicked(n)}>{n}</Chip>)}
          <Chip onClick={()=>{}}>+ Your own</Chip>
        </div>
      </div>
      <Cta onClick={()=>go(3)}>Continue</Cta>
      <div style={{position:"absolute",left:32,bottom:24,fontFamily:"var(--font-mono)",fontSize:10,letterSpacing:".16em",textTransform:"uppercase",color:"var(--ink-muted)"}}>
        <button className="lnk" onClick={()=>go(3)}>Skip for now</button>
      </div>
      <div style={{position:"absolute",right:32,bottom:24,textAlign:"right",fontFamily:"var(--font-mono)",fontSize:9,letterSpacing:".16em",textTransform:"uppercase",color:"var(--ink-muted)",lineHeight:1.5}}>You can change this<br/>any time</div>
    </div>
  );
}

function ScreenCapture({ go, back }) {
  const [tab, setTab] = useStateS("Speak");
  const [recording, setRecording] = useStateS(false);
  const [s, setS] = useStateS(0);
  useEffectS(()=>{
    if(!recording) return;
    const id = setInterval(()=>setS(x=>x+1),1000);
    return ()=>clearInterval(id);
  },[recording]);
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflow:"hidden"}}>
      <Aurora />

      {/* back */}
      <button className="lnk-soft" onClick={back}
        style={{position:"absolute", top:32, left:32, zIndex:6, background:"transparent", border:"none", cursor:"pointer"}}>
        ← Back
      </button>

      {/* heading */}
      <div className="stagger" style={{
        position:"absolute", top:104, left:32, right:32, zIndex:4,
        display:"flex", flexDirection:"column", gap:10, textAlign:"left"
      }}>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
          letterSpacing:".24em", textTransform:"uppercase",
          color:"#f4a06b"
        }}>— Capture</div>
        <h1 className="h-mega" style={{fontSize:36}}>
          What are you <span style={{color:"#f4a06b"}}>carrying?</span>
        </h1>
      </div>

      {/* mic */}
      <div style={{position:"absolute", top:240, left:0, right:0, zIndex:4, display:"flex", justifyContent:"center"}}>
        <div onClick={()=>setRecording(r=>!r)} style={{cursor:"pointer"}}>
          <MicVisualiser recording={recording} seconds={s}/>
        </div>
      </div>

      {/* tabs above CTA */}
      <div style={{position:"absolute", left:32, right:32, bottom:130, zIndex:4}}>
        <Tabs value={tab} onChange={setTab} options={["Speak","Type","Tap"]}/>
      </div>

      <CtaBig onClick={()=>go(4)}>Continue</CtaBig>
    </div>
  );
}

function ScreenMirror({ go, back }) {
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflow:"hidden"}}>
      <Aurora />

      {/* dim 感 kanji center, like reflect's 心 */}
      <span className="breath-center dim" style={{
        fontSize:230, opacity:.16,
        animation:"breath 5.5s ease-in-out infinite",
        zIndex:1
      }}>感</span>

      {/* back */}
      <button className="lnk-soft" onClick={back}
        style={{position:"absolute", top:32, left:32, zIndex:6, background:"transparent", border:"none", cursor:"pointer"}}>
        ← Back
      </button>

      {/* eyebrow + headline */}
      <div className="stagger" style={{
        position:"absolute", top:104, left:32, right:32, zIndex:4,
        display:"flex", flexDirection:"column", gap:10
      }}>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
          letterSpacing:".24em", textTransform:"uppercase",
          color:"#f4a06b"
        }}>— Mirror</div>
        <h1 className="h-mega" style={{fontSize:34}}>
          What I <span style={{color:"#f4a06b"}}>heard.</span>
        </h1>
      </div>

      {/* the reflection — long-form prose */}
      <div style={{
        position:"absolute", top:230, left:32, right:32, zIndex:4,
        display:"flex", flexDirection:"column", gap:18
      }}>
        <p className="prose-large" style={{margin:0}}>
          You are not being dramatic. You are carrying <span className="emph">anger, pressure,</span> and the feeling that nobody really saw how much <span className="emph">effort</span> you put in <span className="emph">today</span>.
        </p>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:11,
          letterSpacing:".18em", textTransform:"uppercase",
          color:"var(--ink-muted)",
          display:"flex", alignItems:"center", gap:10
        }}>
          <span style={{width:24, height:1, background:"var(--ink-faint)"}}></span>
          Did I hear you?
        </div>
      </div>

      <CtaBig onClick={()=>go(5)}>Yes — compose for me</CtaBig>
    </div>
  );
}

function ScreenShape({ go, back }) {
  const [mode, setMode] = useStateS("raw");
  const modes = [
    {key:"raw", className:"mode-raw", tag:"Gen Z · raw", glyph:"!?",
      title:"no notes. just real shit.",
      desc:"slang, swears, zero corporate. like your group chat at 2am.",
      meta:"~5 min"},
    {key:"cosmic", className:"mode-cosmic", tag:"Spiritual · cosmic", glyph:"✦",
      title:"Align with your higher frequency.",
      desc:"Astrology, chakras, lunar tides — channel the version of you the universe is rooting for.",
      meta:"~8 min"},
    {key:"iron", className:"mode-iron", tag:"Hard mode · iron", glyph:"力",
      title:"NO EXCUSES. ONLY REPS.",
      desc:"Pre-sale · pre-lift · pre-war. Sharp voice. No negotiation.",
      meta:"~4 min"},
    {key:"zen", className:"mode-zen", tag:"Zen · 禅", glyph:"無",
      title:"Sit. Breathe. Watch it pass.",
      desc:"Buddhist stillness. One breath, then the next. Nothing to fix.",
      meta:"~10 min"},
    {key:"sleep", className:"mode-sleep", tag:"Bedtime · 夢 · 😴", glyph:"夢",
      title:"Drift. Let the day go.",
      desc:"Slow voice, low frequencies, moonlight. Until you're out cold.",
      meta:"~15 min"},
  ];
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflowY:"auto"}}>
      <TopRow onBack={back} title="Choose your mode"/>
      <div className="content" style={{bottom:110,gap:14,overflowY:"auto"}}>
        <Eyebrow align="left">The meditation</Eyebrow>
        <h1 className="h-1">How should it hit?</h1>
        <p className="prose" style={{marginTop:-4,fontSize:14}}>Four flavors. Pick the one that matches tonight.</p>
        <div className="mode-list" style={{marginTop:6}}>
          {modes.map(m => (
            <button key={m.key} className={"mode-card " + m.className + (mode===m.key?" sel":"")} onClick={()=>setMode(m.key)}>
              <div className="mode-card-inner">
                <div className="mode-glyph">{m.glyph}</div>
                <div style={{flex:1,position:"relative",zIndex:2}}>
                  <div className="mode-tag">{m.tag}</div>
                  <div className="mode-title">{m.title}</div>
                  <div className="mode-desc">{m.desc}</div>
                </div>
                <div className="mode-meta">{m.meta}</div>
                {m.key==="zen" && <div className="ensō"/>}
              </div>
            </button>
          ))}
        </div>
      </div>
      <Cta onClick={()=>go(6)}>Compose my meditation</Cta>
    </div>
  );
}

function ScreenComposing({ go }) {
  useEffectS(()=>{
    const t = setTimeout(()=>go(), 2200);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflow:"hidden"}}>
      <Aurora />

      {/* Big breathing 心 in center */}
      <span className="breath-center" style={{
        fontSize:240, color:"var(--primary)", opacity:.55,
        animation:"breath 5.5s ease-in-out infinite",
        textShadow:"0 0 60px rgba(225,90,54,.4)",
        zIndex:2
      }}>心</span>

      {/* eyebrow + soft headline below */}
      <div style={{
        position:"absolute", top:130, left:0, right:0, zIndex:4,
        display:"flex", flexDirection:"column", alignItems:"center", gap:10
      }}>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
          letterSpacing:".24em", textTransform:"uppercase",
          color:"#f4a06b"
        }}>— Composing</div>
        <div style={{
          fontFamily:"var(--font-serif)", fontStyle:"italic",
          fontSize:24, color:"var(--ink)", opacity:.85
        }}>shaping your ritual…</div>
      </div>

      {/* tiny dots loader bottom */}
      <div style={{
        position:"absolute", bottom:80, left:0, right:0, zIndex:4,
        display:"flex", justifyContent:"center", gap:8
      }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width:6, height:6, borderRadius:"50%",
            background:"var(--primary)",
            animation:`composing-dot 1.4s ease-in-out ${i*0.18}s infinite`,
            opacity:.4
          }}/>
        ))}
      </div>

      <style>{`@keyframes composing-dot{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  );
}

function ScreenPlayer({ go, back }) {
  const [playing, setPlaying] = useStateS(true);
  const [saved, setSaved] = useStateS(false);
  const [progress, setProgress] = useStateS(28); // 0–100
  useEffectS(() => {
    if (!playing) return;
    const id = setInterval(() => setProgress(p => Math.min(100, p + 0.6)), 600);
    return () => clearInterval(id);
  }, [playing]);
  const totalSec = 5 * 60 + 12;
  const cur = Math.floor((progress / 100) * totalSec);
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflow:"hidden"}}>
      <Aurora />

      <button className="lnk-soft" onClick={back}
        style={{position:"absolute", top:32, left:32, zIndex:6, background:"transparent", border:"none", cursor:"pointer"}}>
        ← Back
      </button>

      <span className="breath-center" style={{fontSize:240, color:"var(--primary)", opacity:.42, animation:"breath 5.5s ease-in-out infinite", zIndex:2}}>心</span>

      <div style={{position:"absolute", top:104, left:32, right:32, textAlign:"center", zIndex:4}}>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
          letterSpacing:".24em", textTransform:"uppercase",
          color:"#f4a06b"
        }}>— for Sweetheart</div>
        <h1 className="h-mega" style={{marginTop:14, fontSize:32, textWrap:"balance"}}>
          You did <span style={{color:"#f4a06b"}}>enough</span> today.
        </h1>
      </div>

      {/* save heart — pill, matches Reflect */}
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

      {/* progress bar — click/drag to scrub */}
      <div style={{position:"absolute", left:32, right:32, bottom:200}}>
        <div
          onPointerDown={(e) => {
            const seek = (clientX) => {
              const r = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
              setProgress(pct);
            };
            seek(e.clientX);
            const target = e.currentTarget;
            target.setPointerCapture(e.pointerId);
            const move = (ev) => seek(ev.clientX);
            const up = () => {
              target.releasePointerCapture(e.pointerId);
              target.removeEventListener("pointermove", move);
              target.removeEventListener("pointerup", up);
              target.removeEventListener("pointercancel", up);
            };
            target.addEventListener("pointermove", move);
            target.addEventListener("pointerup", up);
            target.addEventListener("pointercancel", up);
          }}
          style={{
            height:24, display:"flex", alignItems:"center",
            cursor:"pointer", touchAction:"none",
            margin:"0 -8px", padding:"0 8px"
          }}
        >
          <div style={{position:"relative", height:4, width:"100%", background:"rgba(243,236,227,.08)", borderRadius:2}}>
            <div style={{
              position:"absolute", left:0, top:0, bottom:0, width:`${progress}%`,
              background:"linear-gradient(90deg, #c84c2b, #e25a36)",
              borderRadius:2,
              boxShadow:"0 0 12px rgba(225,118,68,.5)",
            }}></div>
            {/* draggable thumb */}
            <div style={{
              position:"absolute", left:`${progress}%`, top:"50%",
              transform:"translate(-50%, -50%)",
              width:14, height:14, borderRadius:"50%",
              background:"#fff8ef",
              boxShadow:"0 0 0 2px #e25a36, 0 2px 8px rgba(0,0,0,.4)",
              pointerEvents:"none",
            }}></div>
          </div>
        </div>
        <div style={{marginTop:10, display:"flex", justifyContent:"space-between", fontFamily:"var(--font-mono)", fontSize:11, letterSpacing:".12em", color:"var(--ink-muted)"}}>
          <span>{fmt(cur)}</span>
          <span>{fmt(totalSec)}</span>
        </div>
      </div>

      {/* play controls */}
      <div style={{position:"absolute", left:0, right:0, bottom:80, display:"flex", justifyContent:"center", alignItems:"center", gap:32}}>
        <button onClick={() => setProgress(p => Math.max(0, p-12))}
          style={{background:"transparent",border:"none",color:"var(--ink-soft)",fontSize:22,cursor:"pointer"}}>⏮</button>
        <button onClick={() => setPlaying(p => !p)}
          style={{
            width:72, height:72, borderRadius:"50%",
            background:"linear-gradient(180deg, #e25a36, #c84c2b)",
            border:"none", color:"#fff8ef",
            fontSize:24, cursor:"pointer",
            boxShadow:"0 0 32px -6px rgba(225,118,68,.6)",
          }}>{playing ? "⏸" : "▶"}</button>
        <button onClick={() => go(1)}
          style={{background:"transparent",border:"none",color:"var(--ink-soft)",fontSize:13,cursor:"pointer",fontFamily:"var(--font-mono)",letterSpacing:".16em",textTransform:"uppercase"}}>End</button>
      </div>
    </div>
  );
}

function ScreenReflect({ go, back }) {
  const [land, setLand] = useStateS(null);
  const [word, setWord] = useStateS(null);
  const words = ["lighter","steady","tired","clear","softer","still"];
  return (
    <div className="fade-in" style={{height:"100%",position:"relative"}}>
      <span className="breath-center dim" style={{fontSize:230,opacity:.25}}>心</span>
      <div className="top-row" style={{justifyContent:"center"}}><span className="top-title">Reflect</span></div>
      <div className="content" style={{alignItems:"center",textAlign:"center",gap:20,top:130}}>
        <Eyebrow>Stay a moment</Eyebrow>
        <h1 className="h-display" style={{textAlign:"center"}}>How does it feel,<br/>right now?</h1>
        <div style={{fontFamily:"var(--font-mono)",fontSize:11,letterSpacing:".16em",textTransform:"uppercase",color:"var(--ink-muted)",marginTop:6}}>Did it land?</div>
        <div style={{display:"flex",gap:24,fontFamily:"var(--font-serif)",fontStyle:"italic",fontSize:18}}>
          <button className="lnk" style={{fontFamily:"var(--font-serif)",fontStyle:"italic",fontSize:18,letterSpacing:0,textTransform:"none",color:land==="yes"?"var(--ink)":"var(--ink-soft)"}} onClick={()=>setLand("yes")}>yes</button>
          <button className="lnk" style={{fontFamily:"var(--font-serif)",fontStyle:"italic",fontSize:18,letterSpacing:0,textTransform:"none",color:land==="not quite"?"var(--ink)":"var(--ink-soft)"}} onClick={()=>setLand("not quite")}>not quite</button>
        </div>
      </div>
      <div style={{position:"absolute",left:32,right:32,bottom:110}}>
        <div style={{border:"1px solid var(--ink-faint)",borderRadius:18,padding:"16px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"var(--font-serif)",fontStyle:"italic",fontSize:18,color:word||"var(--ink-muted)"==="var(--ink-muted)"?"var(--ink-muted)":"var(--ink)"}}>{word || "a word, a feeling…"}</span>
          <span style={{color:"var(--ink-soft)"}}>🎤</span>
        </div>
        <div style={{display:"flex",gap:14,justifyContent:"center",marginTop:14,flexWrap:"wrap"}}>
          {words.map(w => <button key={w} className="lnk" onClick={()=>setWord(w)} style={{fontFamily:"var(--font-serif)",fontStyle:"italic",fontSize:14,letterSpacing:0,textTransform:"none",color:word===w?"var(--primary)":"var(--ink-soft)"}}>{w}</button>)}
        </div>
        <div style={{textAlign:"center",marginTop:16}}>
          <button className="lnk" onClick={()=>go(1)}>Close · 心</button>
        </div>
      </div>
    </div>
  );
}

function ScreenLibrary({ go, back }) {
  const items = [
    { id:1, mode:"zen", glyph:"無", tag:"Zen · 禅",
      title:"Sit. Breathe. Watch it pass.",
      date:"2 days ago", duration:"10:24", name:"Sweetheart" },
    { id:2, mode:"raw", glyph:"!?", tag:"Gen Z · raw",
      title:"no notes. just real shit.",
      date:"last week", duration:"5:12", name:"Bestie" },
    { id:3, mode:"sleep", glyph:"夢", tag:"Bedtime · 夢",
      title:"Drift. Let the day go.",
      date:"3 weeks ago", duration:"15:00", name:"Dreamer" },
  ];
  return (
    <div className="fade-in" style={{height:"100%",position:"relative",overflow:"hidden"}}>
      <Aurora />

      <button className="lnk-soft" onClick={back}
        style={{position:"absolute", top:32, left:32, zIndex:6, background:"transparent", border:"none", cursor:"pointer"}}>
        ← Back
      </button>

      <div style={{position:"absolute", top:104, left:24, right:24, zIndex:4}}>
        <div style={{
          fontFamily:"var(--font-mono)", fontSize:10, fontWeight:600,
          letterSpacing:".24em", textTransform:"uppercase",
          color:"#f4a06b"
        }}>— Library</div>
        <h1 className="h-mega" style={{fontSize:34, marginTop:8}}>
          Yours, <span style={{color:"#f4a06b"}}>kept.</span>
        </h1>
        <p style={{
          fontFamily:"var(--font-serif)", fontStyle:"italic",
          fontSize:14, color:"var(--ink-muted)", margin:"6px 0 0"
        }}>{items.length} meditations · saved on this device</p>
      </div>

      <div style={{
        position:"absolute", top:218, left:0, right:0, bottom:24,
        overflowY:"auto", padding:"0 24px", display:"flex",
        flexDirection:"column", gap:12, zIndex:3
      }}>
        {items.map(it => (
          <button key={it.id} className={"library-card mode-tile t-" + it.mode}
            onClick={() => go(7)}
            style={{ minHeight:108 }}>
            <div className="mode-tile-bg"></div>
            <div className="mode-tile-glyph">{it.glyph}</div>
            <div className="mode-tile-content">
              <div className="mode-tile-tag">{it.tag}</div>
              <div>
                <div className="mode-tile-title" style={{ fontSize:16 }}>{it.title}</div>
                <div className="mode-tile-desc" style={{ marginTop:6, opacity:.65 }}>
                  for {it.name} · {it.duration} · {it.date}
                </div>
              </div>
            </div>
            {/* play indicator */}
            <div style={{
              position:"absolute", right:14, top:14, zIndex:5,
              width:32, height:32, borderRadius:"50%",
              background:"rgba(0,0,0,.35)", color:"#fff8ef",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, backdropFilter:"blur(4px)",
            }}>▶</div>
          </button>
        ))}

        {/* empty-state hint at bottom */}
        <div style={{
          marginTop:8, padding:"14px 16px", borderRadius:14,
          border:"1px dashed rgba(243,236,227,.12)",
          fontFamily:"var(--font-serif)", fontStyle:"italic",
          fontSize:13, color:"var(--ink-muted)", textAlign:"center"
        }}>
          tap ♥ on any meditation to keep it here
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenWelcome, ScreenName, ScreenCapture, ScreenMirror, ScreenShape, ScreenComposing, ScreenPlayer, ScreenReflect, ScreenLibrary });
