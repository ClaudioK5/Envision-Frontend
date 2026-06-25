import { useEffect } from "react";
import { ENVISION_FREE_LIMIT, ENVISION_PRO_PRICE_LABEL } from "../../subscription/envisionBillingUtils";
import { EnvisionLogo } from "../EnvisionLogo";
import { UpgradeEnvisionButton } from "./UpgradeEnvisionButton";
type Props = {
  open: boolean;
  onClose: () => void;
};

export function UpgradeEnvisionModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="trial-expired-backdrop" role="presentation" onClick={onClose}>
      <div
        className="trial-expired-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="envision-upgrade-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trial-expired-modal__glow" aria-hidden />
        <EnvisionLogo className="trial-expired-modal__logo" size={64} />
        <h2 id="envision-upgrade-title" className="trial-expired-modal__title">          You&apos;ve used your {ENVISION_FREE_LIMIT} free analyses
        </h2>
        <p className="trial-expired-modal__body">
          Upgrade to Envision Pro to keep analyzing videos with large-file cloud upload.
        </p>
        <div className="trial-expired-modal__pricing">
          <p>{ENVISION_PRO_PRICE_LABEL}</p>
          <p className="trial-expired-modal__cancel">Cancel anytime</p>
        </div>
        <UpgradeEnvisionButton variant="primary" className="trial-expired-modal__cta" />
        <button type="button" className="btn btn--secondary upgrade-modal__close" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
