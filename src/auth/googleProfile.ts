import type { AuthUser } from "./types";

/** Decode Google ID token JWT payload (no verification — server verifies). */
export function googleProfileFromIdToken(idToken: string): AuthUser {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return {};
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(json) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch {
    return {};
  }
}
