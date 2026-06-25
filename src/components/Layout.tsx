import { useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AccountMenu } from "./AccountMenu";
import { AccountModal } from "./AccountModal";
import { EnvisionLogo } from "./EnvisionLogo";
import { UserIcon } from "./Icons";

export function Layout() {
  const { requireAuth, refreshSession, session, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);

  const openAccountMenu = () => {
    if (isAuthenticated && session?.pulseToken) {
      setMenuOpen(true);
      void refreshSession();
      return;
    }
    void (async () => {
      const loggedIn = await refreshSession();
      if (loggedIn) {
        setMenuOpen(true);
        return;
      }
      await requireAuth(
        () => {
          setMenuOpen(true);
        },
        {
          modalTitle: "Sign in to your account",
          modalSubtitle: "Connect with Google to manage your Envision session.",
        },
      );
    })();
  };

  const initial =
    session?.user?.name?.charAt(0) ??
    session?.user?.email?.charAt(0) ??
    null;

  return (
    <div className="app">
      <div className="navy-background" aria-hidden>
        <div className="navy-background__dark" />
        <div className="navy-background__light" />
      </div>

      <header className="header">
        <div className="logo" aria-label="Envision home">
          <EnvisionLogo className="logo__icon" size={36} />
          <span className="logo__mark">Envision</span>
        </div>

        <div className="header__actions">
          <div className="header__profile-wrap">
            <button
              ref={profileRef}
              type="button"
              className="profile-button"
              onClick={openAccountMenu}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              {session?.user?.picture ? (
                <img
                  src={session.user.picture}
                  alt=""
                  className="profile-button__img"
                  width={32}
                  height={32}
                />
              ) : isAuthenticated && initial ? (
                <span className="profile-button__letter" aria-hidden>
                  {initial}
                </span>
              ) : (
                <UserIcon className="profile-button__icon" />
              )}
            </button>
            <AccountMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              anchorRef={profileRef}
              onOpenAccount={() => setAccountOpen(true)}
            />
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}
