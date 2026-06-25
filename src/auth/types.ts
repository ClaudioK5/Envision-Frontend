/**
 * Session persisted in localStorage after Google sign-in + `POST /auth/google`.
 * `pulseToken` is the Pulse API JWT (~7d); use for `Authorization: Bearer`.
 */
export type EnvisionSubscription = {
  plan?: string | null;
  subscription_status?: string | null;
  analyses_used?: number;
  free_limit?: number;
  remaining_free?: number | null;
  is_pro?: boolean;
  upgrade_required?: boolean;
  price_usd?: number;
};

export type UserSubscription = {
  plan?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
};

export type AuthUser = {
  id?: string;
  name?: string;
  email?: string;
  picture?: string;
  subscription?: UserSubscription;
  envision?: EnvisionSubscription;
};

export type PulseAuthUser = {
  id: number;
  email: string;
  name?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  envision?: EnvisionSubscription;
};

export type UserSession = {
  /** Google OAuth access token (native Sign-In; optional on web). */
  accessToken?: string;
  /** Pulse API JWT: payload includes `sub` = user id, `exp` ~7 days. */
  pulseToken?: string;
  /** Google ID token (JWT); optional after sign-in. */
  idToken?: string;
  user?: AuthUser;
};
