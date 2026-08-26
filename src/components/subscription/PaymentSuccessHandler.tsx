import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import {
  confirmEnvisionCheckoutSession,
  ConfirmCheckoutError,
} from "../../auth/confirmEnvisionCheckoutSession";
import { getPulseJwt } from "../../auth/pulseClient";
import { isEnvisionPro } from "../../subscription/envisionBillingUtils";
import { PaymentSuccessModal } from "./PaymentSuccessModal";

/** Fallback if session_id is missing or confirm fails (old webhook race). */
const POLL_MS = 800;
const MAX_POLLS = 15;

export function PaymentSuccessHandler() {
  const navigate = useNavigate();
  const { refreshUserProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(true);
  const flowStartedRef = useRef(false);

  useEffect(() => {
    if (flowStartedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "success") return;
    flowStartedRef.current = true;

    const checkoutSessionId = (params.get("session_id") || "").trim();
    params.delete("payment");
    params.delete("session_id");
    const qs = params.toString();
    navigate(
      {
        pathname: window.location.pathname,
        search: qs ? `?${qs}` : "",
      },
      { replace: true },
    );

    setOpen(true);
    setSyncing(true);

    let cancelled = false;

    const pollUntilPro = async () => {
      for (let attempt = 0; attempt < MAX_POLLS && !cancelled; attempt += 1) {
        const session = await refreshUserProfile({ force: true });
        if (isEnvisionPro(session?.user?.envision ?? null)) {
          return true;
        }
        if (attempt < MAX_POLLS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
        }
      }
      return false;
    };

    const activate = async () => {
      try {
        if (checkoutSessionId.startsWith("cs_")) {
          const token = getPulseJwt();
          if (token) {
            try {
              const result = await confirmEnvisionCheckoutSession(
                token,
                checkoutSessionId,
              );
              if (isEnvisionPro(result.envision)) {
                await refreshUserProfile({ force: true });
                return;
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn(
                  "[Envision] confirm-checkout failed; falling back to poll",
                  e instanceof ConfirmCheckoutError ? e.message : e,
                );
              }
            }
          }
        }

        await pollUntilPro();
      } finally {
        if (!cancelled) setSyncing(false);
      }
    };

    void activate();

    return () => {
      cancelled = true;
    };
  }, [navigate, refreshUserProfile]);

  if (!open) return null;

  return (
    <PaymentSuccessModal
      open={open}
      syncing={syncing}
      onContinue={() => setOpen(false)}
    />
  );
}
