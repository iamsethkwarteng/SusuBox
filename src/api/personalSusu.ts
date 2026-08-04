import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type {
  PersonalGoal,
  PersonalGoalContribution,
  PersonalGoalFrequency,
  PersonalGoalType,
} from '@/src/types';

// Backend shape (snake_case, GHS decimals as strings from DECIMAL columns).
interface BackendGoal {
  id: string;
  goal_name: string;
  goal_emoji?: string | null;
  goal_type: PersonalGoalType;
  target_amount?: number | string | null;
  target_date?: string | null;
  current_amount: number | string;
  contribution_amount?: number | string | null;
  frequency: PersonalGoalFrequency;
  allow_early_withdrawal: boolean;
  early_withdrawal_penalty_percent: number | string;
  paystack_subaccount_code?: string | null;
  status: 'active' | 'completed' | 'withdrawn_early' | 'cancelled';
  completed_at?: string | null;
  withdrawn_at?: string | null;
  withdrawal_penalty_amount?: number | string | null;
  created_at?: string;
  // Server-computed — kept authoritative so progress maths lives in one place.
  is_unlocked: boolean;
  locked_reasons?: string[];
  progress_percent?: number | null;
  days_remaining?: number | null;
  amount_remaining?: number | null;
  contributions?: BackendContribution[];
}

interface BackendContribution {
  id: string;
  amount: number | string;
  fee_amount?: number | string | null;
  total_charged?: number | string | null;
  payment_method?: 'momo' | 'card' | 'bank' | null;
  payment_date: string;
  note?: string | null;
  created_at?: string;
}

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function mapContribution(b: BackendContribution): PersonalGoalContribution {
  return {
    id: b.id,
    amount: num(b.amount),
    feeAmount: b.fee_amount != null ? num(b.fee_amount) : undefined,
    totalCharged: b.total_charged != null ? num(b.total_charged) : undefined,
    paymentMethod: b.payment_method ?? undefined,
    paymentDate: b.payment_date,
    note: b.note ?? undefined,
    createdAt: b.created_at ?? b.payment_date,
    // No payment_method means the charge was never confirmed — an abandoned
    // checkout. Shown as pending rather than counted as saved.
    pending: !b.payment_method,
  };
}

function mapGoal(b: BackendGoal): PersonalGoal {
  return {
    id: b.id,
    name: b.goal_name,
    emoji: b.goal_emoji || '🎯',
    goalType: b.goal_type,
    targetAmount: b.target_amount != null ? num(b.target_amount) : undefined,
    targetDate: b.target_date ?? undefined,
    currentAmount: num(b.current_amount),
    contributionAmount: b.contribution_amount != null ? num(b.contribution_amount) : undefined,
    frequency: b.frequency,
    allowEarlyWithdrawal: b.allow_early_withdrawal,
    penaltyPercent: num(b.early_withdrawal_penalty_percent, 10),
    hasSavingsAccount: Boolean(b.paystack_subaccount_code),
    status: b.status,
    isUnlocked: b.is_unlocked,
    lockedReasons: b.locked_reasons ?? [],
    progressPercent: b.progress_percent != null ? num(b.progress_percent) : undefined,
    daysRemaining: b.days_remaining != null ? num(b.days_remaining) : undefined,
    amountRemaining: b.amount_remaining != null ? num(b.amount_remaining) : undefined,
    withdrawalPenaltyAmount:
      b.withdrawal_penalty_amount != null ? num(b.withdrawal_penalty_amount) : undefined,
    createdAt: b.created_at,
    contributions: (b.contributions ?? []).map(mapContribution),
  };
}

export interface GoalsSummary {
  activeCount: number;
  totalSaved: number;
  readyToCollect: number;
}

export async function fetchGoals(): Promise<{ goals: PersonalGoal[]; summary: GoalsSummary }> {
  const { data } = await apiClient.get<{
    goals: BackendGoal[];
    summary: { active_count: number; total_saved: number; ready_to_collect: number };
  }>(ENDPOINTS.personalSusu.list);
  return {
    goals: (data.goals ?? []).map(mapGoal),
    summary: {
      activeCount: data.summary?.active_count ?? 0,
      totalSaved: num(data.summary?.total_saved),
      readyToCollect: data.summary?.ready_to_collect ?? 0,
    },
  };
}

export async function fetchGoal(goalId: string): Promise<PersonalGoal> {
  const { data } = await apiClient.get<{ goal: BackendGoal }>(
    ENDPOINTS.personalSusu.detail(goalId),
  );
  return mapGoal(data.goal);
}

export interface CreateGoalPayload {
  name: string;
  emoji: string;
  goalType: PersonalGoalType;
  targetAmount?: number;
  targetDate?: string;
  contributionAmount?: number;
  frequency: PersonalGoalFrequency;
  allowEarlyWithdrawal: boolean;
}

export async function createGoal(
  payload: CreateGoalPayload,
): Promise<{ goal: PersonalGoal; warning: string | null }> {
  const { data } = await apiClient.post<{ goal: BackendGoal; warning: string | null }>(
    ENDPOINTS.personalSusu.create,
    {
      goal_name: payload.name,
      goal_emoji: payload.emoji,
      goal_type: payload.goalType,
      target_amount: payload.targetAmount,
      target_date: payload.targetDate,
      contribution_amount: payload.contributionAmount,
      frequency: payload.frequency,
      allow_early_withdrawal: payload.allowEarlyWithdrawal,
    },
  );
  return { goal: mapGoal(data.goal), warning: data.warning ?? null };
}

export interface GoalPaymentInit {
  reference: string;
  /** Total to charge = contribution + Paystack fee (the saver bears the fee). */
  amount: number;
  subaccountCode: string | null;
  feeBreakdown: { contribution: number; fee: number; total: number };
}

export async function initializeGoalContribution(
  goalId: string,
  amount: number,
  note?: string,
): Promise<GoalPaymentInit> {
  const { data } = await apiClient.post<{
    reference: string;
    amount: number;
    subaccount_code: string | null;
    fee_breakdown: { contribution: number; fee: number; total: number };
  }>(ENDPOINTS.personalSusu.contribute, { goalId, amount, note });
  return {
    reference: data.reference,
    amount: num(data.amount),
    subaccountCode: data.subaccount_code,
    feeBreakdown: data.fee_breakdown,
  };
}

/** Dev-friendly fallback for when the webhook can't reach the server. Idempotent. */
export async function verifyGoalContribution(reference: string): Promise<{ unlocked: boolean }> {
  const { data } = await apiClient.get<{ unlocked?: boolean }>(
    ENDPOINTS.personalSusu.verify(reference),
  );
  return { unlocked: Boolean(data.unlocked) };
}

export async function collectGoal(goalId: string): Promise<string> {
  const { data } = await apiClient.post<{ message: string }>(
    ENDPOINTS.personalSusu.collect(goalId),
  );
  return data.message;
}

export interface EarlyWithdrawalPreview {
  totalSaved: number;
  penaltyPercent: number;
  penaltyAmount: number;
  amountToReceive: number;
  warning: string;
}

/** Without `confirmed` the backend only previews — nothing moves. */
export async function previewEarlyWithdrawal(goalId: string): Promise<EarlyWithdrawalPreview> {
  const { data } = await apiClient.post<{
    total_saved: number;
    penalty_percent: number;
    penalty_amount: number;
    amount_to_receive: number;
    warning: string;
  }>(ENDPOINTS.personalSusu.withdrawEarly(goalId), {});
  return {
    totalSaved: num(data.total_saved),
    penaltyPercent: num(data.penalty_percent),
    penaltyAmount: num(data.penalty_amount),
    amountToReceive: num(data.amount_to_receive),
    warning: data.warning,
  };
}

export async function confirmEarlyWithdrawal(goalId: string): Promise<string> {
  const { data } = await apiClient.post<{ message: string }>(
    ENDPOINTS.personalSusu.withdrawEarly(goalId),
    { confirmed: true },
  );
  return data.message;
}

export async function cancelGoal(goalId: string): Promise<void> {
  await apiClient.patch(ENDPOINTS.personalSusu.cancel(goalId));
}
