# Kokoro Infrastructure Plan

**Date:** 2026-05-03  
**Scope:** MVP infrastructure — Vite frontend (already live) + new Python/FastAPI backend `kokoro-api`. Voice persona is **mocked** for MVP (text-only style hints; no reference vocal uploads). Companion implementation plan: `2026-05-03-meditation-generation.md`.

---

## 1. Service topology

```
                     ┌──────────────────────────────────────────────────┐
                     │  USERS                                           │
                     │  ┌───────────────┐         ┌───────────────────┐ │
                     │  │ Browser (Web) │         │ Telegram Mini App │ │
                     │  │ Vite SPA      │         │ same Vite SPA     │ │
                     │  └───────┬───────┘         └─────────┬─────────┘ │
                     └──────────┼───────────────────────────┼───────────┘
                                │  HTTPS (TLS)              │
                                ▼                           ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  RAILWAY PROJECT: kokoro                                            │
   │                                                                     │
   │   ┌──────────────────────┐        ┌────────────────────────────┐    │
   │   │ Service: kokoro-web  │        │ Service: kokoro-api        │    │
   │   │ Vite + React         │        │ Python 3.12 + FastAPI      │    │
   │   │ `vite preview`       │        │ uvicorn on $PORT           │    │
   │   │ Static assets        │  HTTPS │ POST /meditations          │    │
   │   │ Public domain        │ ─────► │ GET  /health               │    │
   │   │ kokoro-web.up.r.app  │        │ Volume: /data (dev only)   │    │
   │   └──────────────────────┘        └─────┬───────┬───────┬──────┘    │
   │                                         │       │       │           │
   │   ┌──────────────────────┐              │       │       │           │
   │   │ Service: cliproxy    │ ◄────────────┘       │       │           │
   │   │ already deployed     │ Anthropic-compat     │       │           │
   │   │ TS proxy             │ proxy                │       │           │
   │   └──────────┬───────────┘                      │       │           │
   │              │ HTTPS                            │       │           │
   └──────────────┼──────────────────────────────────┼───────┼───────────┘
                  │                                  │       │
                  ▼                                  ▼       ▼
        ┌──────────────────┐           ┌─────────────┐  ┌─────────────────┐
        │ Anthropic API    │           │ OpenAI API  │  │ acedata.cloud   │
        │ claude-opus-4-7  │           │ Whisper-1   │  │ Suno wrapper    │
        │ (script gen)     │           │ (STT)       │  │ (audio gen)     │
        └──────────────────┘           └─────────────┘  └─────────────────┘
                                                                 │
                                                                 │ MP3 URL
                                                                 ▼
                                                       ┌────────────────────┐
                                                       │ Cloudflare R2      │
                                                       │ bucket: kokoro-mp3 │
                                                       │ S3 API + signed    │
                                                       │ URLs (30d expiry)  │
                                                       └────────────────────┘

   USER-MANAGED:  kokoro-web, kokoro-api, cliproxy   (Railway services)
   USER-OWNED:    Cloudflare R2 bucket, OpenAI key, acedata key, Anthropic key
   EXTERNAL SaaS: Anthropic, OpenAI, acedata.cloud
```

**Recommended deployment shape:** one Railway project, two new services co-located with the existing CliProxy. Frontend talks to backend via two public subdomains (no reverse-proxy at MVP).

---

## 2. Request flow

```
  User taps "Compose my meditation"            t = 0
  ──────────────────────────────────
  ┌────────────┐  POST /meditations
  │  Browser   │  {callMe, capture, voiceId, contentType,
  │ Vite SPA   │   becoming, mode, locale, requestId, history?}
  └─────┬──────┘
        │ HTTPS, ~30-150ms RTT
        ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Railway edge → kokoro-api (uvicorn)                              │
  │                                                                  │
  │  Stage 1: STT (only if capture.kind == "voice")                  │
  │    httpx → api.openai.com  ~2-5s                                 │
  │    (skipped for typed/chip capture)                              │
  │                                                                  │
  │  Stage 2: template-pick  ~5-30ms in-process                      │
  │    score templates by becomingMatch + themeKeywords + mode       │
  │                                                                  │
  │  Stage 3: LLM script gen  ~10-25s                                │
  │    httpx → cliproxy → api.anthropic.com                          │
  │    model = claude-opus-4-7, prompt cache on system+template      │
  │    ~3000 in (cached) + ~1500 out tokens                          │
  │                                                                  │
  │  Stage 4: Suno generation  ~30-60s (best-of-2 + extend)          │
  │    httpx → api.acedata.cloud/suno/audios                         │
  │    custom mode, lyrics = LLM script, style = preset+template,    │
  │    persona_id = "" for MVP (default Suno voice)                  │
  │    poll for completion → download MP3                            │
  │                                                                  │
  │  Stage 5: blob persist  ~0.2-1s                                  │
  │    BlobStore.put(audio.mp3 + meta.json) → signed URL (30d)       │
  └─────┬────────────────────────────────────────────────────────────┘
        │ HTTPS 200 JSON                                t ~ 45-90s
        ▼
  ┌────────────┐  Player.tsx loads audioUrl into <audio>
  │  Browser   │  range requests stream MP3 from R2 / FS
  └─────┬──────┘
        ▼ stream MP3 begins, ~50-200ms TTFB
  playback
```

| Hop | Endpoint | TLS | Latency budget |
|---|---|---|---|
| Browser → Railway edge | `kokoro-api.up.railway.app` | yes | 30-150 ms |
| api → OpenAI Whisper | `api.openai.com` | yes | 2-5 s |
| api → CliProxy | existing Railway service | yes | 5-15 ms |
| CliProxy → Anthropic | `api.anthropic.com` | yes | 10-25 s |
| api → Suno (acedata) | `api.acedata.cloud` | yes | 30-60 s |
| api → R2 | `<acct>.r2.cloudflarestorage.com` | yes | 200-800 ms |
| Browser → R2 (audio) | signed R2 URL | yes | 50-200 ms TTFB |

---

## 3. Audio file lifecycle

```
  Stage 4 done           Stage 5: persist                     Playback
  ────────────           ──────────────────────              ─────────
  Suno MP3       ──┐     ┌────────────────────────┐          ┌──────────┐
  ~5-10MB         │     │ kokoro-api buffer      │ S3 PUT   │ R2 obj   │
  HTTPS           │ →   │ + sidecar JSON (script,│ ──────►  │  *.mp3   │
                  │     │   beats, providerMeta) │           │  *.json  │
                  │     └────────────────────────┘           └────┬─────┘
                                                                  │
                                                                  ▼ signed URL (30d)
                                                            ┌──────────────┐
                                                            │  Browser     │
                                                            │  <audio src> │
                                                            └──────────────┘

  Day 0      audio + meta written, signed URL minted (expires day 30)
  Day 30     URL expires; object still exists physically
  Day 30+    R2 lifecycle rule auto-deletes
```

The MP3 is **not deterministically reproducible** (Suno is stochastic), but `script + beats + templateUsedId + providerMeta` are returned inline in the API response, so the *information* is recoverable from the client side.

---

## 4. Service inventory

| Name | Runtime | Where | Purpose | Scaling | Public/Private |
|---|---|---|---|---|---|
| kokoro-web | Node 20 (vite preview) | Railway | Serves the SPA (web + Mini App) | 1 replica, vertical | Public HTTPS |
| kokoro-api | Python 3.12 + FastAPI + uvicorn | Railway | Orchestrates STT → LLM → Suno → blob | 1 replica, async I/O-bound | Public HTTPS |
| cliproxy | (existing) | Railway | Anthropic-compatible proxy | 1 replica, already running | Public HTTPS |
| Anthropic API | external | api.anthropic.com | LLM (Opus 4.7) | external | External |
| OpenAI Whisper | external | api.openai.com | STT for voice flow | external | External |
| Suno (acedata) | external | api.acedata.cloud | Audio gen | external | External |
| Cloudflare R2 | external | `<acct>.r2.cloudflarestorage.com` | Audio + meta blob storage | external | External (signed URLs) |

`kokoro-api` is async (FastAPI + httpx). One Railway replica with 1-2 uvicorn workers can hold tens of concurrent in-flight requests since each is dominated by I/O wait. Bottleneck is upstream rate limits (Suno concurrent jobs, Anthropic TPM), not Python compute.

---

## 5. Environment variable inventory

### kokoro-api

| Variable | Source / owner | Required | Security |
|---|---|---|---|
| `PORT` | Railway-injected | yes | n/a |
| `LOG_LEVEL` | operator | optional, default `INFO` | public |
| `CORS_ORIGIN` | operator | yes (comma-separated) | public |
| `ANTHROPIC_BASE_URL` | operator | yes | public |
| `ANTHROPIC_API_KEY` | Anthropic dashboard | yes | secret |
| `ANTHROPIC_MODEL` | operator | optional, default `claude-opus-4-7` | public |
| `WHISPER_API_KEY` | OpenAI dashboard | yes | secret |
| `WHISPER_BASE_URL` | operator | optional, default OpenAI | public |
| `SUNO_BASE_URL` | operator | yes (default acedata) | public |
| `SUNO_API_KEY` | acedata dashboard | yes | secret |
| `BLOB_DRIVER` | operator | yes (`filesystem` or `s3`) | public |
| `BLOB_FS_DIR` | operator | yes when filesystem | public |
| `BLOB_S3_BUCKET` | R2 | when s3 | public |
| `BLOB_S3_ENDPOINT` | R2 | when s3 | public |
| `BLOB_S3_ACCESS_KEY` | R2 token | when s3 | secret |
| `BLOB_S3_SECRET_KEY` | R2 token | when s3 | secret |
| `BLOB_PUBLIC_BASE_URL` | R2 / custom domain | optional | public |

### kokoro-web

| Variable | Source | Required | Security |
|---|---|---|---|
| `PORT` | Railway-injected | yes | n/a |
| `VITE_API_BASE` | operator | yes (e.g. `https://kokoro-api.up.railway.app`) | public (compiled into JS) |

`VITE_*` are baked into the bundle at build-time — never put secrets here.

---

## 6. Cost estimates

### Per-meditation breakdown

| Item | Per session | Notes |
|---|---|---|
| Whisper (only when voice) | ~$0.006 | $0 for typed/chip flows |
| Anthropic Opus 4.7 | ~$0.10-0.15 | input $15/M (90% cached), output $75/M × ~1500 tok |
| Suno (best-of-2, maybe extend) | $0.10-0.20 | dominant cost |
| R2 storage (5 MB × 30d) | ~$0.0001 | rounding error |
| R2 egress | $0 | R2 has free egress |
| Railway compute (amortized) | ~$0.001 | small instance |
| **Total** | **~$0.20-0.40** | |

### Monthly running cost

| Meditations/mo | Variable (~$0.28 avg) | Railway fixed | R2 storage | **Total** |
|---|---|---|---|---|
| 100 | $28 | $10-15 | <$0.01 | **~$40** |
| 1 000 | $280 | $15-20 | $0.08 | **~$300** |
| 10 000 | $2 800 | $35-55 | $0.75 | **~$2 850** |

Variable cost scales linearly. Fixed Railway floor is ~$15-20/mo at MVP.

---

## 7. Provisioning checklist

In order, before deploy:

1. **OpenAI account + API key** (Whisper). Save as `WHISPER_API_KEY`.
2. **acedata.cloud account + Suno key.** Save as `SUNO_API_KEY`.
3. **(Skipped at MVP) reference vocal recordings** — voice presets are text-only style hints in `voice_presets.json`. Persona bootstrap is post-MVP work.
4. **Cloudflare R2 bucket + access keys** (when going to prod; dev uses local filesystem).
   - Create `kokoro-mp3` bucket, region `auto`.
   - Set lifecycle rule: delete > 30 days.
   - Generate API token scoped to that bucket.
   - Save `BLOB_S3_*` vars; set `BLOB_DRIVER=s3`.
5. **Rotate `ANTHROPIC_API_KEY`** in CliProxy (was leaked in chat earlier).
6. **Railway service `kokoro-api`** — root `api/`, build `uv sync --frozen`, start `uv run uvicorn kokoro_api.main:app --host 0.0.0.0 --port $PORT`, health `/health`.
7. **Update `kokoro-web` env** with `VITE_API_BASE=https://kokoro-api.up.railway.app`. Redeploy.
8. **Smoke**: `curl /health` → 200; full `/meditations` round-trip from the SPA.

---

## 8. Local dev setup

```
  Terminal 1                              Terminal 2
  ──────────                              ──────────
  cd api                                  cd app
  cp .env.example .env                    pnpm install
  # paste real keys                       pnpm dev
  uv sync --all-extras                          │
  uv run uvicorn kokoro_api.main:app \           │
    --reload --port 8787                        │
                  │                             │
                  │ http://localhost:8787       │ http://localhost:5173
                  ▼                             ▼
            FastAPI (CORS allows                Vite SPA
            http://localhost:5173)              calls VITE_API_BASE
                  │                             = http://localhost:8787
                  ▼
            ./blob-data/<medId>.mp3      ← audio served by FastAPI
            ./blob-data/<medId>.json       static mount at /blob/*
```

Rules:
- `api/.env` is git-ignored; `api/.env.example` is the template.
- `app/.env.development.local` holds `VITE_API_BASE=http://localhost:8787`.
- For voice STT in dev: hit real OpenAI API (~$0.006/min) or stub via env flag.

---

## 9. Deployment plan

**Recommendation: one Railway project, two services with separate public subdomains. Do NOT co-deploy.**

Two runtimes, two scaling profiles, two log streams. Co-deploying via reverse proxy adds complexity for zero MVP-scale benefit. Two subdomains is the simplest setup; switching to a single custom domain (`kokoro.app` / `api.kokoro.app`) later is a 5-minute change.

### kokoro-api Railway settings

| Setting | Value |
|---|---|
| Root directory | `api/` |
| Builder | Nixpacks (auto, Python detected via `pyproject.toml`) |
| Build | `uv sync --frozen` |
| Start | `uv run uvicorn kokoro_api.main:app --host 0.0.0.0 --port $PORT` |
| Healthcheck | `/health`, 30s timeout |
| Volume (dev only) | `/data` mounted, `BLOB_DRIVER=filesystem`, `BLOB_FS_DIR=/data` |

### kokoro-web (existing)

| Setting | Value |
|---|---|
| Root | `app/` |
| Build | `pnpm install --frozen-lockfile && pnpm build` |
| Start | `pnpm start` (already wired in `app/package.json`) |
| Env | `VITE_API_BASE` (build-time) |

### Promotion path

1. Deploy `kokoro-api` with `BLOB_DRIVER=filesystem` first. Verify `/health` and one `/meditations` round-trip.
2. Provision R2, switch to `BLOB_DRIVER=s3`, re-test.
3. Update `kokoro-web` env with the api URL, redeploy.

---

## 10. Operational concerns

### Logs
`structlog` JSON to stdout. Each line carries `requestId`, `meditationId`, `stage`, `latencyMs`, `providerStatus`. Railway captures stdout; default retention ~7 days. Add a log drain (Logtail / Better Stack) when needed.

### Observability gap (what's missing, in order to add)
1. Per-stage latency histograms (timestamps already in structlog).
2. Provider error-rate counters (`provider="anthropic|openai|suno|r2"` × `status_class`).
3. p50/p95 end-to-end latency, sliced by `contentType` and `mode`.
4. Alerts on Suno failure rate > 5% / 15 min, Anthropic via CliProxy 5xx > 5%, kokoro-api 5xx > 1%.

### Failure modes / frontend fallback

| Upstream failure | Backend response | UX |
|---|---|---|
| Suno outage | 502 `providerError="suno"` | "Audio service is taking a breath" + retry |
| Whisper rate-limited | 429 `providerError="openai"`, retried with backoff | If still failing → prompt user to type |
| Whisper down | 502 | Frontend offers text-only path (already supported) |
| Anthropic via CliProxy down | 502 `providerError="anthropic"` | Generic retry |
| R2 down | 502 `providerError="blob"` | Generic retry — budget already spent |
| api itself down | Railway healthcheck restarts | Connection error UI |
| > 120s timeout | 504 | Retry |

### Backups
Audio MP3s not backed up. R2 has built-in durability; no PIT backup. Acceptable: script + beats + template ID are returned inline so info is recoverable client-side. Templates are git-versioned. No DB to back up.

### Secrets rotation
Anthropic via CliProxy config (out of scope here). OpenAI / acedata / R2: regenerate in vendor dashboard, paste into Railway env, redeploy. ~5 min each.

---

## 11. Out of scope, by design

- Continuity / history persistence (no DB; `history?` is consumed for prompt context only).
- User accounts, sign-in, profiles.
- Billing / paywall / subscription metering.
- Observability/APM.
- Vector embedding template search (current selector is rule-based scoring).
- Rate limiting and abuse protection.
- Voice-upload endpoint for browser-recorded blobs.
- iOS native client (web + Telegram Mini App is the MVP surface).
- Auth on `/meditations` (CORS-only origin gating at MVP).
- Multi-region deploy.
- Custom domains.
- Suno Persona uploads (mocked at MVP via text style hints).
- Local model swap (faster-whisper, sentence-transformers).

---

## Topology summary (one paragraph)

Two-service Railway deployment inside one project: `kokoro-web` (existing Vite SPA, also serves the Telegram Mini App) and `kokoro-api` (new Python 3.12 + FastAPI + uvicorn). The api service is stateless and synchronous, orchestrating five stages per `/meditations` request — Whisper STT, in-process template selection, Anthropic Opus 4.7 via the existing CliProxy Railway service, Suno end-to-end via acedata.cloud (with mocked text-only voice presets at MVP), and a pluggable BlobStore that writes filesystem-on-volume in dev and Cloudflare R2 in prod with 30-day signed URLs. Two services talk over public HTTPS subdomains gated by CORS; no reverse proxy, no DB, no queue, no worker pool. Per-meditation cost ~$0.20-0.40 (Suno + Anthropic output tokens dominate); fixed Railway floor ~$15-20/mo; R2's free egress keeps audio bandwidth at zero marginal cost.
