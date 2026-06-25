import { getPulseApiBaseUrl } from "./apiConfig";
import type { PulseAuthUser } from "./types";
import { parseEnvisionSubscription } from "../subscription/envisionBillingUtils";

export class PulseAuthError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "PulseAuthError";
    this.status = status;
  }
}

function isLikelyCorsError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed")
  );
}

/**
 * Exchange Google ID token for Pulse JWT — same contract as mobile
 * `AuthProvider.registerPulseAccount()`.
 */
export async function registerPulseAccount(credential: {
  idToken?: string;
  accessToken?: string;
}): Promise<{ pulseToken: string; backendUser: PulseAuthUser }> {
  const base = getPulseApiBaseUrl();
  const payload: Record<string, string> = {};
  if (credential.idToken) {
    payload.id_token = credential.idToken;
  } else if (credential.accessToken) {
    payload.access_token = credential.accessToken;
  } else {
    throw new PulseAuthError("No Google credential to send");
  }

  const url = `${base}/auth/google`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new PulseAuthError(
        "Pulse server did not respond in time. Check network and PythonAnywhere.",
      );
    }
    if (isLikelyCorsError(e)) {
      throw new PulseAuthError(
        "Browser blocked the request (CORS). On PythonAnywhere, allow Origin http://localhost:5174 and POST /auth/google with Content-Type application/json.",
      );
    }
    throw new PulseAuthError(
      e instanceof Error ? e.message : "Network error calling Pulse API",
    );
  }
  clearTimeout(timeout);

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
    token?: string;
    user?: PulseAuthUser & Record<string, unknown>;
  };

  if (!res.ok) {
    const msg = data.detail ?? data.error ?? `HTTP ${res.status}`;
    if (import.meta.env.DEV) {
      console.error("[Pulse] POST /auth/google failed", res.status, data);
    }
    throw new PulseAuthError(msg, res.status);
  }

  if (!data.token || data.user?.id == null) {
    if (import.meta.env.DEV) {
      console.error("[Pulse] POST /auth/google invalid body", res.status, data);
    }
    throw new PulseAuthError("Invalid response from Pulse API", res.status);
  }

  const backendUser: PulseAuthUser = {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    plan: typeof data.user.plan === "string" ? data.user.plan : null,
    subscription_status:
      typeof data.user.subscription_status === "string"
        ? data.user.subscription_status
        : null,
    trial_started_at:
      typeof data.user.trial_started_at === "string"
        ? data.user.trial_started_at
        : null,
    trial_ends_at:
      typeof data.user.trial_ends_at === "string" ? data.user.trial_ends_at : null,
    envision:
      data.user.envision && typeof data.user.envision === "object"
        ? parseEnvisionSubscription(data.user.envision as Record<string, unknown>)
        : undefined,
  };

  if (import.meta.env.DEV) {
    console.log("[Pulse] POST /auth/google OK", {
      userId: backendUser.id,
      email: backendUser.email,
      plan: backendUser.plan,
      subscription_status: backendUser.subscription_status,
      trial_ends_at: backendUser.trial_ends_at,
    });
  }

  return { pulseToken: data.token, backendUser };
}
