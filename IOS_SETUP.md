# Kokoro iOS — first-run setup (Mac)

This is the one-time setup to get Kokoro running on iPhone. Everything below runs on the Mac. The PC is fine for everyday editing — only the Xcode steps need the Mac.

## 0. Prereqs on the Mac

```bash
# Xcode 16 from the Mac App Store (must be open at least once, accept the license)
sudo xcodebuild -license accept
xcode-select --install                 # command line tools

# Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install cocoapods                 # required by Capacitor iOS
brew install node                      # if you don't already have it
npm install -g pnpm                    # match the PC's package manager
```

Sign Xcode into your Apple ID:
- Xcode → Settings → Accounts → "+" → Apple ID → use the one tied to your Apple Developer account.

## 1. Pull the repo on the Mac

```bash
git clone <your repo URL>
cd "<repo>/app"
pnpm install
```

(Or `git pull` if the repo is already there.)

## 2. Add the iOS project — first time only

```bash
cd "<repo>/app"
pnpm build              # generates dist/ that Capacitor will copy into iOS
npx cap add ios         # creates app/ios/ — Xcode project. Commit this.
npx cap sync ios        # installs CocoaPods, copies dist/ into the iOS bundle
```

After this you'll have an `app/ios/` directory. Commit it back to git so future `cap sync` calls on either machine work.

## 3. Configure the Xcode project

```bash
npx cap open ios
```

This opens Xcode on the workspace. Do the following one-time setup:

1. Select the **App** target in the left sidebar.
2. **General tab → Identity:**
   - Display Name: `Kokoro`
   - Bundle Identifier: `com.kokoromind.app` (must match `capacitor.config.ts`)
   - Version: `1.0.0`, Build: `1`
3. **Signing & Capabilities tab:**
   - Tick "Automatically manage signing"
   - Team: select your Apple Developer team
   - Xcode will create a provisioning profile automatically
4. **Info tab → Custom iOS Target Properties** — add these two keys (right-click → Add Row):
   - `NSMicrophoneUsageDescription` = `Kokoro listens to your voice so it can write a meditation that matches how you actually feel.`
   - `NSSpeechRecognitionUsageDescription` = `Kokoro uses speech recognition to turn what you say into the meditation it writes for you.`

## 4. Generate app icons and splash

Drop a single source image at `app/assets/icon.png` (1024×1024, no transparency, no rounded corners — Apple adds those) and a splash at `app/assets/splash.png` (2732×2732, centered logo on the cream background `#F4EFE6`). Then:

```bash
cd "<repo>/app"
npx capacitor-assets generate --ios
```

For v1 you can use the Kokoro mascot still frame from `app/public/kokoro3/`. Higher-quality icons can ship in v1.1 via OTA — no re-review needed.

## 5. Run on the simulator (fast iteration)

```bash
npx cap run ios
```

Or in Xcode: select an iPhone 16 simulator from the scheme picker → ⌘R.

> ⚠️ The simulator's microphone is unreliable. Use it for layout, NOT for ElevenLabs voice chat or mic-permission flows. For those, use a real iPhone (step 6).

## 6. Run on a real iPhone

1. Connect iPhone via USB. Trust the computer when prompted.
2. In Xcode, select your iPhone as the run destination.
3. ⌘R to install and launch.
4. On the iPhone: Settings → General → VPN & Device Management → trust your developer cert (only first time).
5. Walk the full ritual: welcome → name → feeling → source → promise → chat → player. Confirm:
   - Mic permission prompt appears once.
   - ElevenLabs voice chat connects.
   - Mascot videos render with cream cutout (the `mix-blend-mode` trick — should look identical to Telegram on iPhone).
   - Meditation generates and audio plays.

## 7. Upload to TestFlight

1. In Xcode: scheme picker → "Any iOS Device (arm64)".
2. Product → Archive. Wait for the archive to build (a few minutes).
3. Organizer window opens → "Distribute App" → "App Store Connect" → "Upload" → next, next, next.
4. After ~10–15 minutes processing, the build appears in **App Store Connect → TestFlight tab**.

In App Store Connect:
1. Apps → "+" → New App
   - Bundle ID: `com.kokoromind.app` (pick from dropdown after Xcode upload)
   - Name: `Kokoro`
   - Primary language: English (U.S.)
   - SKU: `kokoro-ios-1` (any unique string)
2. Once the build shows in TestFlight, add it to the "Internal Testing" group → invite yourself via your Apple ID.
3. On iPhone: install the **TestFlight** app from the App Store, accept the invite email, install the build.

## 8. The everyday loop

After this initial setup, normal day-to-day:

**On PC** — edit code, push to git.

**On Mac** — pull, then:
```bash
cd "<repo>/app"
pnpm install            # if deps changed
pnpm build
npx cap sync ios        # copies new dist/ into iOS bundle
npx cap open ios        # then Product → Archive → upload
```

## What you (the user) need to do, in order

1. ✅ Apple Developer account paid (done).
2. ✅ Bundle ID: `com.kokoromind.app`. This is permanent once you publish.
3. ☐ App Store Connect → Agreements, Tax, and Banking → sign the **Free Apps** agreement. Fill the tax form (W-8BEN if non-US, W-9 if US).
4. ☐ Decide and host the privacy policy URL. The page is already written at [app/public/privacy.html](app/public/privacy.html); it will be live at `<your-railway-url>/privacy.html` after the next Railway deploy.
5. ☐ Provide a 1024×1024 app icon source PNG (or tell me to use the Kokoro mascot still). Drop it at `app/assets/icon.png`.
6. ☐ Decide on App Store listing copy: name (max 30 chars), subtitle (30), description, keywords (100). I can draft these.
7. ☐ Take 3–10 screenshots on a 6.7" iPhone (iPhone 15 Pro Max or 16 Pro Max) once the TestFlight build runs.

I do everything else — Capacitor scaffolding (already done), code changes, Xcode config docs, store metadata drafts.

## Backend / Telegram impact

**None.** The Railway frontend keeps serving the web + Telegram Mini App at https://kokoro-main-production.up.railway.app/ unchanged. The Railway backend keeps running unchanged. The iOS app bundles the same `dist/` and calls the same API. Three deploy targets, one codebase.
