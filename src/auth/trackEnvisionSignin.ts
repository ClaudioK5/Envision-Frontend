import { pulseAuthorizedFetch } from "./pulseClient";

/**
 * Tell Pulse this user opened Envision.
 * First visit only → admin signup email (server-side).
 * Failures are ignored so sign-in never breaks.
 */
export async function trackEnvisionSignin(): Promise<void> {
  try {
    await pulseAuthorizedFetch("/envision/track-signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn("[Envision] track-signin failed", e);
    }
  }
}
