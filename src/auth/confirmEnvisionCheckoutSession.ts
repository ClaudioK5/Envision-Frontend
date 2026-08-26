import { getPulseApiBaseUrl } from "./apiConfig";
import type { EnvisionSubscription } from "./types";
import { parseEnvisionSubscription } from "../subscription/envisionBillingUtils";

export class ConfirmCheckoutError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ConfirmCheckoutError";
    this.status = status;
  }
}

export type ConfirmCheckoutResult = {
  ok: boolean;
  envision: EnvisionSubscription;
};

/**
 * POST /envision/confirm-checkout — activate Pro from Stripe session_id
 * without waiting for the webhook.
 */
export async function confirmEnvisionCheckoutSession(
  pulseToken: string,
  sessionId: string,
): Promise<ConfirmCheckoutResult> {
  const token = pulseToken.trim();
  const id = sessionId.trim();
  if (!token) {
    throw new ConfirmCheckoutError("Not signed in");
  }
  if (!id.startsWith("cs_")) {
    throw new ConfirmCheckoutError("Missing checkout session id");
  }

  const base = getPulseApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${base}/envision/confirm-checkout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: id }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new ConfirmCheckoutError("Request timed out. Please try again.");
    }
    throw new ConfirmCheckoutError(
      e instanceof Error ? e.message : "Could not reach the server",
    );
  }
  clearTimeout(timeout);

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      (typeof data.error === "string" && data.error) ||
      (typeof data.message === "string" && data.message) ||
      `Could not confirm payment (${res.status})`;
    throw new ConfirmCheckoutError(msg, res.status);
  }

  return {
    ok: data.ok !== false,
    envision: parseEnvisionSubscription(data),
  };
}
