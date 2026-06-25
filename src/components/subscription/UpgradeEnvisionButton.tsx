import { useCallback, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import {
  CheckoutSessionError,
  createEnvisionCheckoutSession,
} from "../../auth/createEnvisionCheckoutSession";
import { useToast } from "../../context/ToastContext";

type Props = {
  variant?: "primary" | "banner";
  className?: string;
  label?: string;
};

export function UpgradeEnvisionButton({
  variant = "primary",
  className = "",
  label = "Upgrade to Envision Pro",
}: Props) {
  const { pulseToken, isAuthenticated, requireAuth } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const startCheckout = useCallback(async () => {
    const token = pulseToken?.trim();
    if (!token) {
      showToast("Sign in to upgrade to Pro.", "error");
      return;
    }

    setLoading(true);
    try {
      const url = await createEnvisionCheckoutSession(token);
      window.location.href = url;
    } catch (e) {
      const msg =
        e instanceof CheckoutSessionError
          ? e.message
          : "Could not start checkout. Please try again.";
      showToast(msg, "error");
      setLoading(false);
    }
  }, [pulseToken, showToast]);

  const onClick = () => {
    if (loading) return;
    if (isAuthenticated && pulseToken?.trim()) {
      void startCheckout();
      return;
    }
    void requireAuth(startCheckout, {
      modalTitle: "Sign in to upgrade",
      modalSubtitle: "Connect with Google to subscribe to Envision Pro.",
    });
  };

  return (
    <button
      type="button"
      className={`upgrade-pro-btn upgrade-pro-btn--${variant} ${loading ? "upgrade-pro-btn--loading" : ""} ${className}`.trim()}
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <span className="upgrade-pro-btn__spinner" aria-hidden />
          Opening checkout…
        </>
      ) : (
        label
      )}
    </button>
  );
}
