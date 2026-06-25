import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

type AccountModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AccountModal({ visible, onClose }: AccountModalProps) {
  const { session } = useAuth();
  const [mounted, setMounted] = useState(false);
  const user = session?.user;

  useEffect(() => {
    if (!visible) {
      setMounted(false);
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();

  return (
    <div
      className={`account-modal-backdrop ${mounted ? "account-modal-backdrop--open" : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`account-modal-sheet ${mounted ? "account-modal-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="account-modal-title" className="account-modal-title">
          Your account
        </h2>
        <p className="account-modal-subtitle">Signed in with Google</p>

        <div className="account-card">
          {user?.picture ? (
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
              <dd>{user?.name ?? "—"}</dd>
            </div>
            <div className="account-field">
              <dt>Email</dt>
              <dd>{user?.email ?? "—"}</dd>
            </div>
            {user?.id ? (
              <div className="account-field">
                <dt>User ID</dt>
                <dd>{user.id}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <button type="button" className="btn btn--secondary account-modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
