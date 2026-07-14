import { useCallback, useEffect, useState } from 'react';

import { isNetworkError } from '@/src/api/client';
import { fetchGroups } from '@/src/api/groups';
import { groups as sampleGroups } from '@/src/constants/sampleData';
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

async function load(): Promise<void> {
  if (inFlight) return inFlight;
  setState({ error: null });
  inFlight = (async () => {
    try {
      const data = await fetchGroups();
      setState({ groups: data, isLoading: false });
    } catch (err) {
      if (isNetworkError(err)) {
        // No backend yet — serve bundled sample data so the UI is fully
        // browsable. Real network/server errors still surface to the user.
        setState({ groups: sampleGroups, isLoading: false });
      } else {
        setState({ error: 'Could not load your groups. Pull to refresh to try again.', isLoading: false });
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

let bootstrapped = false;

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
