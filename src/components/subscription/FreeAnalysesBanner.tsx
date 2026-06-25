import { useEnvisionBilling } from "../../subscription/useEnvisionBilling";
import { ENVISION_PRO_PRICE_LABEL } from "../../subscription/envisionBillingUtils";
import { UpgradeEnvisionButton } from "./UpgradeEnvisionButton";

export function FreeAnalysesBanner() {
  const billing = useEnvisionBilling();

  if (!billing.showFreeBanner) return null;

  const usedLabel =
    billing.remainingFree === 1
      ? "1 free analysis left"
      : `${billing.remainingFree} of ${billing.freeLimit} free analyses left`;

  return (
    <aside className="trial-banner" role="status" aria-live="polite">
      <div className="trial-banner__inner">
        <p className="trial-banner__text">
          <span className="trial-banner__spark" aria-hidden>
            ✨
          </span>
          {usedLabel} · then {ENVISION_PRO_PRICE_LABEL}
        </p>
        <UpgradeEnvisionButton variant="banner" label="Go Pro" />
      </div>
    </aside>
  );
}
