import { EnvisionLogo } from "../EnvisionLogo";

type Props = {  open: boolean;
  syncing: boolean;
  onContinue: () => void;
};

export function PaymentSuccessModal({ open, syncing, onContinue }: Props) {
  if (!open) return null;

  return (
    <div className="trial-expired-backdrop" role="presentation">
      <div
        className="trial-expired-modal payment-success-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-success-title"
      >
        <div className="trial-expired-modal__glow" aria-hidden />
        <EnvisionLogo className="trial-expired-modal__logo" size={64} />
        <h2 id="payment-success-title" className="trial-expired-modal__title">          Welcome to Envision Pro
        </h2>
        <p className="trial-expired-modal__body">
          {syncing
            ? "Activating your subscription…"
            : "Your subscription is active. Analyze as many videos as you need."}
        </p>
        <button
          type="button"
          className="btn btn--primary trial-expired-modal__cta"
          onClick={onContinue}
          disabled={syncing}
        >
          {syncing ? "Please wait…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
