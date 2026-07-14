import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { clearToken, onSessionConflict } from '@/src/api/client';

/**
 * Update 6 — subscribes to the SESSION_CONFLICT channel emitted by the axios
 * interceptor in client.ts. The root layout renders the full-screen modal off
 * this hook's state; acknowledge() clears secure storage (already cleared by
 * the interceptor, repeated here defensively) and routes to Login.
 */
export function useSession() {
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    const unsubscribe = onSessionConflict(() => setConflict(true));
    return unsubscribe;
  }, []);

  const acknowledgeConflict = async () => {
    await clearToken();
    setConflict(false);
    router.replace('/(auth)/login');
  };

  return { sessionConflict: conflict, acknowledgeConflict };
}

export default useSession;
