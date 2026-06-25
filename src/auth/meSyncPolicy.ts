/** Skip GET /me when synced within this window (profile, requireAuth, focus). */
export const ME_SYNC_TTL_MS = 90_000;

const LAST_ME_SYNC_STORAGE_KEY = "@pulse/last-me-sync-at";

export function readLastMeSyncedAt(): number {
  try {
    const raw = sessionStorage.getItem(LAST_ME_SYNC_STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeLastMeSyncedAt(ms: number): void {
  try {
    sessionStorage.setItem(LAST_ME_SYNC_STORAGE_KEY, String(ms));
  } catch {
    /* noop */
  }
}

export function clearLastMeSyncedAt(): void {
  try {
    sessionStorage.removeItem(LAST_ME_SYNC_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export type MeSyncMode = "always" | "if-stale" | "never";

export type HydrateOptions = {
  meSync?: MeSyncMode;
  /** Resolve immediately; refresh /me when stale without blocking. */
  backgroundMe?: boolean;
};

export function isMeSyncFresh(lastSyncedAt: number, now = Date.now()): boolean {
  return lastSyncedAt > 0 && now - lastSyncedAt < ME_SYNC_TTL_MS;
}

export function shouldFetchMe(
  mode: MeSyncMode,
  lastSyncedAt: number,
  now = Date.now(),
): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  return !isMeSyncFresh(lastSyncedAt, now);
}
