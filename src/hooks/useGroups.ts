import { useCallback, useEffect, useState } from 'react';

import { fetchGroupDetail, fetchGroups } from '@/src/api/groups';
import type { Group } from '@/src/types';

interface GroupsState {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
}

// Same shared-module-state pattern as useAuth: one fetch, many subscribers.
// Avoids every screen that mounts useGroups() firing its own request against
// the (currently unreachable) backend.
let state: GroupsState = { groups: [], isLoading: true, error: null };
const listeners = new Set<(state: GroupsState) => void>();
let inFlight: Promise<void> | null = null;

function setState(next: Partial<GroupsState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener(state));
}

// `silent` refetches without flipping isLoading. The list screen's
// RefreshControl is driven by isLoading, so a background reconcile would
// otherwise yank a spinner down every time the tab regains focus.
async function load(silent = false): Promise<void> {
  if (inFlight) return inFlight;
  if (!silent) setState({ isLoading: true, error: null });
  inFlight = (async () => {
    try {
      const data = await fetchGroups();
      // Always show exactly what the API returned. An empty array is a valid
      // answer for a new user — the screen's empty state handles it.
      setState({ groups: data, isLoading: false, error: null });
    } catch {
      // Never fall back to sample data: showing a real user fake groups is
      // worse than an honest error they can retry.
      //
      // A failed SILENT refresh keeps whatever is on screen. Blanking a list
      // the user is already looking at because a background reconcile hit a
      // dropped connection would read as "my groups are gone".
      if (silent) {
        setState({ isLoading: false });
      } else {
        setState({
          groups: [],
          error: 'Could not load your groups. Please check your connection.',
          isLoading: false,
        });
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let bootstrapped = false;

// Callable from outside React — used by the create and join flows, which
// navigate away the instant they succeed and so have no component left to
// trigger a refetch from. Without this the new group did not appear on the
// Groups tab until the user pulled to refresh, which made a successful
// creation look like it had failed.
export function refreshGroups(options: { silent?: boolean } = {}): Promise<void> {
  return load(options.silent ?? false);
}

interface UseGroupsResult {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGroups(): UseGroupsResult {
  const [local, setLocal] = useState<GroupsState>(state);

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

  return { ...local, refresh };
}

export function useGroup(groupId: string | undefined): Group | undefined {
  const { groups } = useGroups();
  return groups.find((g) => g.id === groupId);
}

interface UseGroupDetailResult {
  group: Group | undefined;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Fetches the *detail* endpoint for one group — the only payload that carries
// per-member contribution status, rotation order, history, and pending
// requests. Seeds from the shared list group (real API data, never sample) so
// the screen paints instantly, then swaps in the richer detail. If the detail
// call fails we surface an error; the seed is still real data, not a demo.
export function useGroupDetail(groupId: string | undefined): UseGroupDetailResult {
  const listGroup = useGroup(groupId);
  const [detail, setDetail] = useState<Group | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    let active = true;
    setIsLoading(true);
    setError(null);
    fetchGroupDetail(groupId)
      .then((g) => {
        if (active) setDetail(g);
      })
      .catch(() => {
        if (active) setError('Could not load this group. Please check your connection.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => load(), [load]);

  return { group: detail ?? listGroup, isLoading: isLoading && !detail, error, refresh: load };
}
