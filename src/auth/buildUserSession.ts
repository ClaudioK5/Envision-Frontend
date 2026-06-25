import { googleProfileFromIdToken } from "./googleProfile";
import type { PulseAuthUser, UserSession, UserSubscription } from "./types";

function subscriptionFromBackend(user: PulseAuthUser): UserSubscription {
  return {
    plan: user.plan ?? null,
    subscription_status: user.subscription_status ?? null,
    trial_started_at: user.trial_started_at ?? null,
    trial_ends_at: user.trial_ends_at ?? null,
  };
}

/** Build persisted session after successful `POST /auth/google` (matches mobile). */
export function buildUserSession(
  idToken: string,
  pulseToken: string,
  backendUser: PulseAuthUser,
): UserSession {
  const googleProfile = googleProfileFromIdToken(idToken);
  return {
    idToken,
    pulseToken,
    user: {
      id: String(backendUser.id),
      email: backendUser.email ?? googleProfile.email,
      name: backendUser.name ?? googleProfile.name,
      picture: googleProfile.picture,
      subscription: subscriptionFromBackend(backendUser),
      envision: backendUser.envision,
    },
  };
}
