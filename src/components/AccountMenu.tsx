import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useEnvisionBilling } from "../subscription/useEnvisionBilling";

type AccountMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};

export function AccountMenu({ open, onClose, anchorRef }: AccountMenuProps) {
  const { signOut, requireAuth, isAuthenticated } = useAuth();
  const billing = useEnvisionBilling();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const goAccount = () => {
    onClose();
    if (isAuthenticated) {
      navigate("/account");
      return;
    }
    void requireAuth(
      () => {
        navigate("/account");
      },
      {
        modalTitle: "Sign in to view your account",
        modalSubtitle: "Connect with Google to see your profile and plan.",
      },
    );
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate("/");
  };

  const planHint = !isAuthenticated
    ? null
    : billing.isPro
      ? "Pro"
      : billing.remainingFree === 1
        ? "Free · 1 left"
        : `Free · ${billing.remainingFree} left`;

  return (
    <div ref={menuRef} className="account-menu" role="menu">
      <button
        type="button"
        className="account-menu__item"
        role="menuitem"
        onClick={goAccount}
      >
        <span className="account-menu__item-main">Account</span>
        {planHint ? <span className="account-menu__item-meta">{planHint}</span> : null}
      </button>
      <div className="account-menu__divider" role="separator" />
      <button
        type="button"
        className="account-menu__item account-menu__item--danger"
        role="menuitem"
        onClick={() => void handleSignOut()}
      >
        Sign out
      </button>
    </div>
  );
}
