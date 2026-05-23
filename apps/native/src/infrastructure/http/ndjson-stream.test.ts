import type { StreamEvent } from "@domain/meditation/stream-event";
import { openNdjsonStream } from "./ndjson-stream";

// Stub XMLHttpRequest so we can pump chunks at it like the real backend would.
type Handlers = {
  onprogress?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onloadend?: () => void;
};

class FakeXHR implements Handlers {
  static instances: FakeXHR[] = [];

  status = 0;
  responseText = "";
  readonly headers = new Map<string, string>();
  body: string | null = null;
  url = "";

  onprogress?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onloadend?: () => void;

  open(_method: string, url: string): void {
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  send(body: string): void {
    this.body = body;
    FakeXHR.instances.push(this);
  }

  abort(): void {
    /* noop */
  }

  // Helpers used by tests:
  pushChunk(chunk: string, status = 200): void {
    if (this.status === 0) this.status = status;
    this.responseText += chunk;
    this.onprogress?.();
  }

  finish(status = 200): void {
    if (this.status === 0) this.status = status;
    this.onloadend?.();
  }
}

beforeEach(() => {
  FakeXHR.instances = [];
  (global as unknown as { XMLHttpRequest: typeof FakeXHR }).XMLHttpRequest = FakeXHR;
});

const collect = async (iter: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> => {
  const out: StreamEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
};

const scriptLine = (id: string) =>
  JSON.stringify({
    event: "script",
    meditationId: id,
    lyrics: "l",
    style: "s",
    vibe: "zen",
    templateId: "t",
    generatedAt: "g",
  });

const streamingLine = (id: string) =>
  JSON.stringify({
    event: "streaming",
    meditationId: id,
    streamAudioUrl: "https://x.test/a.mp3",
    durationSec: 1,
  });

const readyLine = (id: string) =>
  JSON.stringify({
    event: "ready",
    meditationId: id,
    audioUrl: "https://x.test/b.mp3",
    durationSec: 1,
    providerMeta: {
      llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
      audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
      persistence: { provider: "", latencyMs: 0 },
      totalLatencyMs: 0,
    },
  });

describe("openNdjsonStream", () => {
  it("emits script → streaming → ready in order", async () => {
    const handle = openNdjsonStream({ url: "/x", body: {} });
    const xhr = FakeXHR.instances[0]!;
    xhr.pushChunk(`${scriptLine("a")}\n`);
    xhr.pushChunk(`${streamingLine("a")}\n${readyLine("a")}\n`);
    xhr.finish(200);

    const events = await collect(handle.events);
    expect(events.map((e) => e.event)).toEqual(["script", "streaming", "ready"]);
  });

  it("buffers across mid-line chunk boundaries", async () => {
    const handle = openNdjsonStream({ url: "/x", body: {} });
    const xhr = FakeXHR.instances[0]!;
    const line = `${scriptLine("a")}\n`;
    // split mid-JSON to prove the buffer reassembles the line correctly
    xhr.pushChunk(line.slice(0, 12));
    xhr.pushChunk(line.slice(12));
    xhr.finish();

    const events = await collect(handle.events);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("script");
  });

  it("flushes a trailing line that has no newline before close", async () => {
    const handle = openNdjsonStream({ url: "/x", body: {} });
    const xhr = FakeXHR.instances[0]!;
    xhr.pushChunk(scriptLine("a")); // no trailing newline
    xhr.finish();
    const events = await collect(handle.events);
    expect(events).toHaveLength(1);
  });

  it("throws on an error event", async () => {
    const handle = openNdjsonStream({ url: "/x", body: {} });
    const xhr = FakeXHR.instances[0]!;
    xhr.pushChunk(
      `${JSON.stringify({ event: "error", error: "INTERNAL", details: { stage: "audio" } })}\n`,
    );
    xhr.finish();
    await expect(collect(handle.events)).rejects.toThrow(/stream INTERNAL/);
  });

  it("rejects with ApiError on HTTP >= 400", async () => {
    const handle = openNdjsonStream({ url: "/x", body: {} });
    const xhr = FakeXHR.instances[0]!;
    xhr.responseText = JSON.stringify({ error: "RATE_LIMIT", details: { retryAfter: 30 } });
    xhr.finish(429);
    await expect(collect(handle.events)).rejects.toThrow(/RATE_LIMIT/);
  });
});
