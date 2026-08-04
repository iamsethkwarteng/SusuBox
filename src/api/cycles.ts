import { apiClient } from '@/src/api/client';
import type { GroupCycle } from '@/src/types';

// Backend cycle row (snake_case) from GET /api/groups/:groupId/cycles.
interface BackendGroupCycle {
  id: string;
  cycle_number: number;
  status: 'open' | 'closed' | 'paid_out';
  expected_total?: number | string;
  collected_total?: number | string;
  contribution_count?: number;
  start_date: string;
  end_date: string;
}

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// GET /api/groups/:groupId/cycles — every cycle for the group (newest first),
// each with the number of contributions recorded against it. Drives the
// group-scoped reports screen.
export async function fetchCycles(groupId: string): Promise<GroupCycle[]> {
  const { data } = await apiClient.get<{ cycles: BackendGroupCycle[] }>(`/groups/${groupId}/cycles`);
  return (data.cycles ?? []).map((c) => ({
    id: c.id,
    cycleNumber: c.cycle_number,
    status: c.status,
    expectedTotal: toNum(c.expected_total),
    collectedTotal: toNum(c.collected_total),
    contributionCount: c.contribution_count ?? 0,
    startDate: c.start_date,
    endDate: c.end_date,
  }));
}

// Cycle lifecycle actions. All are admin-only on the backend (enforced by the
// adminOnly middleware); the UI only surfaces the buttons to organizers.

// POST /api/groups/:groupId/cycles — opens the next cycle.
export async function openCycle(groupId: string): Promise<void> {
  await apiClient.post(`/groups/${groupId}/cycles`);
}

// PATCH /api/groups/:groupId/cycles/:cycleId/close — closes the cycle, applies
// penalties to non-payers, recomputes reliability, and notifies the recipient.
export async function closeCycle(groupId: string, cycleId: string): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/cycles/${cycleId}/close`);
}

// REMOVED: confirmPayout used to PATCH .../cycles/:cycleId/payout, a manual
// "mark as paid" endpoint that never called Paystack. The backend route was
// deleted (it let a cycle be marked paid_out with no money movement). Real
// payouts go through initiateGroupPayout in src/api/payments.ts, which calls
// POST /api/payments/payout (the actual Paystack Transfer API integration).
