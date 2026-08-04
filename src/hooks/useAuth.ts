import { useCallback, useEffect, useState } from 'react';

import * as authApi from '@/src/api/auth';
import { clearToken, getCachedProfilePhoto, getToken, setSessionToken, setToken } from '@/src/api/client';
import * as twoFAApi from '@/src/api/twoFA';
import type { User } from '@/src/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Single in-memory store shared by every useAuth() call so login/logout in one
// screen is instantly reflected everywhere (dashboard, tab bar, etc.) without
// a full context provider — fine at this app's size, revisit if it grows.
let authState: AuthState = { user: null, isLoading: true, isAuthenticated: false };
const listeners = new Set<(state: AuthState) => void>();

function setAuthState(next: Partial<AuthState>) {
  authState = { ...authState, ...next };
  listeners.forEach((listener) => listener(authState));
}

/** Lets non-hook code (profile photo upload) patch the cached user object. */
export function patchAuthUser(patch: Partial<User>) {
  if (authState.user) {
    setAuthState({ user: { ...authState.user, ...patch } });
  }
}

/** Lets non-hook code (e.g. the invite-share helper) read the logged-in user
 *  without subscribing to updates. Null before bootstrap resolves or when
 *  signed out. */
export function getCurrentAuthUser(): User | null {
  return authState.user;
}

async function persistSession(token: string, sessionToken: string | undefined) {
  await setToken(token);
  // Fall back to the JWT if the backend omitted a session token, so the
  // X-Session-Token header is still present for the conflict check.
  await setSessionToken(sessionToken ?? token);
}

// Restores the session on app launch from a stored JWT. Real backend now: if
// the token is invalid/expired the interceptor + this catch sign the user out.
async function bootstrap() {
  const token = await getToken();
  if (!token) {
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    return;
  }
  try {
    const user = await authApi.getMe();
    // If the server row has no photo yet (e.g. update in flight last session),
    // fall back to the locally cached URL so the avatar survives a restart.
    if (!user.profilePhotoUrl) {
      const cached = await getCachedProfilePhoto();
      if (cached) user.profilePhotoUrl = cached;
    }
    setAuthState({ user, isAuthenticated: true, isLoading: false });
  } catch {
    // Unreachable backend or invalid token — return to the login screen rather
    // than trusting a stale token.
    await clearToken();
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }
}

let bootstrapped = false;

export function useAuth() {
  const [state, setState] = useState<AuthState>(authState);

  useEffect(() => {
    listeners.add(setState);
    if (!bootstrapped) {
      bootstrapped = true;
      bootstrap();
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  /** Returns { requires2fa: true, tempToken } when the account has two-step
   *  verification on — no session is persisted in that case, because the
   *  backend hasn't issued one. The caller must route to the PIN screen and
   *  finish via completeTwoFactor(). */
  const login = useCallback(async (email: string, password: string) => {
    // 423 ACTIVE_SESSION_EXISTS propagates so the Login screen can show its
    // force-logout modal; all other errors surface to the caller too.
    const result = await authApi.login({ email, password });
    if (result.requires2fa) return result;
    await persistSession(result.token, result.sessionToken);
    setAuthState({ user: result.user, isAuthenticated: true, isLoading: false });
    return result;
  }, []);

  /** Update 6 — invalidates the other device's session then retries login. */
  const forceLoginHere = useCallback(async (email: string, password: string) => {
    await authApi.forceLogout({ email, password });
    const result = await authApi.login({ email, password });
    if (result.requires2fa) return result;
    await persistSession(result.token, result.sessionToken);
    setAuthState({ user: result.user, isAuthenticated: true, isLoading: false });
    return result;
  }, []);

  /** Second factor: exchanges the PIN + temp token for the real session. */
  const completeTwoFactor = useCallback(async (pin: string, tempToken: string) => {
    const { token, sessionToken, user } = await twoFAApi.verifyTwoFAPin(pin, tempToken);
    await persistSession(token, sessionToken);
    setAuthState({ user, isAuthenticated: true, isLoading: false });
    return user;
  }, []);

  const register = useCallback(
    async (
      basicDetails: authApi.RegisterBasicDetails,
      identity: authApi.RegisterIdentityPayload,
    ) => {
      const { token, sessionToken, user } = await authApi.register(basicDetails, identity);
      await persistSession(token, sessionToken);
      setAuthState({ user, isAuthenticated: true, isLoading: false });
    },
    [],
  );

  const logout = useCallback(async () => {
    // Best-effort server-side session invalidation; local clear always runs.
    await authApi.logoutSession().catch(() => undefined);
    await clearToken();
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, forceLoginHere, completeTwoFactor, register, logout };
}
