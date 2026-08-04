// Maps backend (snake_case, normalized) payloads onto the frontend's camelCase
// domain types. Keeping every conversion here means screens/hooks never see
// backend field names, and the mapping is easy to audit in one place.

import type {
  AppNotification,
  ContributionStatus,
  Group,
  GroupFrequency,
  GroupMember,
  GroupPreview,
  MemberRole,
  MoMoNetwork,
  NotificationType,
  PaymentHistoryItem,
  User,
} from '@/src/types';

// Shape the backend /auth + /users endpoints return for a user row.
export interface BackendUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  // The backend no longer returns the raw Cloudinary KYC URLs — those links are
  // permanent and unauthenticated. It sends presence booleans instead; the
  // images themselves come from /users/kyc-status as short-lived signed URLs.
  id_submitted?: boolean;
  selfie_submitted?: boolean;
  id_type?: string | null;
  id_verified: boolean;
  id_number?: string | null;
  email_verified?: boolean;
  two_fa_enabled?: boolean;
  profile_photo_url?: string | null;
  fcm_token?: string | null;
  platform_reliability_score?: number;
  momo_number?: string | null;
  momo_network?: MoMoNetwork | null;
  paystack_recipient_code?: string | null;
  tc_accepted_at?: string | null;
}

export function mapUser(b: BackendUser): User {
  return {
    id: b.id,
    name: b.full_name,
    phone: b.phone,
    email: b.email,
    profilePhotoUrl: b.profile_photo_url ?? undefined,
    idVerified: b.id_verified,
    // Older backends omit the field; treat "absent" as verified so an app built
    // against a pre-verification server doesn't strand every user on the
    // verification screen.
    emailVerified: b.email_verified ?? true,
    twoFaEnabled: Boolean(b.two_fa_enabled),
    idNumber: b.id_number ?? undefined,
    // The account-level user row doesn't carry per-group standing; those live
    // on GroupMember. Default them so the profile screen renders cleanly.
    idSubmitted: Boolean(b.id_submitted),
    momoNumber: b.momo_number ?? undefined,
    momoNetwork: b.momo_network ?? undefined,
    payoutReady: Boolean(b.paystack_recipient_code),
    reliabilityScore: Math.round(b.platform_reliability_score ?? 0),
    streak: 0,
    penaltyDebt: 0,
    arrears: 0,
    tcAcceptedAt: b.tc_accepted_at ?? undefined,
  };
}

// --- Groups ----------------------------------------------------------------

interface BackendCycle {
  id: string;
  cycle_number: number;
  recipient_user_id?: string | null;
  status: 'open' | 'closed' | 'paid_out';
  end_date?: string;
  expected_total?: number | string;
  collected_total?: number | string;
  net_payout_amount?: number | string | null;
  payout_blocked?: boolean;
}

interface BackendMember {
  id: string;
  user_id: string;
  name?: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'removed';
  payout_position?: number | null;
  reliability_score?: number;
  penalty_debt?: number | string;
  streak_count?: number;
  profile_photo_url?: string | null;
  id_verified?: boolean;
  /** Present only when the requester is this group's admin. */
  id_number?: string | null;
  id_type?: string | null;
  /** Per-cycle contribution status from getGroupDetail (paid/pending/late). */
  contribution_status?: ContributionStatus;
}

interface BackendRotationEntry {
  position: number;
  member_id: string;
  user_id: string;
  member_name: string;
  reliability_score?: number;
  date?: string | null;
  amount: number | string;
  state: 'completed' | 'current' | 'upcoming';
  collected_count?: number;
  total_count?: number;
}

interface BackendHistoryEntry {
  cycle: number;
  recipient_name: string;
  amount: number | string;
  date: string;
  completed: boolean;
}

interface BackendPendingRequest {
  member_id: string;
  user_id: string;
  full_name: string;
  id_verified: boolean;
  platform_reliability_score?: number;
  requested_at: string;
}

export interface BackendGroup {
  id: string;
  name: string;
  contribution_amount: number | string;
  frequency: GroupFrequency;
  max_members: number;
  invite_code: string;
  group_rules?: string | null;
  penalty_fee_per_cycle?: number | string;
  grace_period_days?: number;
  status: 'active' | 'closed';
  my_role?: 'admin' | 'member';
  member_count?: number;
  admin_name?: string;
  current_cycle?: BackendCycle | null;
  members?: BackendMember[];
  rotation?: BackendRotationEntry[];
  history?: BackendHistoryEntry[];
  pending_requests?: BackendPendingRequest[];
  pending_requests_count?: number;
  paystack_subaccount_code?: string | null;
  has_payment_account?: boolean;
  payout_cycle?: {
    id: string;
    cycle_number: number;
    status: 'closed' | 'paid_out';
    net_payout_amount?: number | string | null;
    payout_blocked?: boolean;
    pot_value?: number | string | null;
    arrears?: number | string | null;
    penalties?: number | string | null;
  } | null;
  payout_recipient?: {
    user_id: string;
    name: string;
    has_momo: boolean;
    momo_network?: MoMoNetwork | null;
    momo_last4?: string | null;
  } | null;
}

const toRole = (r?: 'admin' | 'member'): MemberRole => (r === 'admin' ? 'organizer' : 'member');
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function hoursUntil(iso?: string): number {
  if (!iso) return 0;
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
}

export function mapMember(b: BackendMember): GroupMember {
  // getGroupDetail supplies real per-cycle contribution_status; the lighter
  // list payload omits it, so default to 'pending'.
  const status: ContributionStatus = b.contribution_status ?? 'pending';
  return {
    id: b.id,
    userId: b.user_id,
    name: b.name ?? 'Member',
    avatarUrl: b.profile_photo_url ?? undefined,
    role: toRole(b.role),
    status,
    progressPct: status === 'paid' ? 100 : 0,
    reliabilityScore: Math.round(num(b.reliability_score)),
    penaltyDebt: num(b.penalty_debt),
    streak: b.streak_count ?? 0,
    removed: b.status === 'removed',
    idVerified: Boolean(b.id_verified),
    // Undefined for non-admin viewers — the backend omits them entirely.
    idNumber: b.id_number ?? undefined,
    idType: b.id_type ?? undefined,
  };
}

export function mapGroup(b: BackendGroup): Group {
  const cycle = b.current_cycle ?? undefined;
  const contribution = num(b.contribution_amount);
  const memberCount = b.member_count ?? (b.members ? b.members.length : 0);
  const collected = num(cycle?.collected_total);
  const expected = num(cycle?.expected_total, contribution * memberCount);
  const members = (b.members ?? []).map(mapMember);

  return {
    id: b.id,
    name: b.name,
    description: '',
    cycle: cycle?.cycle_number ?? 0,
    totalCycles: memberCount,
    status: b.status === 'active' ? 'open' : 'closed',
    contributionAmount: contribution,
    frequency: b.frequency,
    collected,
    expected,
    nextContributionInHours: hoursUntil(cycle?.end_date),
    currentCycleId: cycle?.id,
    hasOpenCycle: Boolean(cycle && cycle.status === 'open'),
    payoutCycleId: b.payout_cycle?.id,
    payoutCycleStatus: b.payout_cycle?.status,
    payoutNetAmount:
      b.payout_cycle?.net_payout_amount != null ? num(b.payout_cycle.net_payout_amount) : undefined,
    payoutCycleBlocked: b.payout_cycle?.payout_blocked ?? undefined,
    // Deduction split, so the payout preview can itemise arrears vs penalties.
    payoutPotValue: b.payout_cycle?.pot_value != null ? num(b.payout_cycle.pot_value) : undefined,
    payoutArrears: b.payout_cycle?.arrears != null ? num(b.payout_cycle.arrears) : undefined,
    payoutPenalties: b.payout_cycle?.penalties != null ? num(b.payout_cycle.penalties) : undefined,
    hasPaymentAccount: Boolean(b.has_payment_account ?? b.paystack_subaccount_code),
    payoutRecipient: b.payout_recipient
      ? {
          userId: b.payout_recipient.user_id,
          name: b.payout_recipient.name,
          hasMomo: b.payout_recipient.has_momo,
          momoNetwork: b.payout_recipient.momo_network ?? undefined,
          momoLast4: b.payout_recipient.momo_last4 ?? undefined,
        }
      : undefined,
    currentRecipientId: cycle?.recipient_user_id ?? '',
    currentRecipientName:
      members.find((m) => m.userId === cycle?.recipient_user_id)?.name ?? '',
    memberCount,
    maxMembers: b.max_members,
    role: toRole(b.my_role),
    progressPct: expected > 0 ? Math.round((collected / expected) * 100) : 0,
    members,
    rotation: (b.rotation ?? []).map((r) => ({
      position: r.position,
      memberId: r.member_id,
      userId: r.user_id,
      memberName: r.member_name,
      date: r.date ?? '',
      amount: num(r.amount),
      state: r.state,
      collectedCount: r.collected_count,
      totalCount: r.total_count,
      reliabilityScore: Math.round(num(r.reliability_score)),
    })),
    history: (b.history ?? []).map((h) => ({
      cycle: h.cycle,
      recipientName: h.recipient_name,
      amount: num(h.amount),
      date: h.date,
      completed: h.completed,
    })),
    payoutFrozen: Boolean(cycle?.payout_blocked),
    freezeReason: cycle?.payout_blocked ? 'Member arrears detected in current cycle.' : undefined,
    inviteCode: b.invite_code,
    adminName: b.admin_name ?? '',
    penaltyFee: num(b.penalty_fee_per_cycle),
    gracePeriodDays: b.grace_period_days ?? 3,
    rules: b.group_rules ?? undefined,
    cycleStarted: (cycle?.cycle_number ?? 0) >= 1,
    pendingRequests: (b.pending_requests ?? []).map((p) => ({
      id: p.member_id,
      userId: p.user_id,
      name: p.full_name,
      idVerified: p.id_verified,
      reliabilityScore:
        p.platform_reliability_score !== undefined
          ? Math.round(p.platform_reliability_score)
          : undefined,
      requestedAt: p.requested_at,
    })),
  };
}

export interface BackendPreview {
  id: string;
  name: string;
  contribution_amount: number | string;
  frequency: GroupFrequency;
  slots_remaining: number;
  admin_name: string;
  group_rules?: string | null;
}

export function mapPreview(b: BackendPreview): GroupPreview {
  return {
    id: b.id,
    name: b.name,
    contributionAmount: num(b.contribution_amount),
    frequency: b.frequency,
    slotsRemaining: b.slots_remaining,
    adminName: b.admin_name,
    rules: b.group_rules ?? '',
  };
}

// --- Notifications ---------------------------------------------------------

export interface BackendNotification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Backend has many granular types; the UI groups them into 6 buckets + a title.
const NOTIF_TYPE_MAP: Record<string, { type: NotificationType; title: string }> = {
  contribution_confirmed: { type: 'payment', title: 'Payment Received' },
  payout_received: { type: 'payout', title: 'Payout Received' },
  payout_turn: { type: 'payout', title: 'Your Payout Turn' },
  payout_frozen: { type: 'overdue', title: 'Payout Frozen' },
  payment_due: { type: 'reminder', title: 'Contribution Due' },
  late_warning: { type: 'warning', title: 'Late Warning' },
  join_request: { type: 'info', title: 'New Join Request' },
  join_approved: { type: 'info', title: 'Request Approved' },
  join_declined: { type: 'info', title: 'Request Update' },
  badge_earned: { type: 'info', title: 'Badge Earned' },
  member_removed: { type: 'overdue', title: 'Membership Update' },
  info: { type: 'info', title: 'SusuBox' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function mapNotification(b: BackendNotification): AppNotification {
  const meta = NOTIF_TYPE_MAP[b.type] ?? { type: 'info' as NotificationType, title: 'SusuBox' };
  return {
    id: b.id,
    type: meta.type,
    title: meta.title,
    body: b.message,
    timestamp: relativeTime(b.created_at),
    read: b.is_read,
  };
}

// --- Payment history -------------------------------------------------------

// Row shape returned by GET /api/payments/history — a Contribution with its
// cycle + group eager-loaded.
export interface BackendContributionRow {
  id: string;
  amount: number | string;
  paystack_reference?: string | null;
  payment_method?: string | null;
  is_arrears?: boolean;
  created_at: string;
  cycle?: { id: string; cycle_number: number; group_id: string } | null;
  group?: { id: string; name: string; frequency?: string } | null;
}

export function mapPaymentHistory(b: BackendContributionRow): PaymentHistoryItem {
  return {
    id: b.id,
    groupId: b.group?.id ?? b.cycle?.group_id ?? '',
    groupName: b.group?.name ?? 'Group',
    cycleNumber: b.cycle?.cycle_number ?? 0,
    amount: num(b.amount),
    method: b.payment_method ?? null,
    reference: b.paystack_reference ?? '',
    date: b.created_at,
    isArrears: Boolean(b.is_arrears),
  };
}
