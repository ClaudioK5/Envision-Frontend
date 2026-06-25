import { getPulseApiBaseUrl } from "./apiConfig";
import { readPersistedUserSession } from "./sessionStorage";

/** Read persisted session (same blob as AuthProvider). */
export function readStoredPulseSession() {
  return readPersistedUserSession();
}

/** Pulse API JWT for `Authorization: Bearer` (null if signed out). */
export function getPulseJwt(): string | null {
  const session = readPersistedUserSession();
  return session?.pulseToken?.trim() || null;
}

/**
 * `fetch` against Pulse API with `Authorization: Bearer <pulseToken>` when available.
 * Path should start with `/` (e.g. `/agents`).
 */
export async function pulseAuthorizedFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getPulseApiBaseUrl();
  const url = path.startsWith("http")
    ? path
    : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const token = getPulseJwt();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Accept", "application/json");
  return fetch(url, { ...init, headers });
}
