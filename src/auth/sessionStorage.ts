import { PULSE_SESSION_ASYNC_KEY } from "./sessionConstants";
import type { UserSession } from "./types";

let memorySession: string | null = null;

export function readSessionRaw(): string | null {
  try {
    const stored = localStorage.getItem(PULSE_SESSION_ASYNC_KEY);
    if (stored) return stored;
  } catch {
    /* noop */
  }
  return memorySession;
}

export function readPersistedUserSession(): UserSession | null {
  const raw = readSessionRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function writeSessionRaw(value: string): void {
  memorySession = value;
  try {
    localStorage.setItem(PULSE_SESSION_ASYNC_KEY, value);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[Pulse] localStorage session write failed", e);
    }
  }
}

export function clearSessionRaw(): void {
  memorySession = null;
  try {
    localStorage.removeItem(PULSE_SESSION_ASYNC_KEY);
  } catch {
    /* noop */
  }
}
