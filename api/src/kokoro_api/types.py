from __future__ import annotations

from typing import Annotated, Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

# The single dimension the user picks on the Mode screen. Each value maps
# 1:1 to a vibe template (audio + transcript + writer directive + music style).
Vibe = Literal["raw", "cosmic", "iron", "zen", "sleep"]
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
    # Frontend may have already transcribed via Web Speech; trust it unless
    # missing. Saves the server STT call when set.
    transcribed_text: str | None = None


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
    last_vibe: Vibe | None = None


ClientSource = Literal["telegram", "web"]


class ClientInfo(_CamelModel):
    source: ClientSource = "web"
    tg_user_id: int | None = None
    tg_username: str | None = None
    tg_first_name: str | None = None
    tg_language_code: str | None = None
    tg_is_premium: bool | None = None
    tg_init_data: str | None = None


class GenerateMeditationInput(_CamelModel):
    call_me: Annotated[str, Field(min_length=1, max_length=24, pattern=r"^[^\n\r]+$")]
    real_name: Annotated[str, Field(max_length=60)] | None = None
    capture: Capture
    vibe: Vibe
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
    vibe: Vibe
    template_id: str
    generated_at: str
    provider_meta: ProviderMeta


# Streaming pipeline events emitted by `POST /meditations/stream` as NDJSON.
class StreamScriptEvent(_CamelModel):
    event: Literal["script"] = "script"
    meditation_id: str
    lyrics: str
    style: str
    vibe: Vibe
    template_id: str
    generated_at: str


class StreamStreamingEvent(_CamelModel):
    event: Literal["streaming"] = "streaming"
    meditation_id: str
    stream_audio_url: str
    duration_sec: float


class StreamReadyEvent(_CamelModel):
    event: Literal["ready"] = "ready"
    meditation_id: str
    audio_url: str
    duration_sec: float
    provider_meta: ProviderMeta


class StreamErrorEvent(_CamelModel):
    event: Literal["error"] = "error"
    error: str
    details: dict[str, object] = Field(default_factory=dict)


class StreamPingEvent(_CamelModel):
    # Keep-alive heartbeat emitted every ~10s during silent waits (LLM / Suno
    # polling) so the long-lived NDJSON connection never goes idle and gets
    # dropped by the Railway edge / iOS WKWebView. Carries no payload — its mere
    # arrival keeps the socket warm. The client consumes and ignores it.
    event: Literal["ping"] = "ping"


class LibraryItem(_CamelModel):
    """Summary of a saved meditation. Stored per-user in the blob store."""

    meditation_id: str
    audio_url: str
    duration_sec: float
    call_me: str
    real_name: str | None = None
    vibe: Vibe
    capture_preview: str | None = None
    saved_at: str
    generated_at: str


class LibraryListOutput(_CamelModel):
    items: list[LibraryItem]


class LibrarySaveInput(_CamelModel):
    meditation_id: str
    tg_user_id: int


class LibraryV1SaveInput(_CamelModel):
    meditation_id: str


class LibraryRemoveInput(_CamelModel):
    tg_user_id: int


class UploadResponse(_CamelModel):
    audio_url: str
    key: str
    mime_type: str


class FeedbackInput(_CamelModel):
    tg_user_id: int | None = None
    liked: bool


class FeedbackV1Input(_CamelModel):
    liked: bool


class FeedbackOutput(_CamelModel):
    ok: bool


class Template(BaseModel):
    """Loaded from JSON in api/templates/vibe_<vibe>_NN.json.

    Each vibe template is the single source of truth for one mode: the
    full reference transcript that the writer rewrites, the writer-style
    directive, the Suno music-style prompt, and the reference audio that
    Suno uses with upload-cover. Internal-only; never sent to the user.
    """

    id: str
    vibe: Vibe
    target_duration_sec: int = Field(alias="targetDurationSec", gt=0)
    music_style_prompt: str = Field(alias="musicStylePrompt", min_length=10)
    reference_track_urls: list[str] = Field(alias="referenceTrackUrls", min_length=0, max_length=2)
    transcript: str = Field(min_length=1)
    writer_directive: str = Field(alias="writerDirective", min_length=1)

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
