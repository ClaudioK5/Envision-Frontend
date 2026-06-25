import { useMemo } from "react";
import { useAuth } from "../auth/AuthProvider";
import { resolveEnvisionBilling, type EnvisionBillingState } from "./envisionBillingUtils";

export function useEnvisionBilling(): EnvisionBillingState {
  const { session, isAuthenticated } = useAuth();

  return useMemo(() => {
    if (!isAuthenticated) {
      return resolveEnvisionBilling(null);
    }
    return resolveEnvisionBilling(session?.user?.envision ?? null);
  }, [isAuthenticated, session?.user?.envision]);
}
