import type { EnvisionSubscription } from "../auth/types";

export const ENVISION_FREE_LIMIT = 3;
export const ENVISION_PRO_PRICE_LABEL = "$2.99/month";

export type EnvisionBillingState = {
  analysesUsed: number;
  freeLimit: number;
  remainingFree: number;
  isPro: boolean;
  upgradeRequired: boolean;
  showFreeBanner: boolean;
};

function pickInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return fallback;
}

export function parseEnvisionSubscription(
  raw: Record<string, unknown> | EnvisionSubscription | null | undefined,
): EnvisionSubscription {
  if (!raw || typeof raw !== "object") return {};
  return {
    plan: typeof raw.plan === "string" ? raw.plan : null,
    subscription_status:
      typeof raw.subscription_status === "string" ? raw.subscription_status : null,
    analyses_used: pickInt(raw.analyses_used, 0),
    free_limit: pickInt(raw.free_limit, ENVISION_FREE_LIMIT),
    remaining_free:
      raw.remaining_free == null ? null : pickInt(raw.remaining_free, 0),
    is_pro: raw.is_pro === true,
    upgrade_required: raw.upgrade_required === true,
    price_usd:
      typeof raw.price_usd === "number"
        ? raw.price_usd
        : typeof (raw as Record<string, unknown>).price_eur === "number"
          ? ((raw as Record<string, unknown>).price_eur as number)
          : 2.99,
  };
}

export function resolveEnvisionBilling(
  envision: EnvisionSubscription | null | undefined,
): EnvisionBillingState {
  const sub = parseEnvisionSubscription(envision);
  const freeLimit = sub.free_limit ?? ENVISION_FREE_LIMIT;
  const analysesUsed = sub.analyses_used ?? 0;
  const isPro =
    sub.is_pro === true ||
    (sub.subscription_status || "").toLowerCase() === "active" ||
    (sub.plan || "").toLowerCase() === "pro";
  const remainingFree = isPro ? freeLimit : Math.max(0, freeLimit - analysesUsed);
  const upgradeRequired = !isPro && analysesUsed >= freeLimit;
  const showFreeBanner = !isPro && !upgradeRequired && analysesUsed < freeLimit;

  return {
    analysesUsed,
    freeLimit,
    remainingFree,
    isPro,
    upgradeRequired,
    showFreeBanner,
  };
}

export function isEnvisionPro(
  envision: EnvisionSubscription | null | undefined,
): boolean {
  return resolveEnvisionBilling(envision).isPro;
}
