# iOS ElevenLabs Audio Troubleshooting Log

Last updated: 2026-05-22

This document tracks the iPhone-only ElevenLabs voice issue in Kokoro, what was tried, what each attempt proved, and what should or should not be tried next.

Future agents: read this entire file before touching iOS voice, ElevenLabs connection options, Capgo, or `AVAudioSession`.

## Current Status

The current iPhone behavior appears intermittent. The app was brought back from the broken "first full message or two missing" state to the older "better bad" state, and then later the same installed iOS app began working better without another rebuild.

- Earlier latest report: the first audible words started after the phrase "Hey love". The app played roughly from "I'm Kokoro..." or "I can help you with whatever you're going through..."
- After pressing the cross to end the chat and starting again, the next run can still begin late, around "...whatever you're going through."
- This is better than the broken state where the first full message or two were silent and audio only began around "are you still there?"
- It is still not acceptable as final behavior because the first words of the agent's first message are clipped.
- Later report, with no code/build change: Safari worked perfectly, Telegram worked perfectly, and the iOS app also started working much better.
- The user strongly suspects the iPhone ear speaker / receiver route was involved. They may have triggered a route change by putting the phone to their ear once, after which behavior improved.

Important fact:

- The Railway/GitHub web app, Safari on the same iPhone, and Telegram/web version speak correctly without this delay.
- Therefore the ElevenLabs agent, dashboard first message, and backend generation are probably not the core problem.
- The remaining issue is specific to iOS app container playback: Capacitor + WKWebView + WebAudio/MediaStream/microphone route.
- The leading theory is now an iOS audio-route/session race, sometimes involving receiver/earpiece vs loudspeaker routing, not an ElevenLabs service outage.

## Correct App And Capgo State

The real iOS app id is:

```text
com.kokoromind.app
```

Old/stale app id:

```text
com.kokoro.app
```

What was fixed:

- The physical iPhone previously had two apps both named "Kokoro":
  - `com.kokoro.app`, version 1.0, build 1
  - `com.kokoromind.app`, version 1.0, build 2
- `com.kokoro.app` was removed from the iPhone.
- Capgo old app data for `com.kokoro.app` was cleaned:
  - production channel deleted
  - bundles `0.0.0` through `0.0.7` deleted
- The real Capgo app remains:
  - `com.kokoromind.app`
  - production channel points to `1.0.2`
- Local dev config currently has:
  - `CapacitorUpdater.autoUpdate: false`
- Xcode logs confirm local Command+R loads:

```text
Initial load builtin
Auto update is disabled
Current bundle loaded successfully ... id: builtin
```

Development rule for now:

- Use Xcode Command+R rebuilds for iPhone testing.
- Verify every run shows `builtin` in logs.
- Do not trust a test if Capgo loads a downloaded bundle.
- Do not reintroduce the old `com.kokoro.app` id.

Latest connected-device snapshot before the next rebuild:

```text
iPhone: Denis's iPhone, iPhone 17 Pro
Installed app: Kokoro
Bundle id: com.kokoromind.app
Version: 1.0
Build: 2
builtByDeveloper: true
Capgo/runtime state: builtin, serverBasePath empty, pastVersion builtin
```

This means the currently connected phone appears to be running the Xcode-installed built-in bundle, not a downloaded Capgo bundle.

## Known Baseline

The "better bad" baseline was not a deliberate `1500ms` connection delay.

The baseline that existed in Git history was:

- ElevenLabs signed URL
- `connectionType: 'websocket'`
- dashboard default first message
- muted `audioUnlock`
- no `connectionDelay`

The previous better-bad symptom was:

- first roughly 1 to 1.5 seconds of speech missing
- audio then begins mid first sentence

Do not label `connectionDelay: { ios: 1500 }` as the baseline. It was an experiment and the user reported it never felt good.

## What The Logs Prove

Recent iPhone logs showed:

```text
[11labs] startSession {"kind":"voice","connectionType":"websocket","firstMessage":"(dashboard default)","hasSignedUrl":true}
[11labs] onConnect ... elapsedMs: 5473 to 6074
[11labs] first audio chunk ... elapsedMs: 5473 to 6074
[11labs] first speaking mode ... elapsedMs: 5474 to 6074
[11labs] first agent text ... firstMessage dashboard default
```

Meaning:

- The app is using the dashboard default first message again.
- The agent is not starting with the old local reconnect message.
- ElevenLabs audio chunks do arrive.
- Bubbles and speaking animation happen because the SDK receives agent text and speaking events.

The key bad signal:

```text
[11labs] audio volume probe ... outputVolume: 0
```

On one run, output became nonzero quickly:

```text
outputVolume: 0
outputVolume: 0.0641
outputVolume: 0.1471
outputVolume: 0.2265
```

On another run, output stayed zero for many seconds after audio chunks arrived:

```text
first audio chunk ... elapsedMs: 5473
audio volume probe ... outputVolume: 0
audio volume probe ... outputVolume: 0
...
audio volume probe ... outputVolume: 0
```

Then later, after interruption / later response:

```text
outputVolume: 0.2101
outputVolume: 0.3012
```

Conclusion:

- This is not primarily "ElevenLabs is slow."
- This is not primarily "the text bubble is late."
- Audio data reaches the client, but iOS/WKWebView playback output sometimes stays silent or not routed for the beginning.

## Attempts From Earlier Agents

### 1. Native `AVAudioSession` Override In `AppDelegate.swift`

What was tried:

- Force iOS `AVAudioSession` to `.playAndRecord`.
- Force `defaultToSpeaker`.
- Do it at app launch.

Why it was tried:

- The theory was that prewarming the native audio route would prevent iOS from switching routes when the mic starts.

Result:

- Failed badly.
- It clashed with Capacitor/WKWebView/WebRTC lifecycle.
- Caused silence and broken interruption behavior.

Do not repeat as a broad app-launch override.

Possible future version:

- A very small native plugin that activates audio session only immediately before voice and releases after voice might still be worth researching.
- But it must be tested carefully because the broad override already failed.

### 2. Artificial `connectionDelay: { ios: 1500 }`

What was tried:

- Delay ElevenLabs connection after mic activation.

Why it was tried:

- Give iOS time to switch audio route before ElevenLabs starts speaking.

Result:

- User reported it never worked well.
- It adds intentional silence.
- Combined with ElevenLabs session setup latency, it can feel like 4 to 7 seconds of nothing.

Important:

- This was not the GitHub/better-bad baseline.
- Do not restore this as "the old working version."

### 3. Muted Silent Audio Unlock

What was tried:

- Play a muted silent WAV inside the tap handler.

Why it was tried:

- Classic iOS WebKit audio unlock trick.

Result:

- This matched the old baseline path.
- It helped get to "better bad" but did not fully solve clipping.
- Modern iOS often does not treat muted playback as a strong enough unlock for real later playback.

### 4. Unmuted 1 Percent Unlock And WebRTC Switch

What was tried:

- Play unmuted low-volume audio.
- Switch ElevenLabs from websocket to WebRTC.

Why it was tried:

- WebRTC should generally be better for low-latency voice.
- Unmuted output should satisfy iOS media gesture requirements more reliably than muted output.

Result:

- User reported 5 to 7 seconds of silence still happened.
- Also, local SDK inspection showed a likely implementation problem:
  - `signedUrl` only supports websocket.
  - Proper WebRTC requires `conversationToken` or `agentId`.
  - `preferHeadphonesForIosDevices` is not supported by the WebRTC path.

Do not switch to WebRTC while still passing `signedUrl`.

### 5. Earpiece / Headphones Theory

Theory:

- iOS may route audio to the phone earpiece or another route when microphone is active.
- The user later reported this is real in practice: sometimes the sound appears connected to the ear speaker / receiver behavior, and putting the phone to the ear may have changed or fixed the route.

Historical code:

```text
preferHeadphonesForIosDevices: true
```

What SDK inspection showed:

- In websocket mode, this option looks for headphone-like input devices on iOS.
- It is not a reliable "force speaker" option.
- It is unsupported in WebRTC mode.

Status:

- Highly plausible that iOS route selection contributes to the issue.
- But this flag is not a complete fix.

## Attempts In This Session

### 1. Removed Capgo Confusion

Problem:

- Command+R was still loading old/bad Capgo bundles.
- Logs showed downloaded Capgo versions like `1.0.10` even after local rebuilds.

Actions taken:

- Set Capgo production for real app back to `1.0.2`.
- Set local `CapacitorUpdater.autoUpdate` to `false`.
- Synced iOS.
- Bumped native build number to force Capgo reset behavior.
- Removed old installed iPhone app `com.kokoro.app`.
- Deleted old Capgo channel/bundles for `com.kokoro.app`.

Result:

- Logs now show `builtin`.
- Capgo is no longer the active cause of voice testing confusion.

### 2. Restored Dashboard First Message Path

Problem:

- App could start with local reconnect override:

```text
Okay, I'm back. Pick it up wherever you want.
```

or later audio could begin around:

```text
are you still there?
```

Action taken:

- Removed local reconnect first-message override logic.
- Normal mic starts now use dashboard default unless an entry route explicitly sets a first message.

Result:

- Logs show:

```text
firstMessage: "(dashboard default)"
```

- The first message is again the dashboard line beginning with "Hey love..."

### 3. Added Diagnostic Logs

Added logs for:

- mic tap
- signed URL fetch start/done
- startSession options
- onConnect elapsed time
- first agent text
- first audio chunk
- audio chunk counts/sizes
- first speaking mode
- output/input volume probes
- interruption events
- native iOS audio route snapshots through `AudioRouteDiagnosticsPlugin`

Why:

- To distinguish:
  - agent/text is late
  - audio chunks are late
  - audio chunks arrive but output is silent
  - iOS route wakes up later
  - iOS is routing to receiver/earpiece instead of speaker

Result:

- Logs proved audio chunks arrive and output can remain zero.
- This narrowed the issue to iOS playback/output route rather than ElevenLabs generation.
- Later update added `[audio-route]` snapshots and native `🔊 [audio-route]` route-change logs. These are observational only and do not change `AVAudioSession`.

### 4. Real WebAudio / MediaStream Output Unlock

What was changed:

- Replaced the muted silent WAV unlock with:
  - WebAudio context creation/resume
  - hidden `HTMLAudioElement`
  - `MediaStreamDestination`
  - very low-volume oscillator burst
  - keep output path alive briefly

Why:

- ElevenLabs websocket SDK plays through a WebAudio graph into a MediaStream-backed audio element.
- The old muted WAV did not match that output path.

Result:

- Improved from "first message or two missing" back to "better bad."
- Latest report after this family of changes: only "Hey love" is missed.

### 5. Microphone Route Prewarm

What was changed:

- On mic tap, call `getUserMedia` immediately as a route prewarm.
- Hold that temporary stream while ElevenLabs sets up.
- Stop it shortly after ElevenLabs connects.

Why:

- iOS route switching appears to be the fragile part.
- Prewarming the mic route earlier gives iOS more time before the first ElevenLabs audio chunk.

Current result:

- Some improvement, but not solved.
- Latest report: only "Hey love" is missed on first start.
- Restarting after ending chat can still begin later, around "...whatever you're going through."

Open concern:

- Holding/stopping the prewarm stream may interact with ElevenLabs' own preliminary stream and output graph.
- The second-start behavior suggests teardown/restart lifecycle still needs work.

### 6. Current Experiment: Disable Extra Microphone Prewarm

What changed:

- The app no longer starts its own temporary `getUserMedia` stream before ElevenLabs.
- The WebAudio/media-element unlock remains.
- Native route logs and ElevenLabs timing logs remain.
- The run logs:

```text
[audio] mic route prewarm skipped
voice.prewarm.skipped
```

Why:

- The latest diagnostic run showed native output stayed on `Speaker`, not `Receiver`.
- The extra mic prewarm took about `1776ms` and caused many native route-change events while ElevenLabs was also starting.
- First ElevenLabs audio arrived around `3705ms`, but SDK `outputVolume` stayed `0` until around `4216ms`.
- This experiment tests whether letting ElevenLabs own microphone setup reduces iOS/WebKit route churn and clips fewer first words.

Result from the first skipped-prewarm run:

- Confirmed the app was on Capgo `builtin` with auto-update disabled.
- Confirmed `[audio] mic route prewarm skipped` and `voice.prewarm.skipped`.
- Session setup got faster: first audio chunk moved from about `3705ms` to about `2956ms`.
- The audible first phrase was still clipped; the user heard the message start around `"...going through..."`.
- Native `AVAudioSession` still reported output route `Speaker` during the failure, not `Receiver`.
- SDK `outputVolume` became nonzero around `3471ms`, about `515ms` after the first audio chunk.
- Important interpretation: SDK `outputVolume` is measured inside the SDK WebAudio graph before the hidden media element/hardware output, so nonzero output volume does not prove the iPhone speaker was already audibly playing.

### 7. Current Experiment: Nudge ElevenLabs Hidden Audio Element

What changed:

- The app now marks Kokoro's own unlock/prime audio element as `data-kokoro-audio-prime="true"`.
- During voice startup, it watches for non-prime `<audio>` elements created by the ElevenLabs SDK.
- When one appears, it sets `autoplay`, `playsinline`, `webkit-playsinline`, unmutes it, and calls `play()`.
- It logs each media element's `paused`, `readyState`, `networkState`, `currentTime`, `muted`, `volume`, `autoplay`, and `srcObject` state.

Why:

- The ElevenLabs WebSocket path creates its own hidden media element after startup.
- On iOS/WKWebView, that hidden element may not begin playing immediately even though the SDK WebAudio graph already has audio.
- If the element starts late, early audio can be consumed or routed strangely before the user hears it.
- This is less invasive than forcing `AVAudioSession` globally and gives direct evidence about whether the hidden playback element is paused/late.

New logs:

```text
[audio] media elements
[audio] conversation media nudge
[audio] conversation media play ok
[audio] conversation media play failed
voice.audio-nudge.start
voice.audio-nudge.tick
voice.audio-nudge.done
```

Result from the first audio-element nudge run:

- The ElevenLabs hidden audio element appeared around `2074ms`.
- It was initially `paused: true`, then `play()` succeeded and it was playing before the first ElevenLabs audio chunk.
- First audio chunk arrived around `2791ms`.
- SDK `outputVolume` still stayed `0` until around `3301ms`.
- The first audible message still started around `"...going through..."`.
- Ending the session and tapping mic again produced the full first sentence.

Interpretation:

- The hidden media element was not the only blocker.
- The first session warms the iOS/WKWebView/ElevenLabs audio path; the second session can then play correctly.
- The remaining problem is a cold-start output graph / route readiness problem in the first session.

### 8. Current Experiment: Cold-Start Warm Opener

What changed:

- On the first iOS/WebKit voice session in the current app runtime, the app overrides the agent first message with a short warm lead-in:

```text
Mmm... heeeyyy, I'm Kokoro.
```

- The default `Hey love, I'm Kokoro.` prefix is removed first, so Kokoro does not introduce himself twice.
- The meaningful opener follows after that warm lead-in.
- Later voice starts in the same runtime are not padded.
- Desktop Chrome is not padded.
- The tap-time audio prime is now ultra-quiet and very short to avoid adding a bell-like sound, especially with AirPods.
- Voice is back on the signed-url WebSocket path. The proper `conversationToken` WebRTC attempt caused LiveKit negotiation/reconnect failures in the iOS app and was backed out.
- `preferHeadphonesForIosDevices` is restored to the previous WebSocket baseline value.

Why:

- The cold iOS session is still losing the beginning even when the hidden audio element is already playing.
- The second session is clean, proving the normal opener can work after the audio stack is warm.
- This is a product-safe mitigation while we continue investigating WebRTC or native route preparation.

New log:

```text
[11labs] cold iOS first message padding
[11labs] conversation-token fetch start
[11labs] conversation-token fetch done
```

## Current Code Areas

Main files involved:

```text
app/src/screens/Kokoro3.tsx
app/src/lib/audioUnlock.ts
app/src/lib/audioElementDiagnostics.ts
app/src/lib/audioRouteDiagnostics.ts
app/src/lib/elevenlabs.ts
app/capacitor.config.ts
app/ios/App/App.xcodeproj/project.pbxproj
app/plugins/audio-route-diagnostics/
```

Important runtime path:

```text
Kokoro3.tsx startVoice()
  -> unlockAudio()
  -> startConversationAudioElementNudge()
  -> prewarm skipped in current experiment
  -> getConversationToken()
  -> first iOS voice start uses cold-start warm opener
  -> startSession({ connectionType: 'webrtc', conversationToken })
  -> fallback only: startSession({ connectionType: 'websocket', signedUrl })
  -> ElevenLabs SDK creates input/output WebAudio graph
  -> nudge any ElevenLabs-created non-prime audio element
```

## What Not To Do Again

Do not:

- Treat `connectionDelay: { ios: 1500 }` as the old baseline.
- Switch to WebRTC while still using `signedUrl`.
- Re-add the broad app-launch `AVAudioSession` override.
- Assume Capgo is fixed forever without checking `builtin` in logs.
- Test against `com.kokoro.app`.
- Remove logs until the first-audio issue is truly fixed.
- Assume Railway/web behavior proves iOS app behavior.
- Rebuild repeatedly without recording which build/bundle is on the phone first.
- Interpret a temporary "it works now" as proof the route bug is gone; this issue has already changed state without a new build.

## Rebuild And Test Protocol

For now, iPhone debugging should use Xcode Command+R only.

Before each rebuild:

- Record installed app version/build from Xcode or `devicectl`.
- Record whether the current app behavior is good, better-bad, or broken.
- Keep Capgo `autoUpdate: false`.

After each rebuild:

- Confirm logs show `builtin`, not a downloaded Capgo bundle.
- Confirm app id is `com.kokoromind.app`.
- Run the same voice test three ways:
  - fresh app launch
  - after ending chat with the cross and starting again
  - after force-quitting and reopening
- During a missing-first-words test, check whether audio is quietly coming from the earpiece/receiver.
- If audio is silent while bubbles/animation move, briefly open/close Control Center and note whether audio wakes up. That would strongly support the WebKit/iOS route-race theory.

## Next Candidate Solution Approaches

No action taken here. These are candidate paths only.

### Approach A: Tune Current Prewarm Lifecycle

Idea:

- Keep the temporary mic route alive until output volume becomes nonzero, not just a fixed 2.5 seconds after connect.
- Stop prewarm only after:
  - first audio chunk has arrived, and
  - `getOutputVolume()` is nonzero, or
  - a max timeout is reached.

Why:

- The logs show the failure state is `outputVolume: 0` after chunks arrive.

Risk:

- Two simultaneous mic streams may fight each other in WKWebView.

### Approach B: Fix Restart / Second Session Lifecycle

Idea:

- When user presses cross:
  - end ElevenLabs session
  - release prewarm stream
  - release unlock audio element/context
  - wait a short cleanup window before allowing restart
  - create a fresh voice session instance if needed

Why:

- User reports second start can still begin late.
- Logs showed first run and second run behave differently.

Risk:

- Too much cleanup can cause new iOS permission/route churn.

### Approach C: Proper ElevenLabs WebRTC

Idea:

- Use `conversationToken`, not `signedUrl`.
- Set `connectionType: 'webrtc'`.
- Remove websocket-only options such as `preferHeadphonesForIosDevices`.

Why:

- WebRTC is the more natural stack for low-latency voice and iOS microphone/audio routing.

Risk:

- Previous WebRTC attempt was probably not implemented correctly.
- Needs clean A/B testing against current websocket behavior.

### Approach D: Native iOS Audio Route Plugin

Idea:

- Create a tiny Capacitor plugin that activates the iOS audio session at exactly the mic-tap moment.
- Use `playAndRecord` and speaker routing only during active voice.
- Avoid broad app-launch override.

Why:

- ChatGPT-style voice apps usually rely on native audio/session control, not only WKWebView WebAudio.

Risk:

- Earlier native override broke audio when done globally.
- Must be precise and reversible.

### Approach E: Native Voice Layer / LiveKit Route

Idea:

- Move realtime voice out of WKWebView playback and into a native iOS audio/WebRTC layer.

Why:

- This is likely what robust voice apps do.
- It avoids WebKit's user-gesture and WebAudio routing quirks.

Risk:

- Larger rebuild.
- More engineering work than tuning current path.

### Approach F: UX Guardrail While Fixing

Idea:

- Show a real "connecting voice" state until first audible output is likely ready.
- Do not show speaking animation before output graph is actually producing nonzero volume.

Why:

- It prevents the app from looking like Kokoro is speaking while the user hears nothing.

Risk:

- This improves perceived behavior but does not solve clipped first words.

## Useful Log Lines To Capture

For each iPhone test, capture:

```text
[capgo] startup bundle state
[audio] mic route prewarm start
[audio] mic route prewarm done
[audio] mic route prewarm stopped
[audio] mic route prewarm skipped
[audio] media elements
[audio] conversation media nudge
[audio] conversation media play ok
[audio] conversation media play failed
[11labs] cold iOS first message padding
[11labs] voice tap
[11labs] signed-url fetch done
[11labs] startSession
[11labs] onConnect
[11labs] first audio chunk
[11labs] first speaking mode
[11labs] first agent text
[11labs] audio volume probe
[audio-route]
🔊 [audio-route]
[11labs] onInterruption
[11labs] onDisconnect
```

Interpretation:

- If first audio chunk is late, session setup is the delay.
- If first audio chunk arrives but `outputVolume` is zero, playback/output routing is the delay.
- If output volume is nonzero but nothing is heard, hardware route may be wrong.
- If `[audio-route]` output route is `Receiver` / `BuiltInReceiver`, the sound is going through the ear speaker.
- If `[audio-route]` changes from receiver to speaker during the first message, the first words are probably being lost during route switching.
- If text appears before audio chunk, dashboard/agent text is not the problem.

Important new route labels to compare in one failed run:

```text
voice.tap.before-unlock
voice.tap.after-unlock
voice.prewarm.done
voice.prewarm.skipped
voice.audio-nudge.start
voice.audio-nudge.tick
voice.audio-nudge.done
voice.signed-url.fetch-start
voice.signed-url.fetch-done
voice.start-session.before
voice.on-connect
voice.first-audio-chunk
voice.first-speaking-mode
voice.first-volume-probe
voice.first-output-volume
voice.output-still-zero-after-2s
voice.on-disconnect
native.route-change
native.interruption
```

## Current Working Theory

The iOS app is using ElevenLabs websocket mode inside Capacitor/WKWebView. ElevenLabs sends agent text and audio chunks, but iOS sometimes does not activate or route the WebAudio/MediaStream output immediately when the mic is active. The hidden output graph begins producing audible audio only after the route/output graph wakes up, so the first words are clipped.

The newest suspicion is more specific: iOS may sometimes route the first playback through the receiver/ear speaker or hold the session in a phone-call-like route. The user observed that putting the phone to the ear may have changed the behavior, and the app later worked better without a rebuild. That points to an intermittent iOS route/session state rather than a deterministic code-only regression.

The strongest evidence is:

- Web/Railway/Telegram works.
- Safari on the same iPhone works.
- iPhone logs show first audio chunks arrive.
- UI bubbles and speaking animation appear.
- `outputVolume` can remain zero after chunks arrive.
- Current output/mic prewarm improves the problem but does not eliminate it.
