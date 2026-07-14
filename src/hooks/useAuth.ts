import { useCallback, useEffect, useState } from 'react';

import * as authApi from '@/src/api/auth';
import {
  clearToken,
  getToken,
  isActiveSessionError,
  isNetworkError,
  setSessionToken,
  setToken,
} from '@/src/api/client';
import { currentUser } from '@/src/constants/sampleData';
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

async function persistSession(token: string, sessionToken: string | undefined) {
  await setToken(token);
  // Older backend builds may omit sessionToken; fall back to the JWT so the
  // X-Session-Token header is still present for the conflict check.
  await setSessionToken(sessionToken ?? token);
}

async function bootstrap() {
  const token = await getToken();
  if (!token) {
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    return;
  }
  try {
    const user = await authApi.getMe();
    setAuthState({ user, isAuthenticated: true, isLoading: false });
  } catch (error) {
    // DEMO FALLBACK: no backend is deployed yet for this build. A stored
    // token with an unreachable API shouldn't strand the user on Splash, so
    // fall back to the bundled sample profile. Remove this branch once
    // auth/me is backed by a real server.
    if (isNetworkError(error)) {
      setAuthState({ user: currentUser, isAuthenticated: true, isLoading: false });
    } else {
      await clearToken();
      setAuthState({ user: null, isAuthenticated: false, isLoading: false });
    }
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

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { token, sessionToken, user } = await authApi.login({ email, password });
      await persistSession(token, sessionToken);
      setAuthState({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // 423 ACTIVE_SESSION_EXISTS is the Login screen's decision to make
      // (force-logout modal) — never swallow it with the demo fallback.
      if (isActiveSessionError(error)) throw error;
      if (isNetworkError(error)) {
        // DEMO FALLBACK: allow exploring the app while no backend exists.
        await persistSession('demo-token', 'demo-session');
        setAuthState({ user: currentUser, isAuthenticated: true, isLoading: false });
        return;
      }
      throw error;
    }
  }, []);

  /** Update 6 — invalidates the other device's session then retries login. */
  const forceLoginHere = useCallback(async (email: string, password: string) => {
    try {
      await authApi.forceLogout({ email, password });
    } catch (error) {
      if (!isNetworkError(error)) throw error; // DEMO FALLBACK: proceed offline
    }
    const { token, sessionToken, user } = await authApi
      .login({ email, password })
      .catch(async (error) => {
        if (isNetworkError(error)) {
          return { token: 'demo-token', sessionToken: 'demo-session', user: currentUser };
        }
        throw error;
      });
    await persistSession(token, sessionToken);
    setAuthState({ user, isAuthenticated: true, isLoading: false });
  }, []);

  const register = useCallback(
    async (
      basicDetails: authApi.RegisterBasicDetails,
      identity: authApi.RegisterIdentityPayload,
    ) => {
      try {
        const { token, sessionToken, user } = await authApi.register(basicDetails, identity);
        await persistSession(token, sessionToken);
        setAuthState({ user, isAuthenticated: true, isLoading: false });
      } catch (error) {
        if (isNetworkError(error)) {
          await persistSession('demo-token', 'demo-session');
          setAuthState({
            user: {
              ...currentUser,
              ...basicDetails,
              id: 'u1',
              idVerified: false,
              idSubmitted: true, // documents were captured + uploaded this session
              tcAcceptedAt: new Date().toISOString(),
            },
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    // Best-effort server-side session invalidation; local clear always runs.
    await authApi.logoutSession().catch(() => undefined);
    await clearToken();
    setAuthState({ user: null, isAuthenticated: false, isLoading: false });
  }, []);

  return { ...state, login, forceLoginHere, register, logout };
}
