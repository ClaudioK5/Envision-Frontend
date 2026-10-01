import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useEnvisionBilling } from "../subscription/useEnvisionBilling";

const PRICING_URL = "https://visorixs.tech/pricing";

export function AccountPage() {
  const { session, isAuthenticated } = useAuth();
  const billing = useEnvisionBilling();
  const user = session?.user;

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  const freeUsageLabel = `${billing.remainingFree} of ${billing.freeLimit} free analyses left`;

  return (
    <section className="account-page">
      <div className="content-card account-page__card">
        <div className="account-page__header">
          <Link to="/" className="account-page__back">
            ← Back to analyze
          </Link>
          <h1 className="account-page__title">Your account</h1>
          <p className="account-page__subtitle">
            {isAuthenticated ? "Signed in with Google" : "Sign in to manage your plan"}
          </p>
        </div>

        {isAuthenticated && user ? (
          <>
            <div className="account-card">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt=""
                  className="account-card__avatar"
                  width={72}
                  height={72}
                />
              ) : (
                <div className="account-card__avatar account-card__avatar--placeholder">
                  {initial}
                </div>
              )}
              <dl className="account-fields">
                <div className="account-field">
                  <dt>Name</dt>
                  <dd>{user.name ?? "—"}</dd>
                </div>
                <div className="account-field">
                  <dt>Email</dt>
                  <dd>{user.email ?? "—"}</dd>
                </div>
                {user.id ? (
                  <div className="account-field">
                    <dt>User ID</dt>
                    <dd>{user.id}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="account-plan">
              <p className="account-plan__eyebrow">Plan</p>
              {billing.isPro ? (
                <>
                  <p className="account-plan__title">Pro</p>
                  <p className="account-plan__meta">Active</p>
                </>
              ) : (
                <>
                  <p className="account-plan__title">Free</p>
                  <p className="account-plan__meta">{freeUsageLabel}</p>
                </>
              )}
              <a
                className="account-plan__link"
                href={PRICING_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                View plans
              </a>
            </div>
          </>
        ) : (
          <div className="account-plan">
            <p className="account-plan__title">Sign in required</p>
            <p className="account-plan__meta">
              Connect with Google from the profile menu to view your plan.
            </p>
            <a
              className="account-plan__link"
              href={PRICING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              View plans
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
