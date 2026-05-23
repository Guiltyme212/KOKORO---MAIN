// Plain fetch-mocking keeps these tests independent of msw, which ships
// pre-bundled ESM that jest-expo would need extra Babel work to transform.

import { API_BASE } from "@infrastructure/http/client";
import { elevenlabsApi } from "./elevenlabs";
import { meditationsApi } from "./meditations";

type FetchInit = RequestInit & { method?: string };
type FetchHandler = (url: string, init: FetchInit) => Promise<Response>;

const handlers: FetchHandler[] = [];
const realFetch = global.fetch;

const mockFetch: typeof fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : (input as Request).url;
  for (const handler of handlers) {
    const res = await handler(url, init as FetchInit);
    if (res) return res;
  }
  throw new Error(`unmocked fetch: ${(init as FetchInit).method ?? "GET"} ${url}`);
};

const matchOnce = (method: string, urlSuffix: string, responder: () => Response | Promise<Response>): void => {
  let used = false;
  handlers.push(async (url, init) => {
    if (used) return undefined as unknown as Response;
    if ((init.method ?? "GET").toUpperCase() !== method.toUpperCase()) {
      return undefined as unknown as Response;
    }
    if (!url.endsWith(urlSuffix) && !url.includes(urlSuffix)) {
      return undefined as unknown as Response;
    }
    used = true;
    return responder();
  });
};

beforeEach(() => {
  handlers.length = 0;
  (global as { fetch: typeof fetch }).fetch = mockFetch;
});

afterAll(() => {
  (global as { fetch: typeof fetch }).fetch = realFetch;
});

const jsonResponse = (data: unknown, init: ResponseInit = { status: 200 }): Response =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

describe("elevenlabsApi", () => {
  it("getConversationToken returns the token string and forwards participantName", async () => {
    let observedUrl = "";
    handlers.push(async (url, init) => {
      if (!url.includes("/elevenlabs/conversation-token")) {
        return undefined as unknown as Response;
      }
      if ((init.method ?? "GET") !== "GET") return undefined as unknown as Response;
      observedUrl = url;
      return jsonResponse({ token: "tkn" });
    });

    expect(await elevenlabsApi.getConversationToken("Babe")).toBe("tkn");
    expect(observedUrl).toContain("participantName=Babe");
  });

  it("throws when the token field is missing", async () => {
    matchOnce("GET", "/elevenlabs/conversation-token", () => jsonResponse({ token: "" }));
    await expect(elevenlabsApi.getConversationToken()).rejects.toThrow(/token missing/);
  });

  it("getConversationSignedUrl returns the URL string", async () => {
    matchOnce("GET", "/elevenlabs/conversation-signed-url", () =>
      jsonResponse({ signedUrl: "wss://x.test/a" }),
    );
    expect(await elevenlabsApi.getConversationSignedUrl()).toBe("wss://x.test/a");
  });
});

describe("meditationsApi.generate (single-shot)", () => {
  it("posts the input and returns the output", async () => {
    let receivedBody: unknown = null;
    handlers.push(async (url, init) => {
      if (!url.endsWith("/meditations") || init.method !== "POST") {
        return undefined as unknown as Response;
      }
      receivedBody = JSON.parse(String(init.body));
      return jsonResponse({
        meditationId: "m",
        audioUrl: "x",
        durationSec: 1,
        style: "",
        lyrics: "",
        vibe: "zen",
        templateId: "",
        generatedAt: "",
        providerMeta: {
          llm: { provider: "", model: "", latencyMs: 0, tokensIn: 0, tokensOut: 0, cacheReadTokens: 0 },
          audio: { provider: "", jobId: "", latencyMs: 0, candidates: 0, chosenCandidate: 0 },
          persistence: { provider: "", latencyMs: 0 },
          totalLatencyMs: 0,
        },
      });
    });

    const out = await meditationsApi.generate({
      callMe: "friend",
      vibe: "zen",
      capture: { kind: "theme", chips: ["tired"] },
      locale: "en",
      requestId: "11111111-1111-1111-1111-111111111111",
    });
    expect(out.meditationId).toBe("m");
    expect((receivedBody as { vibe: string }).vibe).toBe("zen");
  });

  it("surfaces a non-2xx error as ApiError", async () => {
    matchOnce("POST", "/meditations", () =>
      jsonResponse({ error: "BAD", details: { hint: "x" } }, { status: 400 }),
    );
    await expect(
      meditationsApi.generate({
        callMe: "friend",
        vibe: "zen",
        capture: { kind: "text", text: "hi" },
        locale: "en",
        requestId: "11111111-1111-1111-1111-111111111111",
      }),
    ).rejects.toThrow(/api 400/);
  });
});

describe("API_BASE", () => {
  it("strips trailing slashes", () => {
    expect(API_BASE.endsWith("/")).toBe(false);
  });
});
