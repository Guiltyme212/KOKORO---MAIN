from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Mode = Literal["soft", "sharp"]
ContentType = Literal["unwind", "attract", "lockin"]
VoiceId = Literal["mira", "brad", "aiko", "sage"]
Becoming = Literal[
    "calm",
    "sleep",
    "focus",
    "detachment",
    "confidence",
    "softness",
    "power",
    "future",
    "action",
]
Locale = Literal["en", "ru"]


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


ClientSource = Literal["telegram", "web"]


class ClientInfo(_CamelModel):
    source: ClientSource = "web"
    tg_user_id: int | None = None
    tg_username: str | None = None
    tg_first_name: str | None = None
    tg_language_code: str | None = None
    tg_is_premium: bool | None = None
    # Raw signed initData; we don't verify it server-side yet (no bot token wired in),
    # but we keep it so HMAC verification can be added later without a frontend change.
    tg_init_data: str | None = None


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
    client: ClientInfo | None = None


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
    style: str
    lyrics: str
    picked_reference_ids: list[str]
    generated_at: str
    provider_meta: ProviderMeta


class LibraryItem(_CamelModel):
    """Summary of a saved meditation. Stored per-user in the blob store."""

    meditation_id: str
    audio_url: str
    duration_sec: float
    call_me: str
    real_name: str | None = None
    content_type: ContentType
    becoming: Becoming | None = None
    mode: Mode
    capture_preview: str | None = None
    saved_at: str
    generated_at: str


class LibraryListOutput(_CamelModel):
    items: list[LibraryItem]


class LibrarySaveInput(_CamelModel):
    meditation_id: str
    tg_user_id: int


class LibraryRemoveInput(_CamelModel):
    tg_user_id: int


class Template(BaseModel):
    """Loaded from JSON in /templates. Internal-only, not part of the public API.

    Slimmed: the writer LLM now generates the Suno style string per request, and
    the picker LLM selects reference transcripts from meditation_scripts/. The
    template only carries the music/duration profile per (content_type, mode)
    and the optional reference audio used by Suno's upload-cover endpoint.
    """

    id: str
    content_type: ContentType = Field(alias="contentType")
    modes: list[Mode] = Field(min_length=1)
    target_duration_sec: int = Field(alias="targetDurationSec", gt=0)
    music_style_prompt: str = Field(alias="musicStylePrompt", min_length=10)
    reference_track_urls: list[str] = Field(alias="referenceTrackUrls", max_length=2)

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
