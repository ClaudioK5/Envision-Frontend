import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useEffect, useRef, useState } from "react";
import { getGoogleWebClientId } from "../auth/apiConfig";
import { GoogleGLogo } from "./GoogleGLogo";

/** GIS `size="large"` button height in px. */
const GIS_LARGE_HEIGHT = 40;
/** Visible Envision button height — must stay in sync with CSS. */
const VISIBLE_BTN_HEIGHT = 48;
/** Google Identity Services max button width. */
const GIS_MAX_WIDTH = 400;
const GIS_MIN_WIDTH = 200;

type AuthRequiredModalProps = {
  visible: boolean;
  onClose: () => void;
  onGoogleCredential: (idToken: string) => void;
  onGoogleError: () => void;
  isLoading?: boolean;
  title?: string;
  subtitle?: string;
};

export function AuthRequiredModal({
  visible,
  onClose,
  onGoogleCredential,
  onGoogleError,
  isLoading = false,
  title,
  subtitle,
}: AuthRequiredModalProps) {
  const [mounted, setMounted] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [googleWidth, setGoogleWidth] = useState(0);
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(VISIBLE_BTN_HEIGHT / GIS_LARGE_HEIGHT);
  const clientId = getGoogleWebClientId();

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
      if (e.key === "Escape" && !isLoading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, isLoading, onClose]);

  useEffect(() => {
    if (!visible || !mounted) return;
    const el = wrapRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w <= 0) return;
      const gisWidth = Math.min(GIS_MAX_WIDTH, Math.max(GIS_MIN_WIDTH, w));
      setGoogleWidth(gisWidth);
      setScaleX(w / gisWidth);
      setScaleY(VISIBLE_BTN_HEIGHT / GIS_LARGE_HEIGHT);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [visible, mounted]);

  if (!visible) return null;

  function handleSuccess(response: CredentialResponse) {
    const credential = response.credential;
    if (!credential) {
      onGoogleError();
      return;
    }
    onGoogleCredential(credential);
  }

  return (
    <div
      className={`auth-modal-backdrop ${mounted ? "auth-modal-backdrop--open" : ""}`}
      role="presentation"
      onClick={() => !isLoading && onClose()}
    >
      <div
        className={`auth-modal-sheet ${mounted ? "auth-modal-sheet--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-modal-handle" aria-hidden />
        <h2 id="auth-modal-title" className="auth-modal-title">
          {title ?? "Sign in to continue"}
        </h2>
        <p className="auth-modal-subtitle">
          {subtitle ??
            "Use your Google account to analyze videos and save your session."}
        </p>

        <div className="auth-modal-action">
          {clientId ? (
            <div ref={wrapRef} className="auth-google-btn-wrap">
              <span className="auth-google-btn-label">
                <GoogleGLogo size={22} />
                {isLoading ? "Connecting…" : "Continue with Google"}
              </span>
              <div
                className={`auth-google-btn-overlay ${isLoading ? "auth-google-btn-overlay--disabled" : ""}`}
                aria-hidden={isLoading}
              >
                {googleWidth > 0 ? (
                  <div
                    className="auth-google-btn-overlay__hit"
                    style={{
                      width: googleWidth,
                      height: GIS_LARGE_HEIGHT,
                      transform: `scaleX(${scaleX}) scaleY(${scaleY})`,
                    }}
                  >
                    <GoogleLogin
                      key={googleWidth}
                      onSuccess={handleSuccess}
                      onError={onGoogleError}
                      useOneTap={false}
                      theme="outline"
                      size="large"
                      text="continue_with"
                      shape="rectangular"
                      width={String(googleWidth)}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="auth-modal-error">
              Google sign-in is not configured. Set VITE_GOOGLE_WEB_CLIENT_ID in
              .env.local.
            </p>
          )}
        </div>

        <p className="auth-modal-helper">No passwords — just your Google account.</p>

        <button
          type="button"
          className="auth-modal-cancel"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
