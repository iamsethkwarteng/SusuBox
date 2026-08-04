import { useCallback, useEffect, useState } from 'react';

import { isNetworkError } from '@/src/api/client';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/src/api/notifications';
import type { AppNotification } from '@/src/types';

interface NotificationsState {
  items: AppNotification[];
  isLoading: boolean;
  /** True when the last load failed (network or server) and we have no data. */
  error: boolean;
  /** True once a load has completed at least once (success or empty). */
  loaded: boolean;
}

// Shared-module-state pattern (same as useAuth / useGroups): one fetch, many
// subscribers. The Home badge, Home recent-activity list, and the Notifications
// tab all read from this single store so marking one read updates everywhere.
let state: NotificationsState = { items: [], isLoading: true, error: false, loaded: false };
const listeners = new Set<(state: NotificationsState) => void>();
let inFlight: Promise<void> | null = null;

function setState(next: Partial<NotificationsState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

async function load(): Promise<void> {
  if (inFlight) return inFlight;
  setState({ isLoading: true, error: false });
  inFlight = (async () => {
    try {
      const fresh = await fetchNotifications();
      // Real data only — a brand new user gets [] and sees the empty state.
      setState({ items: fresh, isLoading: false, error: false, loaded: true });
    } catch {
      // Any failure (offline or server) → empty + error flag. Never fall back
      // to demo data; screens decide whether to show an empty state or retry.
      setState({ items: [], isLoading: false, error: true, loaded: true });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let bootstrapped = false;

export interface UseNotificationsResult {
  items: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: boolean;
  loaded: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [local, setLocal] = useState<NotificationsState>(state);

  useEffect(() => {
    listeners.add(setLocal);
    if (!bootstrapped) {
      bootstrapped = true;
      load();
    }
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  const refresh = useCallback(() => load(), []);

  // Optimistic read: flip local state instantly, sync in the background, and
  // revert if the server rejects (but keep the optimistic value when offline).
  const markRead = useCallback(async (id: string) => {
    const target = state.items.find((n) => n.id === id);
    if (!target || target.read) return;
    setState({ items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)) });
    try {
      await markNotificationRead(id);
    } catch (err) {
      if (!isNetworkError(err)) {
        setState({ items: state.items.map((n) => (n.id === id ? { ...n, read: false } : n)) });
      }
    }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!state.items.some((n) => !n.read)) return;
    const snapshot = state.items;
    setState({ items: state.items.map((n) => ({ ...n, read: true })) });
    try {
      await markAllNotificationsRead();
    } catch (err) {
      if (!isNetworkError(err)) setState({ items: snapshot });
    }
  }, []);

  const unreadCount = local.items.filter((n) => !n.read).length;

  return { ...local, unreadCount, refresh, markRead, markAllRead };
}
