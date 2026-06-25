import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { googleLogout } from "@react-oauth/google";
import { AuthRequiredModal } from "../components/AuthRequiredModal";
import { useToast } from "../context/ToastContext";
import { getGoogleWebClientId, getPulseApiBaseUrl } from "./apiConfig";
import { buildUserSession } from "./buildUserSession";
import { applyMeToSession, fetchMe, MeFetchError } from "./fetchMe";
import type { HydrateOptions } from "./meSyncPolicy";
import {
  clearLastMeSyncedAt,
  readLastMeSyncedAt,
  shouldFetchMe,
  writeLastMeSyncedAt,
} from "./meSyncPolicy";
import { PulseAuthError, registerPulseAccount } from "./registerPulseAccount";
import {
  clearSessionRaw,
  readSessionRaw,
  writeSessionRaw,
} from "./sessionStorage";
import type { UserSession } from "./types";

export type { AuthUser, UserSession, UserSubscription } from "./types";

type RequireAuthOptions = {
  modalTitle?: string;
  modalSubtitle?: string;
};

type RefreshUserProfileOptions = {
  /** Bypass TTL; use after payment or when subscription must be fresh. */
  force?: boolean;
};

type AuthContextValue = {
  session: UserSession | null;
  pulseToken: string | null;
  isAuthenticated: boolean;
  /** Load session from storage; refresh /me in background when still fresh. */
  refreshSession: () => Promise<boolean>;
  /** Re-fetch GET /me and merge into session (subscription + profile). */
  refreshUserProfile: (
    options?: RefreshUserProfileOptions,
  ) => Promise<UserSession | null>;
  requireAuth: (
    onAuthed: () => void | Promise<void>,
    options?: RequireAuthOptions,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseStoredSession(raw: string | null): UserSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed.pulseToken?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [session, setSession] = useState<UserSession | null>(() =>
    parseStoredSession(readSessionRaw()),
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState<string | undefined>();
  const [modalSubtitle, setModalSubtitle] = useState<string | undefined>();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const meSyncPromiseRef = useRef<Promise<UserSession | null> | null>(null);
  const lastMeSyncedAtRef = useRef(readLastMeSyncedAt());

  const markMeSynced = useCallback(() => {
    const at = Date.now();
    lastMeSyncedAtRef.current = at;
    writeLastMeSyncedAt(at);
  }, []);

  const persistSession = useCallback((nextSession: UserSession) => {
    if (!nextSession.pulseToken?.trim()) {
      throw new Error("Cannot persist session without pulseToken");
    }
    setSession(nextSession);
    writeSessionRaw(JSON.stringify(nextSession));
  }, []);

  const syncMeFromApi = useCallback(
    async (baseSession: UserSession): Promise<UserSession | null> => {
      if (meSyncPromiseRef.current) {
        return meSyncPromiseRef.current;
      }

      const token = baseSession.pulseToken?.trim();
      if (!token) return baseSession;

      const promise = (async (): Promise<UserSession | null> => {
        try {
          const me = await fetchMe(token);
          const merged = applyMeToSession(baseSession, me);
          persistSession(merged);
          markMeSynced();
          return merged;
        } catch (e) {
          if (e instanceof MeFetchError && e.status === 401) {
            setSession(null);
            clearSessionRaw();
            lastMeSyncedAtRef.current = 0;
            clearLastMeSyncedAt();
            return null;
          }
          if (import.meta.env.DEV) {
            console.warn("[Pulse] GET /me failed; using cached session", e);
          }
          return baseSession;
        }
      })();

      meSyncPromiseRef.current = promise;
      try {
        return await promise;
      } finally {
        if (meSyncPromiseRef.current === promise) {
          meSyncPromiseRef.current = null;
        }
      }
    },
    [markMeSynced, persistSession],
  );

  const hydrateSessionFromStorage = useCallback(
    async (options?: HydrateOptions): Promise<boolean> => {
      const parsed = parseStoredSession(readSessionRaw());
      if (!parsed) {
        setSession(null);
        return false;
      }

      setSession(parsed);

      const mode = options?.meSync ?? "if-stale";
      if (!shouldFetchMe(mode, lastMeSyncedAtRef.current)) {
        return true;
      }

      if (options?.backgroundMe) {
        void syncMeFromApi(parsed);
        return true;
      }

      const updated = await syncMeFromApi(parsed);
      return updated !== null;
    },
    [syncMeFromApi],
  );

  useEffect(() => {
    lastMeSyncedAtRef.current = readLastMeSyncedAt();
    const parsed = parseStoredSession(readSessionRaw());
    if (parsed) {
      setSession(parsed);
      void hydrateSessionFromStorage({
        meSync: "if-stale",
        backgroundMe: true,
      });
    }
  }, [hydrateSessionFromStorage]);

  useEffect(() => {
    const onFocus = () => {
      void hydrateSessionFromStorage({
        meSync: "if-stale",
        backgroundMe: true,
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [hydrateSessionFromStorage]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    return hydrateSessionFromStorage({
      meSync: "if-stale",
      backgroundMe: true,
    });
  }, [hydrateSessionFromStorage]);

  const refreshUserProfile = useCallback(
    async (
      options?: RefreshUserProfileOptions,
    ): Promise<UserSession | null> => {
      const parsed = parseStoredSession(readSessionRaw());
      if (!parsed) {
        setSession(null);
        return null;
      }

      setSession(parsed);

      const mode = options?.force ? "always" : "if-stale";
      if (!shouldFetchMe(mode, lastMeSyncedAtRef.current)) {
        return parsed;
      }

      return syncMeFromApi(parsed);
    },
    [syncMeFromApi],
  );

  const signOut = useCallback(async () => {
    setSession(null);
    clearSessionRaw();
    lastMeSyncedAtRef.current = 0;
    clearLastMeSyncedAt();
    try {
      googleLogout();
    } catch {
      /* noop */
    }
  }, []);

  const requireAuth = useCallback(
    async (
      onAuthed: () => void | Promise<void>,
      options?: RequireAuthOptions,
    ) => {
      const token =
        session?.pulseToken?.trim() ||
        parseStoredSession(readSessionRaw())?.pulseToken?.trim();

      if (token) {
        if (!session?.pulseToken?.trim()) {
          const parsed = parseStoredSession(readSessionRaw());
          if (parsed) setSession(parsed);
        }
        await Promise.resolve(onAuthed());
        void hydrateSessionFromStorage({
          meSync: "if-stale",
          backgroundMe: true,
        });
        return;
      }

      const ok = await hydrateSessionFromStorage({ meSync: "always" });
      if (ok) {
        await Promise.resolve(onAuthed());
        return;
      }
      pendingActionRef.current = onAuthed;
      setModalTitle(options?.modalTitle);
      setModalSubtitle(options?.modalSubtitle);
      setModalVisible(true);
    },
    [hydrateSessionFromStorage, session?.pulseToken],
  );

  const onGoogleCredential = useCallback(
    async (idToken: string) => {
      if (isSigningIn) return;
      setIsSigningIn(true);

      try {
        const clientId = getGoogleWebClientId();
        if (!clientId) {
          showToast("Google sign-in is not configured.");
          return;
        }

        const apiBase = getPulseApiBaseUrl();
        if (import.meta.env.DEV) {
          console.log("[Pulse] API base:", apiBase);
        }

        let nextSession: UserSession;
        try {
          const { pulseToken, backendUser } = await registerPulseAccount({
            idToken,
          });
          nextSession = buildUserSession(idToken, pulseToken, backendUser);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (e instanceof PulseAuthError && e.status != null) {
            console.error("[Pulse] POST /auth/google", e.status, msg);
          } else {
            console.error("[Pulse] POST /auth/google error", e);
          }
          showToast(`Could not save your account: ${msg}`);
          return;
        }

        persistSession(nextSession);
        await syncMeFromApi(nextSession);
        setModalVisible(false);
        setModalTitle(undefined);
        setModalSubtitle(undefined);

        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        if (pending) {
          await Promise.resolve(pending()).catch((err) =>
            console.error("[Pulse] pending auth action failed", err),
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(message || "Google sign-in failed.");
        console.error(error);
      } finally {
        setIsSigningIn(false);
      }
    },
    [isSigningIn, persistSession, syncMeFromApi, showToast],
  );

  const onGoogleError = useCallback(() => {
    showToast("Google sign-in was cancelled.");
  }, [showToast]);

  const closeModal = useCallback(() => {
    if (isSigningIn) return;
    setModalVisible(false);
    setModalTitle(undefined);
    setModalSubtitle(undefined);
    pendingActionRef.current = null;
  }, [isSigningIn]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      pulseToken: session?.pulseToken ?? null,
      isAuthenticated: Boolean(session?.pulseToken?.trim()),
      refreshSession,
      refreshUserProfile,
      requireAuth,
      signOut,
    }),
    [refreshSession, refreshUserProfile, requireAuth, session, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthRequiredModal
        visible={modalVisible}
        isLoading={isSigningIn}
        title={modalTitle}
        subtitle={modalSubtitle}
        onClose={closeModal}
        onGoogleCredential={onGoogleCredential}
        onGoogleError={onGoogleError}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
