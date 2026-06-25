import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthProvider";

type AccountMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  onOpenAccount: () => void;
};

export function AccountMenu({
  open,
  onClose,
  anchorRef,
  onOpenAccount,
}: AccountMenuProps) {
  const { signOut, requireAuth, isAuthenticated } = useAuth();
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
      onOpenAccount();
      return;
    }
    void requireAuth(
      () => {
        onOpenAccount();
      },
      {
        modalTitle: "Sign in to view your account",
        modalSubtitle: "Connect with Google to see your profile details.",
      },
    );
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  return (
    <div ref={menuRef} className="account-menu" role="menu">
      <button
        type="button"
        className="account-menu__item"
        role="menuitem"
        onClick={goAccount}
      >
        Account
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
