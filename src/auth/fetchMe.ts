import { getPulseApiBaseUrl } from "./apiConfig";
import type { EnvisionSubscription, UserSubscription } from "./types";
import type { UserSession } from "./types";
import { parseEnvisionSubscription } from "../subscription/envisionBillingUtils";

export type MeResponse = {
  email?: string;
  name?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  envision?: EnvisionSubscription;
};

export class MeFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MeFetchError";
    this.status = status;
  }
}

function pickString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function normalizeMePayload(parsed: unknown): MeResponse | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const src =
    root.user && typeof root.user === "object" && !Array.isArray(root.user)
      ? (root.user as Record<string, unknown>)
      : root;

  const nestedSub =
    src.subscription && typeof src.subscription === "object" && !Array.isArray(src.subscription)
      ? (src.subscription as Record<string, unknown>)
      : root.subscription &&
          typeof root.subscription === "object" &&
          !Array.isArray(root.subscription)
        ? (root.subscription as Record<string, unknown>)
        : null;

  const plan =
    pickString(src, "plan") ??
    pickString(nestedSub ?? {}, "plan") ??
    pickString(root, "plan");

  const subscription_status =
    pickString(src, "subscription_status") ??
    pickString(src, "status") ??
    pickString(nestedSub ?? {}, "subscription_status") ??
    pickString(nestedSub ?? {}, "status") ??
    pickString(root, "subscription_status") ??
    pickString(root, "status");

  const envisionRaw =
    src.envision && typeof src.envision === "object" && !Array.isArray(src.envision)
      ? (src.envision as Record<string, unknown>)
      : root.envision && typeof root.envision === "object" && !Array.isArray(root.envision)
        ? (root.envision as Record<string, unknown>)
        : null;

  return {
    email: pickString(src, "email") ?? undefined,
    name: pickString(src, "name"),
    plan,
    subscription_status,
    trial_started_at:
      pickString(src, "trial_started_at") ?? pickString(nestedSub ?? {}, "trial_started_at"),
    trial_ends_at:
      pickString(src, "trial_ends_at") ?? pickString(nestedSub ?? {}, "trial_ends_at"),
    envision: envisionRaw ? parseEnvisionSubscription(envisionRaw) : undefined,
  };
}

/** GET /me — subscription and profile for the signed-in user. */
export async function fetchMe(pulseToken: string): Promise<MeResponse> {
  const token = pulseToken.trim();
  if (!token) {
    throw new MeFetchError("No Pulse token");
  }

  const base = getPulseApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let res: Response;
  try {
    res = await fetch(`${base}/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new MeFetchError("Request timed out");
    }
    throw new MeFetchError(e instanceof Error ? e.message : "Network error");
  }
  clearTimeout(timeout);

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `HTTP ${res.status}`;
    throw new MeFetchError(msg, res.status);
  }

  const me = normalizeMePayload(data);
  if (!me) {
    throw new MeFetchError("Invalid /me response", res.status);
  }

  if (import.meta.env.DEV) {
    console.log("[Pulse] GET /me OK", {
      plan: me.plan,
      subscription_status: me.subscription_status,
      trial_ends_at: me.trial_ends_at,
      envision: me.envision,
    });
  }

  return me;
}

export function subscriptionFromMe(me: MeResponse): UserSubscription {
  return {
    plan: me.plan ?? null,
    subscription_status: me.subscription_status ?? null,
    trial_started_at: me.trial_started_at ?? null,
    trial_ends_at: me.trial_ends_at ?? null,
  };
}

/** Merge GET /me fields into an existing session (profile + subscription). */
export function applyMeToSession(session: UserSession, me: MeResponse): UserSession {
  return {
    ...session,
    user: {
      ...session.user,
      email: me.email ?? session.user?.email,
      name: me.name ?? session.user?.name,
      subscription: subscriptionFromMe(me),
      envision: me.envision ?? session.user?.envision,
    },
  };
}
