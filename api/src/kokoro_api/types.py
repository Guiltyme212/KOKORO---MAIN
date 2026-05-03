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
    """Loaded from JSON in /templates. Internal-only, not part of the public API."""

    id: str
    content_type: ContentType = Field(alias="contentType")
    modes: list[Mode] = Field(min_length=1)
    becoming_match: list[str] = Field(alias="becomingMatch")
    theme_keywords: list[str] = Field(alias="themeKeywords")
    target_duration_sec: int = Field(alias="targetDurationSec", gt=0)
    music_style_prompt: str = Field(alias="musicStylePrompt", min_length=10)
    reference_track_urls: list[str] = Field(alias="referenceTrackUrls", max_length=2)
    structure: list[TemplateBeat] = Field(min_length=3)
    register_notes: RegisterNotes = Field(alias="registerNotes")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
