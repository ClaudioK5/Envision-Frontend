import { getPulseApiBaseUrl } from "./apiConfig";

export class CheckoutSessionError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "CheckoutSessionError";
    this.status = status;
  }
}

/** POST /envision/create-checkout-session → Stripe Checkout URL. */
export async function createEnvisionCheckoutSession(pulseToken: string): Promise<string> {
  const token = pulseToken.trim();
  if (!token) {
    throw new CheckoutSessionError("Not signed in");
  }

  const base = getPulseApiBaseUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${base}/envision/create-checkout-session`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new CheckoutSessionError("Request timed out. Please try again.");
    }
    throw new CheckoutSessionError(
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
      `Checkout could not be started (${res.status})`;
    throw new CheckoutSessionError(msg, res.status);
  }

  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url || !url.startsWith("https://")) {
    throw new CheckoutSessionError("Invalid checkout URL from server");
  }

  return url;
}
