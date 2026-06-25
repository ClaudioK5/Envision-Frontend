import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { isEnvisionPro } from "../../subscription/envisionBillingUtils";
import { PaymentSuccessModal } from "./PaymentSuccessModal";

const POLL_MS = 1500;
const MAX_POLLS = 24;

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

    params.delete("payment");
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

    const poll = async () => {
      for (let attempt = 0; attempt < MAX_POLLS && !cancelled; attempt += 1) {
        const session = await refreshUserProfile({ force: true });
        if (isEnvisionPro(session?.user?.envision ?? null)) {
          setSyncing(false);
          return;
        }
        if (attempt < MAX_POLLS - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, POLL_MS));
        }
      }
      if (!cancelled) setSyncing(false);
    };

    void poll();

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
