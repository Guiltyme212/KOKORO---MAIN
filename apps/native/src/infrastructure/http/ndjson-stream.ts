import type { StreamEvent } from "@domain/meditation/stream-event";
import type { MeditationStreamHandle } from "@application/ports/meditation-api.port";
import { ApiError } from "./client";

// NDJSON stream reader using XMLHttpRequest. We deliberately avoid
// `response.body.getReader()` because RN's fetch streaming support is
// inconsistent across the supported versions — XHR `onprogress` is universal.
//
// Strategy:
//  1. open XHR, send body
//  2. on each `progress` event, slice the new chunk out of responseText,
//     append to a buffer, parse complete newline-delimited JSON lines
//  3. push parsed StreamEvents onto an async queue
//  4. when `loadend` fires, flush any trailing line and close the queue
//
// Error events (`{ event: 'error', ... }`) are converted to thrown errors so
// the consumer's for-await loop rejects, matching the web's generator semantics.

type QueueEntry =
  | { kind: "event"; value: StreamEvent }
  | { kind: "error"; error: Error }
  | { kind: "done" };

class AsyncQueue {
  private readonly entries: QueueEntry[] = [];
  private readonly waiters: ((entry: QueueEntry) => void)[] = [];
  private closed = false;

  push(entry: QueueEntry): void {
    if (this.closed) return;
    if (entry.kind === "done" || entry.kind === "error") this.closed = true;
    const waiter = this.waiters.shift();
    if (waiter) waiter(entry);
    else this.entries.push(entry);
  }

  pull(): Promise<QueueEntry> {
    const ready = this.entries.shift();
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

export type OpenNdjsonOptions = {
  url: string;
  body: unknown;
  headers?: Record<string, string>;
};

export function openNdjsonStream(opts: OpenNdjsonOptions): MeditationStreamHandle {
  const queue = new AsyncQueue();
  const xhr = new XMLHttpRequest();
  let cursor = 0;
  let buffer = "";

  const drain = (chunk: string): void => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) parseAndPush(line);
      nl = buffer.indexOf("\n");
    }
  };

  const parseAndPush = (line: string): void => {
    let parsed: StreamEvent;
    try {
      parsed = JSON.parse(line) as StreamEvent;
    } catch (err) {
      queue.push({
        kind: "error",
        error: new Error(`ndjson parse failure: ${(err as Error).message} (line=${line})`),
      });
      return;
    }
    if (parsed.event === "error") {
      queue.push({
        kind: "error",
        error: new Error(`stream ${parsed.error}: ${JSON.stringify(parsed.details ?? {})}`),
      });
      return;
    }
    queue.push({ kind: "event", value: parsed });
  };

  xhr.open("POST", opts.url, true);
  xhr.setRequestHeader("content-type", "application/json");
  xhr.setRequestHeader("accept", "application/x-ndjson");
  for (const [key, val] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(key, val);

  xhr.onprogress = () => {
    const next = xhr.responseText.slice(cursor);
    cursor = xhr.responseText.length;
    drain(next);
  };

  xhr.onerror = () => {
    queue.push({ kind: "error", error: new Error("network error during NDJSON stream") });
  };

  xhr.ontimeout = () => {
    queue.push({ kind: "error", error: new Error("timeout during NDJSON stream") });
  };

  xhr.onloadend = () => {
    if (xhr.status >= 400) {
      let errBody: { error?: string; details?: Record<string, unknown> } = {};
      try {
        errBody = JSON.parse(xhr.responseText || "{}");
      } catch {
        /* swallow */
      }
      queue.push({
        kind: "error",
        error: new ApiError(xhr.status, errBody.error ?? "unknown", errBody.details ?? {}),
      });
      return;
    }
    // Flush trailing content past the last newline.
    const next = xhr.responseText.slice(cursor);
    cursor = xhr.responseText.length;
    if (next) drain(next);
    const tail = buffer.trim();
    if (tail) parseAndPush(tail);
    queue.push({ kind: "done" });
  };

  xhr.send(JSON.stringify(opts.body));

  const events: AsyncIterable<StreamEvent> = {
    async *[Symbol.asyncIterator]() {
      while (true) {
        const entry = await queue.pull();
        if (entry.kind === "done") return;
        if (entry.kind === "error") throw entry.error;
        yield entry.value;
      }
    },
  };

  return {
    events,
    cancel: () => {
      try {
        xhr.abort();
      } catch {
        /* already closed */
      }
      queue.push({ kind: "done" });
    },
  };
}
