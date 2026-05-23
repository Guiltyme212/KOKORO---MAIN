// Lightweight HTTP wrapper around RN's global `fetch`. Reads the API base
// URL from EXPO_PUBLIC_API_BASE so a release build can target a deployed API
// without code changes; falls back to a localhost default that works against
// `uv run uvicorn kokoro_api.main:app --port 8787`.

const RAW_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_BASE) ||
  "http://localhost:8787";

export const API_BASE = RAW_BASE.replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(status: number, error: string, details: Record<string, unknown>) {
    super(`api ${status}: ${error} ${JSON.stringify(details)}`);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const safeJson = async (res: Response): Promise<Record<string, unknown>> => {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: { accept: "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, String(body.error ?? "unknown"), (body.details as Record<string, unknown>) ?? {});
  }
  return (await res.json()) as T;
}

export async function postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new ApiError(res.status, String(body.error ?? "unknown"), (body.details as Record<string, unknown>) ?? {});
  }
  return (await res.json()) as T;
}

export async function deleteJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const json = await safeJson(res);
    throw new ApiError(res.status, String(json.error ?? "unknown"), (json.details as Record<string, unknown>) ?? {});
  }
  return (await res.json()) as T;
}
