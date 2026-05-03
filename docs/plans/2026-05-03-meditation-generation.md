# Meditation Audio Generation — Implementation Plan (Python)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend pipeline that turns user input (`callMe + capture + voice + contentType + becoming + mode`) into a personalized meditation audio file, with provider boundaries that let us swap Suno (and any other model dependency) without rewriting business logic.

**Architecture:** A new Python service in `api/` exposes a single `POST /meditations` endpoint. The endpoint orchestrates 5 stages — transcription → template selection → script generation (Anthropic) → audio synthesis (Suno) → persistence. Each external system (STT, LLM, audio gen, blob store) is hidden behind an abstract base class, with one concrete implementation each at MVP. Replacement = one DI line + a new adapter class.

**Tech Stack:** Python 3.12 + FastAPI (HTTP, async) + Pydantic v2 (schema validation, types), uv (deps + lockfile + venv), uvicorn (ASGI server), pytest + pytest-asyncio (tests), httpx (async HTTP for Suno + Whisper), `anthropic` (official SDK; targets the CliProxy proxy via `base_url`), structlog (logger). No DB at MVP — meditations persist as JSON metadata next to their audio file in blob storage.

**Why Python:** Future-proofs the stack for local model work (faster-whisper for STT, sentence-transformers + FAISS for embedding-based template search in V2, pydub/librosa for any client-side audio mixing if hybrid TTS+Suno-bed is ever needed). The HTTP API surface stays identical to what the frontend expects — only the implementation language changes.

---

## Locked decisions

These are not up for re-litigation in this plan. If reality forces a change, write a new plan.

| Decision | Choice | Reason |
|---|---|---|
| Backend host | Railway, same project as Vite app | Project already deploys there; one host = simpler env management |
| Language | Python 3.12 | Local-model future-proofing; richer ML/audio ecosystem |
| HTTP framework | FastAPI | Async, Pydantic-native, OpenAPI auto-generated |
| Validation | Pydantic v2 | Single source of truth for runtime + types; aliases preserve camelCase JSON contract |
| Package manager | uv | Fast, modern, single-tool venv + lockfile + run |
| LLM | Anthropic via CliProxy (`ANTHROPIC_BASE_URL=https://ourcliproxy-production.up.railway.app`) | User-provided proxy already works |
| LLM model | `claude-opus-4-7` for script gen | Best for nuanced therapeutic-warm prose |
| LLM SDK | `anthropic` official Python SDK | Use `base_url` to target CliProxy |
| STT | OpenAI Whisper-1 via direct API (httpx) | Web Speech (in browser) is fallback only — quality too inconsistent for long-form |
| Audio gen | Suno via `acedata.cloud` wrapper | Stable wrapper, supports custom mode + persona + audio reference + extend |
| Audio strategy | Suno end-to-end (vocal + music in one job), with provider abstraction so hybrid swap (TTS + Suno bed) is possible later | Per BUSINESS.md §6 |
| Voice persistence | **MVP: mock — 4 voice presets are text-only style hints** (e.g. `"soft female voice, slow whisper, warm"`) appended to Suno style prompt. Suno's voice will drift between generations; that's accepted MVP risk. **Post-MVP:** record 4 reference vocals → upload as Suno Personas → fill `persona_id` in `voice_presets.json`; the data shape already supports this |
| Storage | S3-compatible (Railway volume in dev, Cloudflare R2 in prod) behind `BlobStore` abstract base class | No DB needed for MVP; meta as sibling JSON |
| Template format | JSON files in repo `templates/`, selected by rule-based matcher | Vector search is V2 |
| JSON casing | Frontend continues to send camelCase; Pydantic uses `Field(alias=...)` + `populate_by_name=True` so internal Python code uses snake_case | No frontend rewrite needed |
| Tests | pytest + pytest-asyncio, golden-file tests for prompt outputs, contract tests for each provider | TDD on business logic; integration tests behind a `--integration` flag (real API calls cost money) |
| Lint/format | `ruff` (single tool: linter + formatter) | One-config replacement for flake8 + black + isort |

---

## End-to-end flow

```
                                                ┌──────────────────────────┐
POST /meditations  ──►  validate (Pydantic) ──► │ 1. resolve_capture       │
                                                │    voice → Whisper       │
                                                │    text → passthrough    │
                                                │    theme → join chips    │
                                                └────────────┬─────────────┘
                                                             ▼
                                                ┌──────────────────────────┐
                                                │ 2. select_template       │
                                                │    (content_type, becoming│
                                                │     keywords, mode)      │
                                                │     → TemplateBeats +    │
                                                │       reference_track_urls│
                                                └────────────┬─────────────┘
                                                             ▼
                                                ┌──────────────────────────┐
                                                │ 3. generate_script       │
                                                │    Anthropic Opus 4.7    │
                                                │    system + user blocks  │
                                                │    prompt cache on sys+  │
                                                │    template              │
                                                │    → { script, beats[] } │
                                                └────────────┬─────────────┘
                                                             ▼
                                                ┌──────────────────────────┐
                                                │ 4. synthesize_audio      │
                                                │    Suno custom mode      │
                                                │    persona = voice_id map│
                                                │    style = template.music_prompt
                                                │    refs = template.refs  │
                                                │    extend if >4min       │
                                                │    best-of-2 selection   │
                                                │    → { audio_bytes,      │
                                                │        duration_sec }    │
                                                └────────────┬─────────────┘
                                                             ▼
                                                ┌──────────────────────────┐
                                                │ 5. persist               │
                                                │    BlobStore.put audio   │
                                                │    BlobStore.put meta    │
                                                │    → audio_url           │
                                                └────────────┬─────────────┘
                                                             ▼
                                                  GenerateMeditationOutput
```

---

## Public I/O contract

The contract between frontend and `/api/meditations`. The exact shape lives in `api/src/kokoro_api/types.py`. JSON keys are camelCase (so the frontend doesn't change); Pydantic's alias generator handles it.

### Request — `POST /meditations`

JSON body (camelCase):

```json
{
  "callMe": "string (1..24 chars)",
  "realName": "string (≤60 chars, optional)",
  "mode": "soft | sharp",

  "capture": {
    "kind": "voice | text | theme",
    // when voice: { "audioUrl": "https://...", "mimeType": "audio/webm" }
    // when text:  { "text": "..." }
    // when theme: { "chips": ["anxious", "tired"] }
  },

  "contentType": "unwind | attract | lockin",
  "becoming": "calm | sleep | focus | detachment | confidence | softness | power | future | action  (optional)",
  "voiceId": "mira | brad | aiko | sage",

  "history": {
    "previousScripts": ["...", "..."],
    "lastBecoming": "..."
  },

  "locale": "en | ru",
  "requestId": "uuid"
}
```

### Response — `200 OK`

```json
{
  "meditationId": "uuid",
  "audioUrl": "https://cdn/.../audio.mp3?sig=...",
  "durationSec": 360,
  "script": "the full text the audio narrates",
  "beats": [
    { "startSec": 0, "durationSec": 30, "text": "...", "type": "opening" }
  ],
  "templateUsedId": "unwind_release_pressure_01",
  "generatedAt": "2026-05-03T12:34:56Z",
  "providerMeta": {
    "transcription": { "provider": "...", "latencyMs": 0, "confidence": 0.91 },
    "llm":           { "provider": "anthropic", "model": "claude-opus-4-7", "latencyMs": 3200, "tokensIn": 0, "tokensOut": 0, "cacheReadTokens": 0 },
    "audio":         { "provider": "suno-acedata", "jobId": "...", "latencyMs": 0, "candidates": 2, "chosenCandidate": 0 },
    "persistence":   { "provider": "filesystem", "latencyMs": 0 },
    "totalLatencyMs": 0
  }
}
```

`beats[i].type ∈ "opening" | "line" | "breath" | "pause" | "closing"`.

### Errors

```python
# 400 — Pydantic validation failure
{"error": "INVALID_INPUT", "details": <pydantic_error_dict>}

# 422 — provider returned unusable output
{"error": "AUDIO_GEN_FAILED", "details": {"lastJobIds": ["..."], "reason": "..."}}

# 429 — rate limited by upstream
{"error": "UPSTREAM_RATE_LIMIT", "details": {"retryAfterSec": 30}}

# 504 — upstream timeout
{"error": "UPSTREAM_TIMEOUT", "details": {"stage": "transcription|llm|audio"}}

# 500 — anything else
{"error": "INTERNAL", "details": {"traceId": "..."}}
```

### Request constraints

- `callMe`: 1–24 chars, no newlines.
- `capture.text`: max 2000 chars; `chips`: max 6.
- `capture.voice.audioUrl`: must be reachable by the API; max 60s of audio, max 5MB.
- Total request body ≤ 64KB (audio is referenced by URL, not inlined).

---

## File structure

New top-level `api/` Python service. Templates live at repo root. No package re-export — Python's import system handles it natively.

```
KOKORO---MAIN/
├── api/
│   ├── pyproject.toml                          # uv-managed
│   ├── uv.lock
│   ├── .env.example
│   ├── README.md
│   ├── src/
│   │   └── kokoro_api/
│   │       ├── __init__.py
│   │       ├── main.py                         # FastAPI bootstrap, CORS, routes
│   │       ├── types.py                        # Pydantic models + I/O schemas
│   │       ├── config.py                       # Pydantic Settings
│   │       ├── routes/
│   │       │   ├── __init__.py
│   │       │   └── meditations.py              # POST /meditations
│   │       ├── pipeline/
│   │       │   ├── __init__.py
│   │       │   ├── orchestrator.py             # the 5-stage flow
│   │       │   ├── resolve_capture.py          # stage 1
│   │       │   ├── select_template.py          # stage 2
│   │       │   ├── generate_script.py          # stage 3 (LLM)
│   │       │   ├── synthesize_audio.py         # stage 4 (Suno)
│   │       │   └── persist.py                  # stage 5
│   │       ├── providers/
│   │       │   ├── __init__.py
│   │       │   ├── stt/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── base.py                 # TranscriptionProvider ABC
│   │       │   │   └── whisper.py
│   │       │   ├── llm/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── base.py                 # ScriptGenerator ABC
│   │       │   │   └── anthropic_provider.py   # via CliProxy
│   │       │   ├── audio/
│   │       │   │   ├── __init__.py
│   │       │   │   ├── base.py                 # MeditationAudioProvider ABC
│   │       │   │   ├── suno.py                 # acedata.cloud adapter
│   │       │   │   └── personas.json           # voiceId → personaId map (committed)
│   │       │   └── blob/
│   │       │       ├── __init__.py
│   │       │       ├── base.py                 # BlobStore ABC
│   │       │       ├── filesystem.py           # dev
│   │       │       └── s3.py                   # prod (R2-compatible)
│   │       ├── prompt/
│   │       │   ├── __init__.py
│   │       │   ├── system.py
│   │       │   ├── user.py
│   │       │   └── parse.py
│   │       ├── templates/
│   │       │   ├── __init__.py
│   │       │   └── loader.py                   # load + validate templates from repo /templates
│   │       └── lib/
│   │           ├── __init__.py
│   │           └── errors.py                   # typed error classes
│   ├── scripts/
│   │   └── bootstrap_personas.py               # one-time: create 4 Suno personas → personas.json
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py                         # pytest fixtures + integration flag
│       ├── pipeline/
│       │   ├── test_resolve_capture.py
│       │   ├── test_select_template.py
│       │   ├── test_generate_script.py
│       │   └── test_orchestrator.py
│       ├── prompt/
│       │   ├── test_system.py
│       │   ├── test_user.py
│       │   └── test_parse.py
│       ├── providers/
│       │   ├── test_anthropic_contract.py      # integration, gated
│       │   ├── test_suno_contract.py           # integration, gated
│       │   ├── test_whisper_contract.py        # integration, gated
│       │   └── test_filesystem_blob.py
│       ├── templates/
│       │   └── test_loader.py
│       └── routes/
│           └── test_meditations.py             # full FastAPI request/response
│
├── templates/                                  # already seeded; language-agnostic
│   ├── README.md
│   ├── unwind/unwind_release_pressure_01.json
│   ├── attract/attract_amsterdam_morning_01.json
│   └── lockin/lockin_one_rep_01.json
│
└── app/src/lib/
    └── types-meditation.ts                     # frontend mirror; hand-maintained from api/src/kokoro_api/types.py
```

---

## Provider interfaces (the swap-points)

Python ABCs (abstract base classes). Replacing Suno = subclassing `MeditationAudioProvider` and changing one DI line in `main.py`.

```python
# api/src/kokoro_api/providers/stt/base.py
from abc import ABC, abstractmethod
from pydantic import BaseModel
from typing import Literal

class TranscriptionResult(BaseModel):
    text: str
    confidence: float
    latency_ms: int

class TranscriptionProvider(ABC):
    name: str

    @abstractmethod
    async def transcribe(self, *, audio_url: str, mime_type: str, locale: Literal['en','ru']) -> TranscriptionResult: ...

# api/src/kokoro_api/providers/llm/base.py
class LlmResult(BaseModel):
    raw_json: str
    tokens_in: int
    tokens_out: int
    cache_read_tokens: int
    latency_ms: int

class ScriptGenerator(ABC):
    name: str
    model: str

    @abstractmethod
    async def generate(self, *, system_prompt: str, user_prompt: str, cache_key: str) -> LlmResult: ...

# api/src/kokoro_api/providers/audio/base.py
class AudioResult(BaseModel):
    audio_bytes: bytes
    mime_type: Literal['audio/mpeg']
    duration_sec: int
    job_ids: list[str]
    chosen_candidate: int
    latency_ms: int

class MeditationAudioProvider(ABC):
    name: str

    @abstractmethod
    async def synthesize(
        self, *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Literal['en','ru'],
        candidates: int,
    ) -> AudioResult: ...

# api/src/kokoro_api/providers/blob/base.py
class PutResult(BaseModel):
    url: str
    latency_ms: int

class BlobStore(ABC):
    name: str

    @abstractmethod
    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult: ...

    @abstractmethod
    async def signed_url(self, key: str, expiry_sec: int) -> str: ...
```

---

## Tasks

Each task ends with a commit. TDD where the logic is non-trivial; for plumbing (config wiring, env loading) skip the failing-test ritual.

### Task 1: Bootstrap the api/ service

**Files:**
- Create: `api/pyproject.toml`, `api/.env.example`, `api/README.md`
- Create: `api/src/kokoro_api/__init__.py`, `api/src/kokoro_api/main.py`, `api/src/kokoro_api/config.py`
- Create: `api/tests/__init__.py`, `api/tests/conftest.py`

- [ ] **Step 1: Initialize uv project**

```bash
mkdir -p api/src/kokoro_api api/tests api/scripts
cd api
uv init --package --name kokoro-api --no-readme
```

- [ ] **Step 2: Configure pyproject.toml**

`api/pyproject.toml`:

```toml
[project]
name = "kokoro-api"
version = "0.0.1"
description = "Kokoro meditation generation backend"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.32",
    "pydantic>=2.9",
    "pydantic-settings>=2.6",
    "httpx>=0.27",
    "anthropic>=0.40",
    "structlog>=24.4",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3",
    "pytest-asyncio>=0.24",
    "pytest-cov>=5.0",
    "ruff>=0.7",
    "mypy>=1.13",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/kokoro_api"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
markers = ["integration: tests that hit real upstream APIs"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "N", "UP", "B", "ASYNC", "S", "RUF"]
ignore = ["S101"]  # allow assert in tests

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S"]

[tool.mypy]
strict = true
python_version = "3.12"
```

- [ ] **Step 3: Install deps**

```bash
cd api
uv sync --all-extras
```

This creates `.venv/` and `uv.lock`.

- [ ] **Step 4: Config loader with Pydantic Settings**

`api/src/kokoro_api/config.py`:

```python
from __future__ import annotations

from typing import Literal

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = Field(default=8787, ge=1, le=65535)
    node_env: Literal["development", "production", "test"] = Field(
        default="development", validation_alias="NODE_ENV"
    )

    anthropic_base_url: AnyHttpUrl
    anthropic_api_key: str = Field(min_length=20)
    anthropic_model: str = "claude-opus-4-7"

    whisper_api_key: str = Field(min_length=20)
    whisper_base_url: AnyHttpUrl = AnyHttpUrl("https://api.openai.com/v1")

    suno_base_url: AnyHttpUrl = AnyHttpUrl("https://api.acedata.cloud/suno")
    suno_api_key: str = Field(min_length=20)

    blob_driver: Literal["filesystem", "s3"] = "filesystem"
    blob_fs_dir: str = "./blob-data"
    blob_s3_bucket: str | None = None
    blob_s3_endpoint: AnyHttpUrl | None = None
    blob_s3_access_key: str | None = None
    blob_s3_secret_key: str | None = None
    blob_public_base_url: AnyHttpUrl | None = None

    cors_origin: str = "http://localhost:5173"


def load_config() -> Config:
    try:
        return Config()  # type: ignore[call-arg]
    except Exception as e:
        # Pydantic raises ValidationError; surface the cause and exit with non-zero.
        import sys
        sys.stderr.write(f"Invalid config: {e}\n")
        sys.exit(1)
```

- [ ] **Step 5: FastAPI bootstrap**

`api/src/kokoro_api/main.py`:

```python
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from kokoro_api.config import load_config

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("kokoro_api.startup")
    yield
    log.info("kokoro_api.shutdown")


config = load_config()
app = FastAPI(lifespan=lifespan, title="kokoro-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in config.cors_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, object]:
    import time
    return {"ok": True, "ts": int(time.time() * 1000)}


def serve() -> None:
    import uvicorn
    uvicorn.run(
        "kokoro_api.main:app",
        host="0.0.0.0",
        port=config.port,
        log_level="info" if config.node_env == "production" else "debug",
    )


if __name__ == "__main__":
    serve()
```

`api/src/kokoro_api/__init__.py`: empty.

- [ ] **Step 6: pytest scaffold**

`api/tests/__init__.py`: empty.

`api/tests/conftest.py`:

```python
from __future__ import annotations

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="run integration tests that hit real upstream APIs",
    )


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if config.getoption("--integration"):
        return
    skip_integration = pytest.mark.skip(reason="needs --integration flag")
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
```

- [ ] **Step 7: .env.example**

```
PORT=8787
NODE_ENV=development

ANTHROPIC_BASE_URL=https://ourcliproxy-production.up.railway.app
ANTHROPIC_API_KEY=set-in-railway-min-20-chars
ANTHROPIC_MODEL=claude-opus-4-7

WHISPER_API_KEY=set-in-railway-min-20-chars
# WHISPER_BASE_URL=https://api.openai.com/v1   # override only for self-hosted whisper
SUNO_BASE_URL=https://api.acedata.cloud/suno
SUNO_API_KEY=set-in-railway-min-20-chars

BLOB_DRIVER=filesystem
BLOB_FS_DIR=./blob-data
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 8: api/README.md**

```markdown
# kokoro-api

Backend for Kokoro meditation generation. Python 3.12 + FastAPI.

## Dev

```sh
cp .env.example .env   # fill placeholder secrets ≥20 chars
uv sync --all-extras
uv run uvicorn kokoro_api.main:app --reload
```

## Tests

```sh
uv run pytest                    # unit tests only
uv run pytest --integration      # also runs upstream-API contract tests (costs money)
```

## Lint

```sh
uv run ruff check
uv run ruff format
uv run mypy src
```
```

- [ ] **Step 9: Verify it boots**

```bash
cd api
cp .env.example .env
uv run uvicorn kokoro_api.main:app --port 8787 &
sleep 2
curl localhost:8787/health
# expected: {"ok":true,"ts":<num>}
kill %1
```

- [ ] **Step 10: Verify lint + tests scaffold pass**

```bash
cd api
uv run ruff check
uv run ruff format --check
uv run pytest                    # 0 tests collected, exit 5 is OK
```

- [ ] **Step 11: Commit**

```bash
git add api/ .gitignore   # add .gitignore entries for api/.venv, api/.env, api/blob-data
git commit -m "feat(api): bootstrap fastapi service with pydantic-settings config"
```

Make sure `.gitignore` (root or `api/.gitignore`) excludes `api/.venv/`, `api/.env`, `api/blob-data/`, `api/__pycache__/`, `api/.pytest_cache/`, `api/.ruff_cache/`, `api/.mypy_cache/`, `**/*.pyc`.

---

### Task 2: Shared types module

**Files:**
- Create: `api/src/kokoro_api/types.py`

- [ ] **Step 1: Write the types**

`api/src/kokoro_api/types.py`:

```python
from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Mode = Literal["soft", "sharp"]
ContentType = Literal["unwind", "attract", "lockin"]
VoiceId = Literal["mira", "brad", "aiko", "sage"]
Becoming = Literal[
    "calm", "sleep", "focus", "detachment",
    "confidence", "softness", "power", "future", "action",
]
Locale = Literal["en", "ru"]
BeatType = Literal["opening", "line", "breath", "pause", "closing"]


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class CaptureVoice(_CamelModel):
    kind: Literal["voice"]
    audio_url: AnyHttpUrl
    mime_type: str


class CaptureText(_CamelModel):
    kind: Literal["text"]
    text: Annotated[str, Field(min_length=1, max_length=2000)]


class CaptureTheme(_CamelModel):
    kind: Literal["theme"]
    chips: Annotated[list[str], Field(min_length=1, max_length=6)]


Capture = Annotated[
    CaptureVoice | CaptureText | CaptureTheme,
    Field(discriminator="kind"),
]


class History(_CamelModel):
    previous_scripts: Annotated[list[str], Field(max_length=2)] | None = None
    last_becoming: str | None = None


class GenerateMeditationInput(_CamelModel):
    call_me: Annotated[str, Field(min_length=1, max_length=24, pattern=r"^[^\n\r]+$")]
    real_name: Annotated[str, Field(max_length=60)] | None = None
    mode: Mode
    capture: Capture
    content_type: ContentType
    becoming: Becoming | None = None
    voice_id: VoiceId
    history: History | None = None
    locale: Locale
    request_id: UUID


class ScriptBeat(_CamelModel):
    start_sec: float = Field(ge=0)
    duration_sec: float = Field(gt=0)
    text: str
    type: BeatType


class TranscriptionMeta(_CamelModel):
    provider: str
    latency_ms: int
    confidence: float


class LlmMeta(_CamelModel):
    provider: str
    model: str
    latency_ms: int
    tokens_in: int
    tokens_out: int
    cache_read_tokens: int


class AudioMeta(_CamelModel):
    provider: str
    job_id: str
    latency_ms: int
    candidates: int
    chosen_candidate: int


class PersistenceMeta(_CamelModel):
    provider: str
    latency_ms: int


class ProviderMeta(_CamelModel):
    transcription: TranscriptionMeta | None = None
    llm: LlmMeta
    audio: AudioMeta
    persistence: PersistenceMeta
    total_latency_ms: int


class GenerateMeditationOutput(_CamelModel):
    meditation_id: str
    audio_url: str
    duration_sec: float
    script: str
    beats: list[ScriptBeat]
    template_used_id: str
    generated_at: str
    provider_meta: ProviderMeta


class TemplateBeat(BaseModel):
    id: str
    sec: int = Field(gt=0)
    intent: str


class RegisterNotes(BaseModel):
    soft: str
    sharp: str


class Template(BaseModel):
    """Loaded from JSON in /templates. Internal-only — not part of the public API."""
    id: str
    content_type: ContentType = Field(alias="contentType")
    modes: list[Mode] = Field(min_length=1)
    becoming_match: list[str] = Field(alias="becomingMatch")
    theme_keywords: list[str] = Field(alias="themeKeywords")
    target_duration_sec: int = Field(alias="targetDurationSec", gt=0)
    music_style_prompt: str = Field(alias="musicStylePrompt", min_length=10)
    reference_track_urls: list[AnyHttpUrl] = Field(alias="referenceTrackUrls", max_length=2)
    structure: list[TemplateBeat] = Field(min_length=3)
    register_notes: RegisterNotes = Field(alias="registerNotes")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
```

- [ ] **Step 2: Verify**

```bash
cd api
uv run ruff check
uv run mypy src/kokoro_api/types.py
```

- [ ] **Step 3: Commit**

```bash
git add api/src/kokoro_api/types.py
git commit -m "feat(api): define i/o schemas and shared pydantic types"
```

---

### Task 3: Template loader

**Files:**
- Create: `api/src/kokoro_api/templates/__init__.py`
- Create: `api/src/kokoro_api/templates/loader.py`
- Create: `api/tests/templates/__init__.py`
- Create: `api/tests/templates/test_loader.py`

The three template JSON files (`templates/unwind/...`, `templates/attract/...`, `templates/lockin/...`) and `templates/README.md` are already committed at repo root from a prior step — do not recreate them.

- [ ] **Step 1: Write the failing test**

`api/tests/templates/test_loader.py`:

```python
from __future__ import annotations

import pytest

from kokoro_api.templates.loader import load_templates


@pytest.mark.asyncio
async def test_loads_all_templates() -> None:
    templates = await load_templates()
    assert len(templates) >= 3

    ids = sorted(t.id for t in templates)
    assert "unwind_release_pressure_01" in ids
    assert "attract_amsterdam_morning_01" in ids
    assert "lockin_one_rep_01" in ids


@pytest.mark.asyncio
async def test_rejects_nonexistent_dir() -> None:
    with pytest.raises(Exception):
        await load_templates(root_dir="/nonexistent")
```

- [ ] **Step 2: Run, verify it fails**

```bash
cd api && uv run pytest tests/templates -v
```

Expected: ImportError / ModuleNotFoundError.

- [ ] **Step 3: Implement loader**

`api/src/kokoro_api/templates/loader.py`:

```python
from __future__ import annotations

import json
from pathlib import Path

from kokoro_api.types import Template


def _default_root_dir() -> Path:
    # When invoked from api/ (cwd), templates live one level up.
    return Path.cwd().parent / "templates"


async def load_templates(*, root_dir: str | Path | None = None) -> list[Template]:
    root = Path(root_dir) if root_dir is not None else _default_root_dir()
    subdirs = ("unwind", "attract", "lockin")
    out: list[Template] = []

    for sub in subdirs:
        d = root / sub
        for f in sorted(d.iterdir()):
            if f.suffix != ".json":
                continue
            raw = f.read_text(encoding="utf-8")
            tpl = Template.model_validate_json(raw)
            out.append(tpl)

    return out
```

`api/src/kokoro_api/templates/__init__.py`: empty.
`api/tests/templates/__init__.py`: empty.

- [ ] **Step 4: Run tests, verify pass**

```bash
cd api && uv run pytest tests/templates -v
```

- [ ] **Step 5: Lint + type-check**

```bash
cd api && uv run ruff check && uv run mypy src/kokoro_api/templates
```

- [ ] **Step 6: Commit**

```bash
git add api/src/kokoro_api/templates/ api/tests/templates/
git commit -m "feat(api): template loader with pydantic validation"
```

---

### Task 4: Template selector

**Files:**
- Create: `api/src/kokoro_api/pipeline/__init__.py`
- Create: `api/src/kokoro_api/pipeline/select_template.py`
- Create: `api/tests/pipeline/__init__.py`
- Create: `api/tests/pipeline/test_select_template.py`

- [ ] **Step 1: Write the failing test**

`api/tests/pipeline/test_select_template.py`:

```python
from __future__ import annotations

import pytest

from kokoro_api.pipeline.select_template import SelectInput, select_template
from kokoro_api.types import Template, TemplateBeat, RegisterNotes


def _t(id: str, ct: str, becoming: list[str], keywords: list[str]) -> Template:
    return Template(
        id=id, content_type=ct,  # type: ignore[arg-type]
        modes=["soft", "sharp"],
        becoming_match=becoming,
        theme_keywords=keywords,
        target_duration_sec=360,
        music_style_prompt="warm ambient pad",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="a", sec=60, intent="x"),
            TemplateBeat(id="b", sec=60, intent="y"),
            TemplateBeat(id="c", sec=60, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


@pytest.fixture
def fixtures() -> list[Template]:
    return [
        _t("unwind_a", "unwind", ["calm", "softness"], ["pressure", "tired"]),
        _t("attract_a", "attract", ["future", "confidence"], ["amsterdam", "morning"]),
    ]


def test_picks_by_content_type_first(fixtures: list[Template]) -> None:
    t = select_template(fixtures, SelectInput(
        content_type="attract", mode="soft", theme_text="random", becoming="calm",
    ))
    assert t.id == "attract_a"


def test_breaks_ties_by_keyword_overlap(fixtures: list[Template]) -> None:
    more = [*fixtures, _t("unwind_b", "unwind", ["calm"], ["amsterdam"])]
    t = select_template(more, SelectInput(
        content_type="unwind", mode="soft", theme_text="pressure tired", becoming="calm",
    ))
    assert t.id == "unwind_a"   # beats unwind_b on theme keyword overlap


def test_falls_back_to_becoming_match(fixtures: list[Template]) -> None:
    t = select_template(fixtures, SelectInput(
        content_type="unwind", mode="soft", theme_text="gibberish nothing", becoming="softness",
    ))
    assert t.id == "unwind_a"


def test_throws_when_no_template_for_content_type(fixtures: list[Template]) -> None:
    with pytest.raises(ValueError, match="no template"):
        select_template(fixtures, SelectInput(
            content_type="lockin", mode="soft", theme_text="", becoming="calm",
        ))
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_select_template.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/pipeline/select_template.py`:

```python
from __future__ import annotations

import re
from dataclasses import dataclass

from kokoro_api.types import ContentType, Mode, Template


@dataclass(slots=True)
class SelectInput:
    content_type: ContentType
    mode: Mode
    theme_text: str
    becoming: str | None = None


def select_template(templates: list[Template], input: SelectInput) -> Template:
    candidates = [
        t for t in templates
        if t.content_type == input.content_type and input.mode in t.modes
    ]
    if not candidates:
        raise ValueError(f"no template for content_type={input.content_type} mode={input.mode}")

    theme_words = {w for w in re.split(r"\W+", input.theme_text.lower()) if w}

    def score(t: Template) -> int:
        keyword_hits = sum(1 for k in t.theme_keywords if k.lower() in theme_words)
        becoming_hit = 1 if input.becoming and input.becoming in t.becoming_match else 0
        return keyword_hits * 10 + becoming_hit

    return max(candidates, key=score)
```

`api/src/kokoro_api/pipeline/__init__.py`: empty.
`api/tests/pipeline/__init__.py`: empty.

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_select_template.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/pipeline/ api/tests/pipeline/
git commit -m "feat(api): rule-based template selector with keyword + becoming scoring"
```

---

### Task 5: Capture resolver + STT base class

**Files:**
- Create: `api/src/kokoro_api/providers/__init__.py`
- Create: `api/src/kokoro_api/providers/stt/__init__.py`
- Create: `api/src/kokoro_api/providers/stt/base.py`
- Create: `api/src/kokoro_api/pipeline/resolve_capture.py`
- Create: `api/tests/pipeline/test_resolve_capture.py`

- [ ] **Step 1: Failing test**

`api/tests/pipeline/test_resolve_capture.py`:

```python
from __future__ import annotations

from typing import Literal
from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.resolve_capture import resolve_capture
from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult
from kokoro_api.types import CaptureText, CaptureTheme, CaptureVoice


class FakeStt(TranscriptionProvider):
    name = "fake"
    transcribe = AsyncMock(return_value=TranscriptionResult(
        text="I am wired", confidence=0.91, latency_ms=120,
    ))


@pytest.mark.asyncio
async def test_text_passes_through() -> None:
    stt = FakeStt()
    out = await resolve_capture(CaptureText(kind="text", text="long day"), "en", stt)
    assert out.text == "long day"
    assert out.transcription_meta is None
    stt.transcribe.assert_not_awaited()


@pytest.mark.asyncio
async def test_theme_joins_chips() -> None:
    out = await resolve_capture(CaptureTheme(kind="theme", chips=["anxious", "tired"]), "en", FakeStt())
    assert "anxious" in out.text.lower()
    assert "tired" in out.text.lower()


@pytest.mark.asyncio
async def test_voice_calls_stt() -> None:
    stt = FakeStt()
    out = await resolve_capture(
        CaptureVoice(kind="voice", audio_url="https://x/a.webm", mime_type="audio/webm"),  # type: ignore[arg-type]
        "en", stt,
    )
    assert out.text == "I am wired"
    assert out.transcription_meta is not None
    assert out.transcription_meta.provider == "fake"
    assert out.transcription_meta.latency_ms == 120
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_resolve_capture.py -v
```

- [ ] **Step 3: STT base class**

`api/src/kokoro_api/providers/stt/base.py`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel


class TranscriptionResult(BaseModel):
    text: str
    confidence: float
    latency_ms: int


class TranscriptionProvider(ABC):
    name: str

    @abstractmethod
    async def transcribe(
        self, *, audio_url: str, mime_type: str, locale: Literal["en", "ru"],
    ) -> TranscriptionResult: ...
```

`api/src/kokoro_api/providers/__init__.py`: empty.
`api/src/kokoro_api/providers/stt/__init__.py`: empty.

- [ ] **Step 4: Resolver**

`api/src/kokoro_api/pipeline/resolve_capture.py`:

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.types import Capture, CaptureText, CaptureTheme, CaptureVoice, TranscriptionMeta


class ResolvedCapture(BaseModel):
    text: str
    transcription_meta: TranscriptionMeta | None = None


async def resolve_capture(
    capture: Capture,
    locale: Literal["en", "ru"],
    stt: TranscriptionProvider,
) -> ResolvedCapture:
    if isinstance(capture, CaptureText):
        return ResolvedCapture(text=capture.text)

    if isinstance(capture, CaptureTheme):
        return ResolvedCapture(text=f"Carrying {', '.join(capture.chips)}.")

    assert isinstance(capture, CaptureVoice)
    r = await stt.transcribe(
        audio_url=str(capture.audio_url), mime_type=capture.mime_type, locale=locale,
    )
    return ResolvedCapture(
        text=r.text,
        transcription_meta=TranscriptionMeta(
            provider=stt.name, latency_ms=r.latency_ms, confidence=r.confidence,
        ),
    )
```

- [ ] **Step 5: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_resolve_capture.py -v
```

- [ ] **Step 6: Commit**

```bash
git add api/src/kokoro_api/providers/ api/src/kokoro_api/pipeline/resolve_capture.py api/tests/pipeline/test_resolve_capture.py
git commit -m "feat(api): capture resolver + transcription provider base class"
```

---

### Task 6: Whisper STT adapter

**Files:**
- Create: `api/src/kokoro_api/providers/stt/whisper.py`
- Create: `api/tests/providers/__init__.py`
- Create: `api/tests/providers/test_whisper_contract.py`

- [ ] **Step 1: Contract test (gated)**

`api/tests/providers/test_whisper_contract.py`:

```python
from __future__ import annotations

import os

import pytest

from kokoro_api.providers.stt.whisper import WhisperProvider


@pytest.mark.integration
@pytest.mark.asyncio
async def test_whisper_transcribes_short_clip() -> None:
    p = WhisperProvider(
        api_key=os.environ["WHISPER_API_KEY"],
        base_url=os.environ.get("WHISPER_BASE_URL", "https://api.openai.com/v1"),
    )
    r = await p.transcribe(
        audio_url="https://github.com/voxpupuli/audio-fixtures/raw/main/hello-en.mp3",
        mime_type="audio/mpeg",
        locale="en",
    )
    assert "hello" in r.text.lower()
    assert r.latency_ms > 0
```

`api/tests/providers/__init__.py`: empty.

- [ ] **Step 2: Implement**

`api/src/kokoro_api/providers/stt/whisper.py`:

```python
from __future__ import annotations

import math
import time
from typing import Literal

import httpx

from kokoro_api.providers.stt.base import TranscriptionProvider, TranscriptionResult


class WhisperProvider(TranscriptionProvider):
    name = "openai-whisper-1"

    def __init__(self, *, api_key: str, base_url: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def transcribe(
        self, *, audio_url: str, mime_type: str, locale: Literal["en", "ru"],
    ) -> TranscriptionResult:
        t0 = time.monotonic()

        async with httpx.AsyncClient(timeout=60.0) as client:
            audio_bytes = (await client.get(audio_url)).content

            files = {"file": ("audio", audio_bytes, mime_type)}
            data = {
                "model": "whisper-1",
                "language": locale,
                "response_format": "verbose_json",
            }
            res = await client.post(
                f"{self._base_url}/audio/transcriptions",
                headers={"authorization": f"Bearer {self._api_key}"},
                files=files,
                data=data,
            )
            res.raise_for_status()
            payload = res.json()

        segments = payload.get("segments") or []
        if segments:
            avg_logprob = sum(s["avg_logprob"] for s in segments) / len(segments)
            confidence = max(0.0, min(1.0, math.exp(avg_logprob)))
        else:
            confidence = 0.0

        return TranscriptionResult(
            text=payload["text"],
            confidence=confidence,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
```

- [ ] **Step 3: Commit**

```bash
git add api/src/kokoro_api/providers/stt/whisper.py api/tests/providers/
git commit -m "feat(api): whisper transcription provider with confidence from logprobs"
```

---

### Task 7: Prompt builder — system

**Files:**
- Create: `api/src/kokoro_api/prompt/__init__.py`
- Create: `api/src/kokoro_api/prompt/system.py`
- Create: `api/tests/prompt/__init__.py`
- Create: `api/tests/prompt/test_system.py`

- [ ] **Step 1: Failing test**

`api/tests/prompt/test_system.py`:

```python
from __future__ import annotations

import re

from kokoro_api.prompt.system import build_system_prompt


def test_soft_mode_requires_pet_name_4_times() -> None:
    p = build_system_prompt(mode="soft", locale="en")
    assert re.search(r"at least 4 times", p, re.I)
    assert re.search(r"pet name", p, re.I)
    assert re.search(r"warm", p, re.I)


def test_sharp_mode_register_shifts() -> None:
    p = build_system_prompt(mode="sharp", locale="en")
    assert re.search(r"direct", p, re.I)
    assert "sweet" not in p.lower()


def test_includes_json_output_contract() -> None:
    p = build_system_prompt(mode="soft", locale="en")
    assert '"script"' in p
    assert '"beats"' in p
    assert "startSec" in p
    assert "[breath]" in p


def test_russian_locale_hint() -> None:
    p = build_system_prompt(mode="soft", locale="ru")
    assert re.search(r"russian", p, re.I)
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/prompt/test_system.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/prompt/system.py`:

```python
from __future__ import annotations

from typing import Literal

_REGISTER = {
    "soft": (
        "Warm, validating, gentle. Lower-register voice. Permission, not prescription. "
        "Long sentences allowed."
    ),
    "sharp": (
        "Direct, grounded, focused. No platitudes, no fluff. Short clauses. "
        "Command-driven where the content type calls for it. Never sweet, never therapeutic-soft."
    ),
}


def build_system_prompt(*, mode: Literal["soft", "sharp"], locale: Literal["en", "ru"]) -> str:
    lang = "Russian" if locale == "ru" else "English"
    return f"""You are the meditation script writer for the Kokoro app.

REGISTER: {_REGISTER[mode]}
LANGUAGE: {lang}.

NON-NEGOTIABLE RULES
1. The user's pet name (provided in <user_context>) MUST appear in the meditation at least 4 times, naturally woven, never at the start of every sentence.
2. Follow the BEAT STRUCTURE in <template>. Each beat has an allotted seconds budget. Do not exceed total seconds by more than 5%.
3. Embed pacing markers in the text:
   - [breath] for a 4-second breathing prompt
   - [pause:N] for an N-second silence (N is 2..8)
4. Speak to the user, not about them. Never narrate "the user feels…". Always "you, <pet name>, …".
5. No clinical or therapeutic-soft clichés ("breathe in love"). No spiritual-bypass ("just let go"). Specific, sensory, concrete.

OUTPUT FORMAT — strict JSON. No prose outside the JSON. Schema:
{{
  "script": "<full text with [breath] and [pause:N] markers inline>",
  "beats": [
    {{ "startSec": 0, "durationSec": 30, "text": "<text for this beat>", "type": "opening" }},
    ...
    {{ "startSec": ..., "durationSec": ..., "text": "...", "type": "closing" }}
  ],
  "estimatedDurationSec": <integer>
}}

beats[i].type ∈ "opening" | "line" | "breath" | "pause" | "closing".
beats must cover the full duration without gaps and in order."""
```

`api/src/kokoro_api/prompt/__init__.py`: empty.
`api/tests/prompt/__init__.py`: empty.

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/prompt/test_system.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/prompt/__init__.py api/src/kokoro_api/prompt/system.py api/tests/prompt/__init__.py api/tests/prompt/test_system.py
git commit -m "feat(api): static system prompt with strict json output contract"
```

---

### Task 8: Prompt builder — user

**Files:**
- Create: `api/src/kokoro_api/prompt/user.py`
- Create: `api/tests/prompt/test_user.py`

- [ ] **Step 1: Failing test**

`api/tests/prompt/test_user.py`:

```python
from __future__ import annotations

import re

from kokoro_api.prompt.user import BuildUserArgs, build_user_prompt
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a", content_type="unwind", modes=["soft"],
        becoming_match=["calm"], theme_keywords=["tired"],
        target_duration_sec=360, music_style_prompt="ambient",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open",  sec=30, intent="ground in body"),
            TemplateBeat(id="close", sec=30, intent="rest"),
            TemplateBeat(id="seal",  sec=30, intent="anchor"),
        ],
        register_notes=RegisterNotes(soft="warm", sharp="direct"),
    )


def test_embeds_call_me_capture_becoming_template() -> None:
    p = build_user_prompt(BuildUserArgs(
        call_me="зай", mode="soft", capture_text="long day, pressure",
        becoming="calm", template=_tpl(), history=None,
    ))
    assert "зай" in p
    assert "long day, pressure" in p
    assert "calm" in p
    assert "ground in body" in p
    assert "360" in p


def test_includes_history_block_when_present() -> None:
    p = build_user_prompt(BuildUserArgs(
        call_me="brother", mode="sharp", capture_text="...",
        becoming="focus", template=_tpl(),
        history={"previous_scripts": ["Yesterday you set an intention…"], "last_becoming": "focus"},
    ))
    assert re.search(r"<history>", p)
    assert "Yesterday" in p


def test_omits_history_block_when_empty() -> None:
    p = build_user_prompt(BuildUserArgs(
        call_me="x", mode="soft", capture_text="y", becoming="calm",
        template=_tpl(), history=None,
    ))
    assert "<history>" not in p
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/prompt/test_user.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/prompt/user.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

from kokoro_api.types import Template


class HistoryDict(TypedDict, total=False):
    previous_scripts: list[str]
    last_becoming: str


@dataclass(slots=True)
class BuildUserArgs:
    call_me: str
    mode: Literal["soft", "sharp"]
    capture_text: str
    becoming: str | None
    template: Template
    history: HistoryDict | None


def build_user_prompt(a: BuildUserArgs) -> str:
    beats_lines = "\n".join(
        f'  - id="{b.id}" sec={b.sec} intent="{b.intent}"' for b in a.template.structure
    )

    history_block = ""
    if a.history and (a.history.get("previous_scripts") or a.history.get("last_becoming")):
        prev_list = a.history.get("previous_scripts") or []
        previous_scripts_lines = "\n".join(
            f'  - "{s[:280].replace(chr(10), " ")}…"' for s in prev_list
        )
        history_block = (
            f"<history>\n"
            f"last_becoming: {a.history.get('last_becoming', 'unknown')}\n"
            f"previous_scripts:\n{previous_scripts_lines}\n"
            f"</history>\n"
        )

    capture_text = a.capture_text.replace('"', '\\"')

    return f"""<user_context>
pet_name: {a.call_me}
mode: {a.mode}
becoming: {a.becoming or 'unspecified'}
what_they_said: "{capture_text}"
</user_context>

<template id="{a.template.id}" target_duration_sec={a.template.target_duration_sec}>
register_note ({a.mode}): {a.template.register_notes.soft if a.mode == "soft" else a.template.register_notes.sharp}
beats:
{beats_lines}
</template>
{history_block}
TASK: Write the meditation script following the system rules and the template beats. Return strict JSON only."""
```

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/prompt/test_user.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/prompt/user.py api/tests/prompt/test_user.py
git commit -m "feat(api): user prompt builder embedding template + history"
```

---

### Task 9: LLM output parser

**Files:**
- Create: `api/src/kokoro_api/prompt/parse.py`
- Create: `api/tests/prompt/test_parse.py`

- [ ] **Step 1: Failing test**

`api/tests/prompt/test_parse.py`:

```python
from __future__ import annotations

import json

import pytest

from kokoro_api.prompt.parse import parse_llm_output

VALID = json.dumps({
    "script": "Hi, зай. [breath] Settle.",
    "beats": [
        {"startSec": 0, "durationSec": 5, "text": "Hi, зай.", "type": "opening"},
        {"startSec": 5, "durationSec": 4, "text": "[breath]",  "type": "breath"},
        {"startSec": 9, "durationSec": 3, "text": "Settle.",   "type": "closing"},
    ],
    "estimatedDurationSec": 12,
})


def test_parses_valid_json() -> None:
    r = parse_llm_output(VALID)
    assert len(r.beats) == 3
    assert r.estimated_duration_sec == 12


def test_strips_json_fences() -> None:
    r = parse_llm_output("```json\n" + VALID + "\n```")
    assert len(r.beats) == 3


def test_rejects_malformed_json() -> None:
    with pytest.raises(ValueError, match="parse"):
        parse_llm_output("not json")


def test_rejects_beats_with_missing_fields() -> None:
    bad = json.dumps({"script": "x", "beats": [{"text": "x"}], "estimatedDurationSec": 1})
    with pytest.raises(Exception):
        parse_llm_output(bad)
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/prompt/test_parse.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/prompt/parse.py`:

```python
from __future__ import annotations

import json

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from kokoro_api.types import ScriptBeat


class LlmParsed(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    script: str
    beats: list[ScriptBeat]
    estimated_duration_sec: int


def parse_llm_output(raw: str) -> LlmParsed:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        # strip opening ```json or ``` and trailing ```
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"could not parse llm output as json: {e.msg}") from e

    return LlmParsed.model_validate(parsed)
```

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/prompt/test_parse.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/prompt/parse.py api/tests/prompt/test_parse.py
git commit -m "feat(api): tolerant parser for llm json output"
```

---

### Task 10: Anthropic LLM provider

**Files:**
- Create: `api/src/kokoro_api/providers/llm/__init__.py`
- Create: `api/src/kokoro_api/providers/llm/base.py`
- Create: `api/src/kokoro_api/providers/llm/anthropic_provider.py`
- Create: `api/tests/providers/test_anthropic_contract.py`

- [ ] **Step 1: LLM base**

`api/src/kokoro_api/providers/llm/base.py`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


class LlmResult(BaseModel):
    raw_json: str
    tokens_in: int
    tokens_out: int
    cache_read_tokens: int
    latency_ms: int


class ScriptGenerator(ABC):
    name: str
    model: str

    @abstractmethod
    async def generate(
        self, *, system_prompt: str, user_prompt: str, cache_key: str,
    ) -> LlmResult: ...
```

`api/src/kokoro_api/providers/llm/__init__.py`: empty.

- [ ] **Step 2: Contract test**

`api/tests/providers/test_anthropic_contract.py`:

```python
from __future__ import annotations

import os

import pytest

from kokoro_api.providers.llm.anthropic_provider import AnthropicScriptGenerator


@pytest.mark.integration
@pytest.mark.asyncio
async def test_returns_json_and_token_counts() -> None:
    gen = AnthropicScriptGenerator(
        base_url=os.environ["ANTHROPIC_BASE_URL"],
        api_key=os.environ["ANTHROPIC_API_KEY"],
        model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7"),
    )
    r = await gen.generate(
        system_prompt='You output strict JSON. Return {"ok": true}.',
        user_prompt="Return ok.",
        cache_key="test",
    )
    assert '"ok"' in r.raw_json and "true" in r.raw_json
    assert r.tokens_out > 0
```

- [ ] **Step 3: Implement provider**

`api/src/kokoro_api/providers/llm/anthropic_provider.py`:

```python
from __future__ import annotations

import time

from anthropic import AsyncAnthropic
from anthropic.types import TextBlock

from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator


class AnthropicScriptGenerator(ScriptGenerator):
    name = "anthropic"

    def __init__(self, *, base_url: str, api_key: str, model: str) -> None:
        self.model = model
        self._client = AsyncAnthropic(base_url=base_url, api_key=api_key)

    async def generate(
        self, *, system_prompt: str, user_prompt: str, cache_key: str,
    ) -> LlmResult:
        t0 = time.monotonic()
        res = await self._client.messages.create(
            model=self.model,
            max_tokens=4000,
            system=[
                {"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}},
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )

        text = "".join(b.text for b in res.content if isinstance(b, TextBlock))

        return LlmResult(
            raw_json=text,
            tokens_in=res.usage.input_tokens,
            tokens_out=res.usage.output_tokens,
            cache_read_tokens=getattr(res.usage, "cache_read_input_tokens", 0) or 0,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
```

- [ ] **Step 4: Commit**

```bash
git add api/src/kokoro_api/providers/llm/ api/tests/providers/test_anthropic_contract.py
git commit -m "feat(api): anthropic provider via cliproxy with prompt caching"
```

---

### Task 11: Script generation stage

**Files:**
- Create: `api/src/kokoro_api/pipeline/generate_script.py`
- Create: `api/tests/pipeline/test_generate_script.py`

- [ ] **Step 1: Failing test**

`api/tests/pipeline/test_generate_script.py`:

```python
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.generate_script import GenerateScriptInput, generate_script
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a", content_type="unwind", modes=["soft"],
        becoming_match=["calm"], theme_keywords=[],
        target_duration_sec=60, music_style_prompt="a",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open",  sec=30, intent="x"),
            TemplateBeat(id="mid",   sec=15, intent="y"),
            TemplateBeat(id="close", sec=15, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


VALID_JSON = json.dumps({
    "script": "Hi, зай. [breath]",
    "beats": [
        {"startSec": 0,  "durationSec": 30, "text": "Hi, зай.", "type": "opening"},
        {"startSec": 30, "durationSec": 30, "text": "[breath]",  "type": "closing"},
    ],
    "estimatedDurationSec": 60,
})


class FakeLlm(ScriptGenerator):
    name = "fake"
    model = "fake-1"

    def __init__(self) -> None:
        self.generate = AsyncMock(return_value=LlmResult(
            raw_json=VALID_JSON, tokens_in=100, tokens_out=200,
            cache_read_tokens=80, latency_ms=500,
        ))


@pytest.mark.asyncio
async def test_produces_parsed_script_and_meta() -> None:
    r = await generate_script(GenerateScriptInput(
        call_me="зай", mode="soft", capture_text="tired",
        becoming="calm", template=_tpl(), history=None, locale="en",
    ), FakeLlm())
    assert "зай" in r.script
    assert len(r.beats) == 2
    assert r.meta.tokens_out == 200
    assert r.meta.cache_read_tokens == 80


@pytest.mark.asyncio
async def test_retries_once_on_parse_failure() -> None:
    flaky = ScriptGenerator.__new__(ScriptGenerator)
    flaky.name = "flaky"
    flaky.model = "flaky-1"
    flaky.generate = AsyncMock(side_effect=[
        LlmResult(raw_json="not json", tokens_in=1, tokens_out=1, cache_read_tokens=0, latency_ms=1),
        LlmResult(raw_json=VALID_JSON, tokens_in=100, tokens_out=200, cache_read_tokens=0, latency_ms=500),
    ])
    r = await generate_script(GenerateScriptInput(
        call_me="x", mode="soft", capture_text="y", becoming="calm",
        template=_tpl(), history=None, locale="en",
    ), flaky)
    assert "зай" in r.script
    assert flaky.generate.await_count == 2
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_generate_script.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/pipeline/generate_script.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from kokoro_api.prompt.parse import parse_llm_output
from kokoro_api.prompt.system import build_system_prompt
from kokoro_api.prompt.user import BuildUserArgs, HistoryDict, build_user_prompt
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.types import LlmMeta, ScriptBeat, Template


@dataclass(slots=True)
class GenerateScriptInput:
    call_me: str
    mode: Literal["soft", "sharp"]
    capture_text: str
    becoming: str | None
    template: Template
    history: HistoryDict | None
    locale: Literal["en", "ru"]


class GenerateScriptResult(BaseModel):
    script: str
    beats: list[ScriptBeat]
    estimated_duration_sec: int
    meta: LlmMeta


async def generate_script(
    input: GenerateScriptInput, llm: ScriptGenerator,
) -> GenerateScriptResult:
    system_prompt = build_system_prompt(mode=input.mode, locale=input.locale)
    user_prompt = build_user_prompt(BuildUserArgs(
        call_me=input.call_me, mode=input.mode, capture_text=input.capture_text,
        becoming=input.becoming, template=input.template, history=input.history,
    ))

    last_err: Exception | None = None
    total_latency = 0
    total_in = 0
    total_out = 0
    total_cache = 0

    for _ in range(2):
        r = await llm.generate(
            system_prompt=system_prompt, user_prompt=user_prompt, cache_key=input.template.id,
        )
        total_latency += r.latency_ms
        total_in += r.tokens_in
        total_out += r.tokens_out
        total_cache += r.cache_read_tokens
        try:
            parsed = parse_llm_output(r.raw_json)
            return GenerateScriptResult(
                script=parsed.script,
                beats=parsed.beats,
                estimated_duration_sec=parsed.estimated_duration_sec,
                meta=LlmMeta(
                    provider=llm.name, model=llm.model,
                    latency_ms=total_latency,
                    tokens_in=total_in, tokens_out=total_out,
                    cache_read_tokens=total_cache,
                ),
            )
        except Exception as e:
            last_err = e

    raise RuntimeError(f"script generation failed after retries: {last_err}")
```

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_generate_script.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/pipeline/generate_script.py api/tests/pipeline/test_generate_script.py
git commit -m "feat(api): script generation stage with one parse retry"
```

---

### Task 12: Suno audio provider

**Files:**
- Create: `api/src/kokoro_api/providers/audio/__init__.py`
- Create: `api/src/kokoro_api/providers/audio/base.py`
- Create: `api/src/kokoro_api/providers/audio/suno.py`
- Create: `api/src/kokoro_api/providers/audio/personas.json` (initially empty mapping)
- Create: `api/tests/providers/test_suno_contract.py`

- [ ] **Step 1: Audio base**

`api/src/kokoro_api/providers/audio/base.py`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Literal

from pydantic import BaseModel


class AudioResult(BaseModel):
    audio_bytes: bytes
    mime_type: Literal["audio/mpeg"]
    duration_sec: int
    job_ids: list[str]
    chosen_candidate: int
    latency_ms: int


class MeditationAudioProvider(ABC):
    name: str

    @abstractmethod
    async def synthesize(
        self, *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Literal["en", "ru"],
        candidates: int,
    ) -> AudioResult: ...
```

`api/src/kokoro_api/providers/audio/__init__.py`: empty.

- [ ] **Step 2: Empty personas map**

`api/src/kokoro_api/providers/audio/personas.json`:

```json
{
  "mira": "",
  "brad": "",
  "aiko": "",
  "sage": ""
}
```

- [ ] **Step 3: Suno provider**

`api/src/kokoro_api/providers/audio/suno.py`:

```python
from __future__ import annotations

import asyncio
import time
from typing import Literal

import httpx

from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider

POLL_INTERVAL_SEC = 4
POLL_TIMEOUT_SEC = 180
MAX_SINGLE_CLIP_SEC = 240


class SunoAudioProvider(MeditationAudioProvider):
    name = "suno-acedata"

    def __init__(self, *, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    async def synthesize(
        self, *,
        script: str,
        voice_persona_id: str,
        music_style_prompt: str,
        reference_track_urls: list[str],
        target_duration_sec: int,
        locale: Literal["en", "ru"],
        candidates: int,
    ) -> AudioResult:
        t0 = time.monotonic()
        n = max(1, min(2, candidates))

        async with httpx.AsyncClient(timeout=POLL_TIMEOUT_SEC + 30) as client:
            jobs = await asyncio.gather(*(
                self._start_job(
                    client,
                    script=script,
                    voice_persona_id=voice_persona_id,
                    music_style_prompt=music_style_prompt,
                    reference_track_urls=reference_track_urls,
                ) for _ in range(n)
            ))

            results = await asyncio.gather(*(self._poll(client, j) for j in jobs))

            chosen = -1
            for i, r in enumerate(results):
                dur = r.get("duration") or 0
                audio_url = r.get("audio_url")
                if audio_url and abs(dur - target_duration_sec) < dur * 0.2:
                    chosen = i
                    break
            if chosen == -1:
                for i, r in enumerate(results):
                    if r.get("audio_url"):
                        chosen = i
                        break
            if chosen == -1:
                ids = ",".join(jobs)
                raise RuntimeError(f"suno: no candidate produced audio (job ids: {ids})")

            audio_bytes = (await client.get(results[chosen]["audio_url"])).content
            duration_sec = int(results[chosen].get("duration") or target_duration_sec)

            if target_duration_sec > MAX_SINGLE_CLIP_SEC and duration_sec < target_duration_sec * 0.95:
                ext = await self._extend(client, jobs[chosen], target_duration_sec - duration_sec)
                audio_bytes = (await client.get(ext["audio_url"])).content
                duration_sec = int(ext.get("duration") or target_duration_sec)

        return AudioResult(
            audio_bytes=audio_bytes,
            mime_type="audio/mpeg",
            duration_sec=duration_sec,
            job_ids=jobs,
            chosen_candidate=chosen,
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    async def _start_job(
        self, client: httpx.AsyncClient, *,
        script: str, voice_persona_id: str,
        music_style_prompt: str, reference_track_urls: list[str],
    ) -> str:
        body = {
            "action": "generate",
            "custom": True,
            "instrumental": False,
            "lyric": script,
            "prompt": (
                music_style_prompt
                + " [spoken word, slow narration, no melody on vocals, breathy delivery]"
            ),
            "persona_id": voice_persona_id or None,
            "reference_audio_urls": reference_track_urls,
            "model": "chirp-v4-5",
        }
        res = await client.post(
            f"{self._base_url}/audios",
            headers={"authorization": f"Bearer {self._api_key}"},
            json=body,
        )
        res.raise_for_status()
        payload = res.json()
        job_id = payload.get("task_id") or payload.get("id")
        if not job_id:
            raise RuntimeError("suno start: no id in response")
        return job_id

    async def _poll(self, client: httpx.AsyncClient, job_id: str) -> dict[str, object]:
        deadline = time.monotonic() + POLL_TIMEOUT_SEC
        while time.monotonic() < deadline:
            res = await client.get(
                f"{self._base_url}/audios/{job_id}",
                headers={"authorization": f"Bearer {self._api_key}"},
            )
            j = res.json()
            status = j.get("status")
            if status == "complete":
                return j
            if status == "error":
                raise RuntimeError(f"suno job {job_id} errored: {j.get('error')}")
            await asyncio.sleep(POLL_INTERVAL_SEC)
        raise TimeoutError(f"suno job {job_id} timed out after {POLL_TIMEOUT_SEC}s")

    async def _extend(
        self, client: httpx.AsyncClient, source_id: str, additional_sec: int,
    ) -> dict[str, object]:
        res = await client.post(
            f"{self._base_url}/audios/extend",
            headers={"authorization": f"Bearer {self._api_key}"},
            json={"source_id": source_id, "continue_at": "end", "target_seconds": additional_sec},
        )
        res.raise_for_status()
        new_job = res.json()["task_id"]
        return await self._poll(client, new_job)
```

> NOTE: Suno endpoint shapes (`/audios`, `/audios/extend`) and field names follow `acedata.cloud` v3 docs as of 2026-05-03. Verify against the live reference before merge — this is the wrapper that changes most often.

- [ ] **Step 4: Contract test**

`api/tests/providers/test_suno_contract.py`:

```python
from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from kokoro_api.providers.audio.suno import SunoAudioProvider


@pytest.mark.integration
@pytest.mark.asyncio
async def test_suno_produces_short_clip() -> None:
    personas_path = Path(__file__).resolve().parents[2] / "src" / "kokoro_api" / "providers" / "audio" / "personas.json"
    personas = json.loads(personas_path.read_text())
    p = SunoAudioProvider(
        base_url=os.environ["SUNO_BASE_URL"], api_key=os.environ["SUNO_API_KEY"],
    )
    r = await p.synthesize(
        script="Зай. [breath] Settle. [breath] You did enough today.",
        voice_persona_id=personas.get("mira", ""),
        music_style_prompt="warm ambient pad, no percussion",
        reference_track_urls=[],
        target_duration_sec=30,
        locale="en",
        candidates=1,
    )
    assert len(r.audio_bytes) > 20_000
    assert r.duration_sec > 15
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/providers/audio/ api/tests/providers/test_suno_contract.py
git commit -m "feat(api): suno audio provider via acedata wrapper with extend + best-of-2"
```

---

### Task 13: Blob storage providers

**Files:**
- Create: `api/src/kokoro_api/providers/blob/__init__.py`
- Create: `api/src/kokoro_api/providers/blob/base.py`
- Create: `api/src/kokoro_api/providers/blob/filesystem.py`
- Create: `api/src/kokoro_api/providers/blob/s3.py`
- Create: `api/tests/providers/test_filesystem_blob.py`

- [ ] **Step 1: Base**

`api/src/kokoro_api/providers/blob/base.py`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel


class PutResult(BaseModel):
    url: str
    latency_ms: int


class BlobStore(ABC):
    name: str

    @abstractmethod
    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult: ...

    @abstractmethod
    async def signed_url(self, key: str, expiry_sec: int) -> str: ...
```

`api/src/kokoro_api/providers/blob/__init__.py`: empty.

- [ ] **Step 2: Test**

`api/tests/providers/test_filesystem_blob.py`:

```python
from __future__ import annotations

from pathlib import Path

import pytest

from kokoro_api.providers.blob.filesystem import FilesystemBlobStore


@pytest.mark.asyncio
async def test_writes_file_returns_url(tmp_path: Path) -> None:
    store = FilesystemBlobStore(root_dir=str(tmp_path), public_base_url="http://localhost:8787/blob")
    r = await store.put(key="x/y/z.mp3", body=b"hello", content_type="audio/mpeg")
    assert r.url == "http://localhost:8787/blob/x/y/z.mp3"
    assert (tmp_path / "x" / "y" / "z.mp3").read_bytes() == b"hello"


@pytest.mark.asyncio
async def test_signed_url_returns_same_path(tmp_path: Path) -> None:
    store = FilesystemBlobStore(root_dir=str(tmp_path), public_base_url="http://h/b")
    url = await store.signed_url("a.mp3", 60)
    assert url == "http://h/b/a.mp3"
```

- [ ] **Step 3: Filesystem driver**

`api/src/kokoro_api/providers/blob/filesystem.py`:

```python
from __future__ import annotations

import time
from pathlib import Path

from kokoro_api.providers.blob.base import BlobStore, PutResult


class FilesystemBlobStore(BlobStore):
    name = "filesystem"

    def __init__(self, *, root_dir: str, public_base_url: str) -> None:
        self._root = Path(root_dir)
        self._base = public_base_url.rstrip("/")

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        t0 = time.monotonic()
        path = self._root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(body, str):
            path.write_text(body, encoding="utf-8")
        else:
            path.write_bytes(body)
        return PutResult(
            url=f"{self._base}/{key}",
            latency_ms=int((time.monotonic() - t0) * 1000),
        )

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        return f"{self._base}/{key}"
```

- [ ] **Step 4: S3 stub**

`api/src/kokoro_api/providers/blob/s3.py`:

```python
from __future__ import annotations

from kokoro_api.providers.blob.base import BlobStore, PutResult


class S3BlobStore(BlobStore):
    name = "s3"

    def __init__(
        self, *,
        bucket: str, endpoint: str,
        access_key: str, secret_key: str,
        public_base_url: str,
    ) -> None:
        self._bucket = bucket
        self._endpoint = endpoint
        self._access = access_key
        self._secret = secret_key
        self._public = public_base_url

    async def put(self, *, key: str, body: bytes | str, content_type: str) -> PutResult:
        raise NotImplementedError("S3BlobStore not yet implemented — use FilesystemBlobStore in dev")

    async def signed_url(self, key: str, expiry_sec: int) -> str:
        raise NotImplementedError("S3BlobStore not yet implemented")
```

- [ ] **Step 5: Run + commit**

```bash
cd api && uv run pytest tests/providers/test_filesystem_blob.py -v
git add api/src/kokoro_api/providers/blob/ api/tests/providers/test_filesystem_blob.py
git commit -m "feat(api): filesystem blob store + s3 stub"
```

---

### Task 14: Voice presets map (mock for MVP)

For MVP we skip persona uploads. Each voice maps to a text-only style hint that gets appended to the Suno style prompt. Voice will drift between generations — accepted risk for now. Schema is forward-compatible: when we record real reference vocals later, we just fill `persona_id` and `synthesize_audio` automatically uses it.

**Files:**
- Replace: `api/src/kokoro_api/providers/audio/personas.json` → `api/src/kokoro_api/providers/audio/voice_presets.json`
- Create: `api/scripts/README.md` documenting the future bootstrap path

- [ ] **Step 1: voice_presets.json**

`api/src/kokoro_api/providers/audio/voice_presets.json`:

```json
{
  "mira": { "persona_id": "", "style_hint": "soft female voice, slow warm narration, low register, breathy delivery, no melody" },
  "brad": { "persona_id": "", "style_hint": "deep male voice, grounded direct cadence, no fluff, spoken word, no melody" },
  "aiko": { "persona_id": "", "style_hint": "gentle young female voice, soothing soft narration, slow tempo, no melody" },
  "sage": { "persona_id": "", "style_hint": "neutral calm voice, balanced register, measured pace, spoken word, no melody" }
}
```

> Note: the `personas.json` file from Task 12 should be **renamed/replaced** by this richer shape. The map shape is `{voiceId: {persona_id: str, style_hint: str}}`. Task 15 (audio synthesis stage) reads both fields.

- [ ] **Step 2: scripts/README.md** — document the future-work bootstrap

`api/scripts/README.md`:

```markdown
# Persona bootstrap (post-MVP)

When we have 4 high-quality reference vocal recordings (Mira / Brad / Aiko / Sage, ~30-60 sec each, recorded in a quiet room), we upload them once to Suno and bind them to the existing voice IDs.

Process (deferred — not part of MVP):

1. Drop recordings at `api/scripts/reference-vocals/{voice}.mp3`.
2. Run `uv run python scripts/bootstrap_personas.py` (script not yet written — write when needed).
3. The script uploads each clip to Suno's personas endpoint, captures the returned `persona_id`, and writes the values into `api/src/kokoro_api/providers/audio/voice_presets.json` next to the existing `style_hint` strings.
4. From that moment on, `synthesize_audio` passes `persona_id` to Suno and the voice stays consistent across sessions.

Until then, voice drift between generations is an accepted MVP risk.
```

- [ ] **Step 3: Commit**

```bash
git add api/src/kokoro_api/providers/audio/voice_presets.json api/scripts/README.md
git commit -m "feat(api): mock voice presets (style hints only); persona bootstrap deferred"
```

---

### Task 15: Audio synthesis stage

**Files:**
- Create: `api/src/kokoro_api/pipeline/synthesize_audio.py`
- Create: `api/tests/pipeline/test_synthesize_audio.py`

- [ ] **Step 1: Failing test**

`api/tests/pipeline/test_synthesize_audio.py`:

```python
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.synthesize_audio import SynthesizeAudioInput, synthesize_audio
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import RegisterNotes, Template, TemplateBeat


def _tpl() -> Template:
    return Template(
        id="unwind_a", content_type="unwind", modes=["soft"],
        becoming_match=["calm"], theme_keywords=[],
        target_duration_sec=60, music_style_prompt="warm ambient",
        reference_track_urls=["https://x/r.mp3"],
        structure=[
            TemplateBeat(id="a", sec=30, intent="x"),
            TemplateBeat(id="b", sec=15, intent="y"),
            TemplateBeat(id="c", sec=15, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


class FakeAudio(MeditationAudioProvider):
    name = "fake"

    def __init__(self) -> None:
        self.synthesize = AsyncMock(return_value=AudioResult(
            audio_bytes=b"audio", mime_type="audio/mpeg",
            duration_sec=60, job_ids=["j1"], chosen_candidate=0, latency_ms=1000,
        ))


@pytest.mark.asyncio
async def test_passes_persona_style_refs_to_provider() -> None:
    fake = FakeAudio()
    personas = {"mira": "persona-mira", "brad": "", "aiko": "", "sage": ""}

    r = await synthesize_audio(SynthesizeAudioInput(
        script="Hi зай.", voice_id="mira", template=_tpl(), locale="en",
    ), fake, personas)

    assert r.audio_bytes == b"audio"
    fake.synthesize.assert_awaited_once()
    kwargs = fake.synthesize.await_args.kwargs
    assert kwargs["voice_persona_id"] == "persona-mira"
    assert kwargs["music_style_prompt"] == "warm ambient"
    assert kwargs["reference_track_urls"] == ["https://x/r.mp3"]
    assert kwargs["target_duration_sec"] == 60
    assert kwargs["candidates"] == 2


@pytest.mark.asyncio
async def test_throws_if_persona_missing() -> None:
    fake = FakeAudio()
    personas = {"mira": "", "brad": "", "aiko": "", "sage": ""}
    with pytest.raises(RuntimeError, match="persona"):
        await synthesize_audio(SynthesizeAudioInput(
            script="x", voice_id="mira", template=_tpl(), locale="en",
        ), fake, personas)
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_synthesize_audio.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/pipeline/synthesize_audio.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.types import Template, VoiceId


class VoicePreset(TypedDict):
    persona_id: str
    style_hint: str


@dataclass(slots=True)
class SynthesizeAudioInput:
    script: str
    voice_id: VoiceId
    template: Template
    locale: Literal["en", "ru"]


async def synthesize_audio(
    input: SynthesizeAudioInput,
    provider: MeditationAudioProvider,
    voice_presets: dict[str, VoicePreset],
) -> AudioResult:
    preset = voice_presets.get(input.voice_id)
    if preset is None:
        raise RuntimeError(
            f"no voice preset for voice_id={input.voice_id}; "
            f"check voice_presets.json",
        )

    style_prompt = f"{preset['style_hint']}; {input.template.music_style_prompt}"

    return await provider.synthesize(
        script=input.script,
        voice_persona_id=preset["persona_id"],
        music_style_prompt=style_prompt,
        reference_track_urls=[str(u) for u in input.template.reference_track_urls],
        target_duration_sec=input.template.target_duration_sec,
        locale=input.locale,
        candidates=2,
    )
```

> Note for Task 12 (Suno provider): if `voice_persona_id` is an empty string, the Suno provider must omit the `persona_id` field from the request payload — Suno will use a default voice driven entirely by the style prompt. The provider already does this via `or None` in the body dict.

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_synthesize_audio.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/pipeline/synthesize_audio.py api/tests/pipeline/test_synthesize_audio.py
git commit -m "feat(api): audio synthesis stage with persona resolution"
```

---

### Task 16: Persistence stage

**Files:**
- Create: `api/src/kokoro_api/pipeline/persist.py`
- Create: `api/tests/pipeline/test_persist.py`

- [ ] **Step 1: Failing test**

`api/tests/pipeline/test_persist.py`:

```python
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from kokoro_api.pipeline.persist import PersistInput, persist
from kokoro_api.providers.blob.base import BlobStore, PutResult


class FakeBlob(BlobStore):
    name = "fake"

    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        async def put(*, key: str, body: bytes | str, content_type: str) -> PutResult:
            self.calls.append({"key": key, "body": body, "content_type": content_type})
            return PutResult(url=f"https://cdn/{key}", latency_ms=5)
        self.put = AsyncMock(side_effect=put)
        self.signed_url = AsyncMock(side_effect=lambda k, _e: f"https://cdn/{k}?sig=x")


@pytest.mark.asyncio
async def test_writes_audio_meta_returns_signed_url() -> None:
    blob = FakeBlob()
    r = await persist(PersistInput(
        meditation_id="m1",
        audio_bytes=b"mp3-bytes",
        mime_type="audio/mpeg",
        meta={"foo": "bar"},
    ), blob)

    assert r.audio_url == "https://cdn/meditations/m1/audio.mp3?sig=x"
    assert blob.put.await_count == 2
    keys = [c["key"] for c in blob.calls]
    assert "meditations/m1/audio.mp3" in keys
    assert "meditations/m1/meta.json" in keys
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_persist.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/pipeline/persist.py`:

```python
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from kokoro_api.providers.blob.base import BlobStore

SIGNED_URL_EXPIRY_SEC = 60 * 60 * 24 * 30


@dataclass(slots=True)
class PersistInput:
    meditation_id: str
    audio_bytes: bytes
    mime_type: Literal["audio/mpeg"]
    meta: dict[str, object]


class PersistResult(BaseModel):
    audio_url: str
    latency_ms: int


async def persist(input: PersistInput, blob: BlobStore) -> PersistResult:
    t0 = time.monotonic()
    audio_key = f"meditations/{input.meditation_id}/audio.mp3"
    meta_key = f"meditations/{input.meditation_id}/meta.json"

    await blob.put(key=audio_key, body=input.audio_bytes, content_type=input.mime_type)
    await blob.put(key=meta_key, body=json.dumps(input.meta, indent=2), content_type="application/json")

    audio_url = await blob.signed_url(audio_key, SIGNED_URL_EXPIRY_SEC)
    return PersistResult(
        audio_url=audio_url,
        latency_ms=int((time.monotonic() - t0) * 1000),
    )
```

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_persist.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/pipeline/persist.py api/tests/pipeline/test_persist.py
git commit -m "feat(api): persistence stage writing audio + meta to blob store"
```

---

### Task 17: Orchestrator

**Files:**
- Create: `api/src/kokoro_api/pipeline/orchestrator.py`
- Create: `api/tests/pipeline/test_orchestrator.py`

- [ ] **Step 1: Failing test (full pipeline with all-fake providers)**

`api/tests/pipeline/test_orchestrator.py`:

```python
from __future__ import annotations

import json
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from kokoro_api.pipeline.orchestrator import PipelineDeps, run_pipeline
from kokoro_api.providers.audio.base import AudioResult, MeditationAudioProvider
from kokoro_api.providers.blob.base import BlobStore, PutResult
from kokoro_api.providers.llm.base import LlmResult, ScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.types import (
    CaptureText, GenerateMeditationInput, RegisterNotes, Template, TemplateBeat,
)


def _tpl() -> Template:
    return Template(
        id="unwind_a", content_type="unwind", modes=["soft", "sharp"],
        becoming_match=["calm"], theme_keywords=["tired"],
        target_duration_sec=60, music_style_prompt="ambient",
        reference_track_urls=[],
        structure=[
            TemplateBeat(id="open",  sec=20, intent="x"),
            TemplateBeat(id="mid",   sec=20, intent="y"),
            TemplateBeat(id="close", sec=20, intent="z"),
        ],
        register_notes=RegisterNotes(soft="s", sharp="s"),
    )


VALID_LLM = json.dumps({
    "script": "Hi зай.",
    "estimatedDurationSec": 60,
    "beats": [{"startSec": 0, "durationSec": 60, "text": "Hi зай.", "type": "opening"}],
})


def _make_deps() -> tuple[PipelineDeps, dict[str, AsyncMock]]:
    stt = TranscriptionProvider.__new__(TranscriptionProvider)
    stt.name = "stt-fake"
    stt.transcribe = AsyncMock()

    llm = ScriptGenerator.__new__(ScriptGenerator)
    llm.name = "llm-fake"
    llm.model = "fake-1"
    llm.generate = AsyncMock(return_value=LlmResult(
        raw_json=VALID_LLM, tokens_in=1, tokens_out=1,
        cache_read_tokens=0, latency_ms=1,
    ))

    audio = MeditationAudioProvider.__new__(MeditationAudioProvider)
    audio.name = "audio-fake"
    audio.synthesize = AsyncMock(return_value=AudioResult(
        audio_bytes=b"mp3", mime_type="audio/mpeg",
        duration_sec=60, job_ids=["j1"], chosen_candidate=0, latency_ms=1,
    ))

    blob = BlobStore.__new__(BlobStore)
    blob.name = "blob-fake"
    blob.put = AsyncMock(side_effect=lambda *, key, body, content_type:
                        PutResult(url=f"https://cdn/{key}", latency_ms=1))
    blob.signed_url = AsyncMock(side_effect=lambda k, _e: f"https://cdn/{k}?sig=1")

    deps = PipelineDeps(
        templates=[_tpl()], stt=stt, llm=llm, audio=audio, blob=blob,
        personas={"mira": "p-mira", "brad": "", "aiko": "", "sage": ""},
    )
    return deps, {"stt_transcribe": stt.transcribe}


def _input() -> GenerateMeditationInput:
    return GenerateMeditationInput(
        call_me="зай", mode="soft",
        capture=CaptureText(kind="text", text="tired"),
        content_type="unwind", becoming="calm", voice_id="mira",
        locale="en", request_id=UUID("11111111-1111-1111-1111-111111111111"),
    )


@pytest.mark.asyncio
async def test_produces_valid_output() -> None:
    deps, _ = _make_deps()
    out = await run_pipeline(_input(), deps)
    assert "зай" in out.script
    assert "audio.mp3" in out.audio_url
    assert len(out.beats) == 1
    assert out.template_used_id == "unwind_a"
    assert out.provider_meta.total_latency_ms >= 0


@pytest.mark.asyncio
async def test_does_not_call_stt_for_text_capture() -> None:
    deps, mocks = _make_deps()
    await run_pipeline(_input(), deps)
    mocks["stt_transcribe"].assert_not_awaited()
```

- [ ] **Step 2: Run, verify fail**

```bash
cd api && uv run pytest tests/pipeline/test_orchestrator.py -v
```

- [ ] **Step 3: Implement**

`api/src/kokoro_api/pipeline/orchestrator.py`:

```python
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from kokoro_api.pipeline.generate_script import GenerateScriptInput, generate_script
from kokoro_api.pipeline.persist import PersistInput, persist
from kokoro_api.pipeline.resolve_capture import resolve_capture
from kokoro_api.pipeline.select_template import SelectInput, select_template
from kokoro_api.pipeline.synthesize_audio import SynthesizeAudioInput, synthesize_audio
from kokoro_api.providers.audio.base import MeditationAudioProvider
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.providers.llm.base import ScriptGenerator
from kokoro_api.providers.stt.base import TranscriptionProvider
from kokoro_api.types import (
    AudioMeta, CaptureVoice, GenerateMeditationInput, GenerateMeditationOutput,
    LlmMeta, PersistenceMeta, ProviderMeta, Template,
)


@dataclass(slots=True)
class PipelineDeps:
    templates: list[Template]
    stt: TranscriptionProvider
    llm: ScriptGenerator
    audio: MeditationAudioProvider
    blob: BlobStore
    personas: dict[str, str]


async def run_pipeline(
    input: GenerateMeditationInput, deps: PipelineDeps,
) -> GenerateMeditationOutput:
    t0 = time.monotonic()
    meditation_id = str(uuid.uuid4())

    captured = await resolve_capture(input.capture, input.locale, deps.stt)

    template = select_template(deps.templates, SelectInput(
        content_type=input.content_type,
        mode=input.mode,
        theme_text=captured.text,
        becoming=input.becoming,
    ))

    history_dict = None
    if input.history is not None:
        history_dict = {
            "previous_scripts": input.history.previous_scripts or [],
            "last_becoming": input.history.last_becoming or "",
        }

    scripted = await generate_script(GenerateScriptInput(
        call_me=input.call_me, mode=input.mode, capture_text=captured.text,
        becoming=input.becoming, template=template, history=history_dict,  # type: ignore[arg-type]
        locale=input.locale,
    ), deps.llm)

    audio = await synthesize_audio(SynthesizeAudioInput(
        script=scripted.script, voice_id=input.voice_id, template=template, locale=input.locale,
    ), deps.audio, deps.personas)

    generated_at = datetime.now(timezone.utc).isoformat()

    capture_for_meta = input.capture.model_dump(by_alias=True)
    if isinstance(input.capture, CaptureVoice):
        capture_for_meta["audioUrl"] = "<redacted>"

    meta = {
        "meditationId": meditation_id,
        "requestId": str(input.request_id),
        "generatedAt": generated_at,
        "input": {**input.model_dump(by_alias=True, exclude={"capture"}), "capture": capture_for_meta},
        "templateUsedId": template.id,
        "script": scripted.script,
        "beats": [b.model_dump(by_alias=True) for b in scripted.beats],
    }

    persisted = await persist(PersistInput(
        meditation_id=meditation_id,
        audio_bytes=audio.audio_bytes,
        mime_type=audio.mime_type,
        meta=meta,
    ), deps.blob)

    provider_meta = ProviderMeta(
        transcription=captured.transcription_meta,
        llm=scripted.meta,
        audio=AudioMeta(
            provider=deps.audio.name, job_id=",".join(audio.job_ids),
            latency_ms=audio.latency_ms, candidates=len(audio.job_ids),
            chosen_candidate=audio.chosen_candidate,
        ),
        persistence=PersistenceMeta(provider=deps.blob.name, latency_ms=persisted.latency_ms),
        total_latency_ms=int((time.monotonic() - t0) * 1000),
    )

    return GenerateMeditationOutput(
        meditation_id=meditation_id,
        audio_url=persisted.audio_url,
        duration_sec=audio.duration_sec,
        script=scripted.script,
        beats=scripted.beats,
        template_used_id=template.id,
        generated_at=generated_at,
        provider_meta=provider_meta,
    )
```

- [ ] **Step 4: Run, verify pass**

```bash
cd api && uv run pytest tests/pipeline/test_orchestrator.py -v
```

- [ ] **Step 5: Commit**

```bash
git add api/src/kokoro_api/pipeline/orchestrator.py api/tests/pipeline/test_orchestrator.py
git commit -m "feat(api): pipeline orchestrator wiring all 5 stages"
```

---

### Task 18: HTTP route + DI wiring

**Files:**
- Create: `api/src/kokoro_api/routes/__init__.py`
- Create: `api/src/kokoro_api/routes/meditations.py`
- Create: `api/src/kokoro_api/lib/__init__.py`
- Create: `api/src/kokoro_api/lib/errors.py`
- Modify: `api/src/kokoro_api/main.py` (register route + DI container)
- Create: `api/tests/routes/__init__.py`
- Create: `api/tests/routes/test_meditations.py`

- [ ] **Step 1: Failing test**

`api/tests/routes/test_meditations.py`:

```python
from __future__ import annotations

from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from kokoro_api.routes.meditations import register_meditations_route
from kokoro_api.types import (
    AudioMeta, GenerateMeditationOutput, LlmMeta, PersistenceMeta, ProviderMeta, ScriptBeat,
)


def _ok_output() -> GenerateMeditationOutput:
    return GenerateMeditationOutput(
        meditation_id="m1",
        audio_url="https://cdn/x.mp3",
        duration_sec=60,
        script="Hi зай.",
        beats=[ScriptBeat(start_sec=0, duration_sec=60, text="x", type="opening")],
        template_used_id="t",
        generated_at="now",
        provider_meta=ProviderMeta(
            llm=LlmMeta(provider="p", model="m", latency_ms=1, tokens_in=1, tokens_out=1, cache_read_tokens=0),
            audio=AudioMeta(provider="a", job_id="j", latency_ms=1, candidates=1, chosen_candidate=0),
            persistence=PersistenceMeta(provider="b", latency_ms=1),
            total_latency_ms=5,
        ),
    )


@pytest.mark.asyncio
async def test_returns_200_with_valid_output() -> None:
    app = FastAPI()
    register_meditations_route(app, run_pipeline=AsyncMock(return_value=_ok_output()))

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post("/meditations", json={
            "callMe": "зай", "mode": "soft",
            "capture": {"kind": "text", "text": "tired"},
            "contentType": "unwind", "becoming": "calm", "voiceId": "mira",
            "locale": "en", "requestId": "11111111-1111-1111-1111-111111111111",
        })
        assert res.status_code == 200
        assert res.json()["audioUrl"] == "https://cdn/x.mp3"


@pytest.mark.asyncio
async def test_returns_400_on_invalid_input() -> None:
    app = FastAPI()
    register_meditations_route(app, run_pipeline=AsyncMock())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://x") as client:
        res = await client.post("/meditations", json={"callMe": "", "mode": "soft"})
        assert res.status_code == 422  # FastAPI default for body validation
```

> Note: FastAPI returns 422 by default on Pydantic validation failure. The plan's spec says 400 — we map that in the route handler explicitly.

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Errors module**

`api/src/kokoro_api/lib/errors.py`:

```python
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class ErrorBody(BaseModel):
    error: Literal[
        "INVALID_INPUT", "AUDIO_GEN_FAILED",
        "UPSTREAM_RATE_LIMIT", "UPSTREAM_TIMEOUT", "INTERNAL",
    ]
    details: dict[str, object]
```

`api/src/kokoro_api/lib/__init__.py`: empty.

- [ ] **Step 4: Route**

`api/src/kokoro_api/routes/meditations.py`:

```python
from __future__ import annotations

import uuid
from typing import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from kokoro_api.types import GenerateMeditationInput, GenerateMeditationOutput

PipelineFn = Callable[[GenerateMeditationInput], Awaitable[GenerateMeditationOutput]]


def register_meditations_route(app: FastAPI, *, run_pipeline: PipelineFn) -> None:
    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_req: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": "INVALID_INPUT", "details": exc.errors()},
        )

    @app.post("/meditations", response_model=GenerateMeditationOutput, response_model_by_alias=True)
    async def post_meditation(input: GenerateMeditationInput) -> GenerateMeditationOutput | JSONResponse:
        try:
            return await run_pipeline(input)
        except TimeoutError as e:
            return JSONResponse(status_code=504, content={
                "error": "UPSTREAM_TIMEOUT", "details": {"stage": "audio", "message": str(e)},
            })
        except RuntimeError as e:
            msg = str(e)
            if "no candidate" in msg:
                return JSONResponse(status_code=422, content={
                    "error": "AUDIO_GEN_FAILED", "details": {"reason": msg},
                })
            if "rate limit" in msg.lower():
                return JSONResponse(status_code=429, content={
                    "error": "UPSTREAM_RATE_LIMIT", "details": {"retryAfterSec": 30},
                })
            return JSONResponse(status_code=500, content={
                "error": "INTERNAL", "details": {"traceId": str(uuid.uuid4()), "message": msg},
            })
```

`api/src/kokoro_api/routes/__init__.py`: empty.
`api/tests/routes/__init__.py`: empty.

- [ ] **Step 5: Wire into main.py**

Replace the body of `api/src/kokoro_api/main.py`:

```python
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from kokoro_api.config import load_config
from kokoro_api.pipeline.orchestrator import PipelineDeps, run_pipeline
from kokoro_api.providers.audio.suno import SunoAudioProvider
from kokoro_api.providers.blob.base import BlobStore
from kokoro_api.providers.blob.filesystem import FilesystemBlobStore
from kokoro_api.providers.blob.s3 import S3BlobStore
from kokoro_api.providers.llm.anthropic_provider import AnthropicScriptGenerator
from kokoro_api.providers.stt.whisper import WhisperProvider
from kokoro_api.routes.meditations import register_meditations_route
from kokoro_api.templates.loader import load_templates

log = structlog.get_logger()
config = load_config()


def _make_blob() -> BlobStore:
    if config.blob_driver == "s3":
        assert config.blob_s3_bucket and config.blob_s3_endpoint
        assert config.blob_s3_access_key and config.blob_s3_secret_key
        assert config.blob_public_base_url
        return S3BlobStore(
            bucket=config.blob_s3_bucket, endpoint=str(config.blob_s3_endpoint),
            access_key=config.blob_s3_access_key, secret_key=config.blob_s3_secret_key,
            public_base_url=str(config.blob_public_base_url),
        )
    base = (
        str(config.blob_public_base_url)
        if config.blob_public_base_url
        else f"http://localhost:{config.port}/blob"
    )
    return FilesystemBlobStore(root_dir=config.blob_fs_dir, public_base_url=base)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("kokoro_api.startup")
    yield
    log.info("kokoro_api.shutdown")


app = FastAPI(lifespan=lifespan, title="kokoro-api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in config.cors_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if config.blob_driver == "filesystem":
    Path(config.blob_fs_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/blob", StaticFiles(directory=config.blob_fs_dir), name="blob")

stt = WhisperProvider(api_key=config.whisper_api_key, base_url=str(config.whisper_base_url))
llm = AnthropicScriptGenerator(
    base_url=str(config.anthropic_base_url),
    api_key=config.anthropic_api_key,
    model=config.anthropic_model,
)
audio = SunoAudioProvider(base_url=str(config.suno_base_url), api_key=config.suno_api_key)
blob = _make_blob()

_personas_path = Path(__file__).parent / "providers" / "audio" / "personas.json"
personas: dict[str, str] = json.loads(_personas_path.read_text())

# templates loaded lazily on first call (event loop already running by then)
_templates_cache: list = []


async def _ensure_templates_loaded() -> list:
    if not _templates_cache:
        _templates_cache.extend(await load_templates())
    return _templates_cache


async def _run(input):  # type: ignore[no-untyped-def]
    templates = await _ensure_templates_loaded()
    deps = PipelineDeps(
        templates=templates, stt=stt, llm=llm, audio=audio, blob=blob, personas=personas,
    )
    return await run_pipeline(input, deps)


@app.get("/health")
async def health() -> dict[str, object]:
    import time
    return {"ok": True, "ts": int(time.time() * 1000)}


register_meditations_route(app, run_pipeline=_run)


def serve() -> None:
    import uvicorn
    uvicorn.run(
        "kokoro_api.main:app", host="0.0.0.0", port=config.port,
        log_level="info" if config.node_env == "production" else "debug",
    )


if __name__ == "__main__":
    serve()
```

- [ ] **Step 6: Run all tests, verify pass**

```bash
cd api && uv run pytest -v
```

- [ ] **Step 7: Commit**

```bash
git add api/
git commit -m "feat(api): http route + di wiring for /meditations"
```

---

### Task 19: Frontend type sharing + client call

**Files:**
- Create: `app/src/lib/types-meditation.ts`
- Create: `app/src/lib/api.ts`
- Modify: `app/src/screens/Composing.tsx`

This task remains in TypeScript — only the backend was Pythonized.

- [ ] **Step 1: Mirror types**

`app/src/lib/types-meditation.ts`:

```ts
// Mirror of api/src/kokoro_api/types.py. Update both when changing.
// JSON wire format is camelCase via Pydantic alias_generator.

export type Mode = 'soft' | 'sharp';
export type ContentType = 'unwind' | 'attract' | 'lockin';
export type VoiceId = 'mira' | 'brad' | 'aiko' | 'sage';
export type Becoming =
  | 'calm' | 'sleep' | 'focus' | 'detachment'
  | 'confidence' | 'softness' | 'power' | 'future' | 'action';
export type Locale = 'en' | 'ru';
export type BeatType = 'opening' | 'line' | 'breath' | 'pause' | 'closing';

export type Capture =
  | { kind: 'voice'; audioUrl: string; mimeType: string }
  | { kind: 'text';  text: string }
  | { kind: 'theme'; chips: string[] };

export type GenerateMeditationInput = {
  callMe: string;
  realName?: string;
  mode: Mode;
  capture: Capture;
  contentType: ContentType;
  becoming?: Becoming;
  voiceId: VoiceId;
  history?: { previousScripts?: string[]; lastBecoming?: string };
  locale: Locale;
  requestId: string;
};

export type ScriptBeat = {
  startSec: number;
  durationSec: number;
  text: string;
  type: BeatType;
};

export type ProviderMeta = {
  transcription?: { provider: string; latencyMs: number; confidence: number };
  llm: { provider: string; model: string; latencyMs: number; tokensIn: number; tokensOut: number; cacheReadTokens: number };
  audio: { provider: string; jobId: string; latencyMs: number; candidates: number; chosenCandidate: number };
  persistence: { provider: string; latencyMs: number };
  totalLatencyMs: number;
};

export type GenerateMeditationOutput = {
  meditationId: string;
  audioUrl: string;
  durationSec: number;
  script: string;
  beats: ScriptBeat[];
  templateUsedId: string;
  generatedAt: string;
  providerMeta: ProviderMeta;
};
```

- [ ] **Step 2: API client**

`app/src/lib/api.ts`:

```ts
import type { GenerateMeditationInput, GenerateMeditationOutput } from './types-meditation';

const API_BASE = (import.meta.env.VITE_API_BASE as string) ?? 'http://localhost:8787';

export async function generateMeditation(
  input: GenerateMeditationInput,
  signal?: AbortSignal,
): Promise<GenerateMeditationOutput> {
  const res = await fetch(`${API_BASE}/meditations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`api ${res.status}: ${body.error ?? 'unknown'} ${JSON.stringify(body.details ?? {})}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Wire into Composing.tsx**

Replace the 9-second fake timer in `app/src/screens/Composing.tsx` with a real call: kick off `generateMeditation(input)` on mount, write the output to a new piece of state, then `goto('player')`. Show stage-aware copy ("Listening… → Writing… → Voicing… → Almost ready") tied to elapsed time. For voice capture: out of scope here (separate `/uploads` endpoint not yet built); flag voice as TODO.

- [ ] **Step 4: Manual smoke test**

```bash
# terminal 1
cd api && uv run uvicorn kokoro_api.main:app --port 8787
# terminal 2
cd app && pnpm dev
# browser: open http://localhost:5173, complete capture flow with TEXT input
```

- [ ] **Step 5: Commit**

```bash
git add app/
git commit -m "feat(app): wire composing screen to /meditations endpoint"
```

---

### Task 20: Player plays the real audio

Same as TS plan — replace fake timer in `app/src/screens/Player.tsx` with real `<audio>` element driven by `audioUrl`, `durationSec`, and `beats` from generated output.

```bash
git add app/src/screens/Player.tsx
git commit -m "feat(app): player plays real generated audio with beat-driven subtitles"
```

---

### Task 21: README + wiring docs

- Update root `README.md` with API + templates sections
- `api/README.md` already created in Task 1 — extend with deployment notes if needed

```bash
git add README.md api/README.md
git commit -m "docs: api setup and templates docs"
```

---

## Out-of-scope for this plan (intentional)

- **Continuity engine.** `history` is wired but no storage layer remembers past sessions. V1.
- **Vector-based template selection.** Rule-based now; embeddings + FAISS later (Python makes this easier than the TS plan would have).
- **Hybrid TTS+Suno-bed fallback.** `MeditationAudioProvider` interface allows it; the `HybridAudioProvider` adapter is V1 work after we test Suno-only with users. Python's pydub/librosa make ffmpeg-mix tractable when needed.
- **Streaming progress in `Composing.tsx`.** Today we show stage hints by elapsed time. Real SSE/WS comes once we know the latency distribution.
- **Voice-capture upload endpoint.** API expects `audioUrl` for voice mode; the `POST /uploads` endpoint is a separate plan.
- **Auth, billing, rate-limiting.** Pre-launch MVP.
- **R2/S3 prod blob driver.** Stub exists; flesh out when we have the bucket.
- **Local model swap (faster-whisper, sentence-transformers).** Python paves the road; actual swap is a separate task.

---

## Self-review notes

- **Spec coverage:** All five user-listed inputs (callMe, capture, voiceId, contentType, mode/becoming) → tasks 2 (schema), 5 (resolve), 7-8 (prompt), 11 (script), 15 (audio). LLM step → 7-11. Suno + reference tracks → 12, 15. ✅
- **Provider swap-points:** `TranscriptionProvider`, `ScriptGenerator`, `MeditationAudioProvider`, `BlobStore` — each is an ABC with at least one concrete impl + a fake used in tests. Replacing Suno = task-12 file rewrite + DI line in task-18. ✅
- **JSON contract preserved:** Pydantic `alias_generator=to_camel` keeps the camelCase wire format the frontend expects. ✅
- **Open risk flagged:** Suno endpoint shapes (Task 12) follow acedata.cloud docs as of 2026-05-03 — verify before merge.
- **Type consistency:** `GenerateMeditationInput`, `GenerateMeditationOutput`, `ScriptBeat`, `Template` defined once in `api/src/kokoro_api/types.py` (task 2), used by every later task. ✅
