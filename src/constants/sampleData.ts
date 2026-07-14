import type {
  ActivityItem,
  AppNotification,
  ContributionHistoryItem,
  Group,
  User,
} from '@/src/types';
import { Colors } from '@/src/constants/colors';

// Realistic Ghanaian names used consistently across both sample groups so the
// UI reads as one coherent community rather than randomly generated filler.
export const currentUser: User = {
  id: 'u1',
  name: 'Kofi Mensah',
  phone: '+233 24 000 0000',
  email: 'kofi.mensah@example.com',
  idVerified: true,
  idSubmitted: true,
  reliabilityScore: 98,
  streak: 5,
  penaltyDebt: 20,
  arrears: 0,
  tcAcceptedAt: '2026-05-20T09:14:00Z',
};

const accraMembers: Group['members'] = [
  { id: 'm1', userId: 'u1', name: 'Kofi Mensah', role: 'organizer', status: 'paid', progressPct: 100, reliabilityScore: 98, penaltyDebt: 20, streak: 5 },
  { id: 'm2', userId: 'u2', name: 'Efua Mansah', role: 'member', status: 'paid', progressPct: 95, reliabilityScore: 94, penaltyDebt: 0, streak: 3 },
  { id: 'm3', userId: 'u3', name: 'Akosua Baah', role: 'member', status: 'pending', progressPct: 60, reliabilityScore: 78, penaltyDebt: 0, streak: 1 },
  { id: 'm4', userId: 'u4', name: 'Nana Yaa', role: 'member', status: 'late', progressPct: 35, reliabilityScore: 42, penaltyDebt: 5, streak: 0 },
  { id: 'm5', userId: 'u5', name: 'Kojo Frimpong', role: 'member', status: 'pending', progressPct: 82, reliabilityScore: 88, penaltyDebt: 0, streak: 2 },
  { id: 'm6', userId: 'u6', name: 'Ama Osei', role: 'member', status: 'paid', progressPct: 100, reliabilityScore: 91, penaltyDebt: 0, streak: 3 },
  { id: 'm7', userId: 'u7', name: 'Yaw Asante', role: 'member', status: 'paid', progressPct: 90, reliabilityScore: 85, penaltyDebt: 0, streak: 2 },
  // Removed by admin — demonstrates Mechanism 10 (blocklist): grey "Removed"
  // chip instead of a status chip, cannot rejoin with the same invite code.
  { id: 'm8', userId: 'u8', name: 'Abena Owusu', role: 'member', status: 'pending', progressPct: 55, reliabilityScore: 70, penaltyDebt: 0, streak: 0, removed: true },
];

const kumasiMembers: Group['members'] = [
  { id: 'm9', userId: 'u1', name: 'Kofi Mensah', role: 'member', status: 'paid', progressPct: 100, reliabilityScore: 98, penaltyDebt: 20, streak: 5 },
  { id: 'm10', userId: 'u9', name: 'Emmanuel Tetteh', role: 'organizer', status: 'paid', progressPct: 100, reliabilityScore: 96, penaltyDebt: 0, streak: 8 },
  { id: 'm11', userId: 'u10', name: 'Adjoa Boateng', role: 'member', status: 'late', progressPct: 20, reliabilityScore: 38, penaltyDebt: 30, streak: 0 },
  { id: 'm12', userId: 'u11', name: 'Kwabena Owusu', role: 'member', status: 'pending', progressPct: 65, reliabilityScore: 80, penaltyDebt: 0, streak: 2 },
  { id: 'm13', userId: 'u12', name: 'Afia Darko', role: 'member', status: 'paid', progressPct: 100, reliabilityScore: 92, penaltyDebt: 0, streak: 4 },
  { id: 'm14', userId: 'u13', name: 'Kwesi Appiah', role: 'member', status: 'pending', progressPct: 48, reliabilityScore: 66, penaltyDebt: 0, streak: 1 },
  { id: 'm15', userId: 'u14', name: 'Esi Amoah', role: 'member', status: 'paid', progressPct: 100, reliabilityScore: 89, penaltyDebt: 0, streak: 3 },
  { id: 'm16', userId: 'u15', name: 'Yaw Boadi', role: 'member', status: 'pending', progressPct: 40, reliabilityScore: 60, penaltyDebt: 0, streak: 1 },
];

const ACCRA_RULES =
  'Contributions of GHS 100 are due every Friday by 6 PM. Late payments attract a GHS 5 penalty per day after the 3-day grace period. Payout follows the agreed rotation order. Members must keep their phone number active for reminders. Leaving mid-rotation forfeits pending payouts.';

const FAMILY_RULES =
  'Monthly contributions of GHS 500 are due on the 14th. Grace period of 5 days. Payouts follow rotation set at cycle 1. Disputes are settled by the group admin with two witnesses.';

export const groups: Group[] = [
  {
    id: 'g1',
    name: 'Accra Wealth Hub',
    description: 'Weekly susu circle for Accra market traders',
    cycle: 3,
    totalCycles: 8,
    status: 'open',
    contributionAmount: 100,
    frequency: 'weekly',
    collected: 600,
    expected: 800,
    nextContributionInHours: 48,
    currentRecipientId: 'm6',
    currentRecipientName: 'Ama Osei',
    memberCount: 8,
    maxMembers: 10,
    role: 'organizer',
    progressPct: 75,
    members: accraMembers,
    payoutFrozen: true,
    freezeReason: 'Nana Yaa has GHS 65 in unpaid contributions.',
    inviteCode: 'SUSU-4K7PQ2',
    adminName: 'Kofi Mensah',
    penaltyFee: 5,
    gracePeriodDays: 3,
    rules: ACCRA_RULES,
    cycleStarted: true,
    pendingRequests: [
      { id: 'r1', userId: 'u20', name: 'Adwoa Safo', idVerified: true, reliabilityScore: 87, requestedAt: '2026-07-12T10:30:00Z' },
      { id: 'r2', userId: 'u21', name: 'Kweku Annan', idVerified: false, requestedAt: '2026-07-13T15:05:00Z' },
    ],
    rotation: [
      { position: 1, memberId: 'm2', memberName: 'Efua Mansah', date: '2026-06-01', amount: 800, state: 'completed', reliabilityScore: 94 },
      { position: 2, memberId: 'm7', memberName: 'Yaw Asante', date: '2026-06-08', amount: 800, state: 'completed', reliabilityScore: 85 },
      { position: 3, memberId: 'm6', memberName: 'Ama Osei', date: '2026-06-15', amount: 800, state: 'current', collectedCount: 6, totalCount: 8, reliabilityScore: 91 },
      { position: 4, memberId: 'm5', memberName: 'Kojo Frimpong', date: '2026-06-22', amount: 800, state: 'upcoming', reliabilityScore: 88 },
      { position: 5, memberId: 'm1', memberName: 'Kofi Mensah', date: '2026-06-29', amount: 800, state: 'upcoming', reliabilityScore: 98 },
    ],
    history: [
      { cycle: 1, recipientName: 'Efua Mansah', amount: 800, date: '2026-06-01', completed: true },
      { cycle: 2, recipientName: 'Yaw Asante', amount: 800, date: '2026-06-08', completed: true },
      { cycle: 3, recipientName: 'Ama Osei', amount: 800, date: '2026-06-15', completed: false },
    ],
  },
  {
    id: 'g2',
    name: 'Family Fund',
    description: 'Monthly family savings circle, Kumasi branch',
    cycle: 12,
    totalCycles: 20,
    status: 'open',
    contributionAmount: 500,
    frequency: 'monthly',
    collected: 3200,
    expected: 4000,
    nextContributionInHours: 96,
    currentRecipientId: 'm10',
    currentRecipientName: 'Emmanuel Tetteh',
    memberCount: 8,
    maxMembers: 8,
    role: 'member',
    progressPct: 45,
    members: kumasiMembers,
    payoutFrozen: false,
    inviteCode: 'SUSU-9WX3TB',
    adminName: 'Emmanuel Tetteh',
    penaltyFee: 10,
    gracePeriodDays: 5,
    rules: FAMILY_RULES,
    cycleStarted: true,
    pendingRequests: [],
    rotation: [
      { position: 10, memberId: 'u12', memberName: 'Afia Darko', date: '2026-05-14', amount: 4000, state: 'completed', reliabilityScore: 92 },
      { position: 11, memberId: 'u1', memberName: 'Kofi Mensah', date: '2026-06-14', amount: 4000, state: 'completed', reliabilityScore: 98 },
      { position: 12, memberId: 'u9', memberName: 'Emmanuel Tetteh', date: '2026-07-14', amount: 4000, state: 'current', collectedCount: 5, totalCount: 8, reliabilityScore: 96 },
      { position: 13, memberId: 'u10', memberName: 'Adjoa Boateng', date: '2026-08-14', amount: 4000, state: 'upcoming', reliabilityScore: 38 },
    ],
    history: [
      { cycle: 10, recipientName: 'Kwabena Owusu', amount: 4000, date: '2026-05-14', completed: true },
      { cycle: 11, recipientName: 'Kofi Mensah', amount: 4000, date: '2026-06-14', completed: true },
      { cycle: 12, recipientName: 'Emmanuel Tetteh', amount: 4000, date: '2026-07-14', completed: false },
    ],
  },
  {
    id: 'g3',
    name: 'Osu Traders Circle',
    description: 'New weekly circle — rotation not locked yet',
    cycle: 0,
    totalCycles: 6,
    status: 'open',
    contributionAmount: 150,
    frequency: 'weekly',
    collected: 0,
    expected: 900,
    nextContributionInHours: 168,
    currentRecipientId: 'm17',
    currentRecipientName: 'Kofi Mensah',
    memberCount: 6,
    maxMembers: 6,
    role: 'organizer',
    progressPct: 0,
    members: [
      { id: 'm17', userId: 'u1', name: 'Kofi Mensah', role: 'organizer', status: 'pending', progressPct: 0, reliabilityScore: 98, penaltyDebt: 0, streak: 5 },
      { id: 'm18', userId: 'u16', name: 'Abena Pokua', role: 'member', status: 'pending', progressPct: 0, reliabilityScore: 90, penaltyDebt: 0, streak: 3 },
      { id: 'm19', userId: 'u17', name: 'Yaw Darko', role: 'member', status: 'pending', progressPct: 0, reliabilityScore: 75, penaltyDebt: 0, streak: 1 },
      { id: 'm20', userId: 'u18', name: 'Emmanuel Quaye', role: 'member', status: 'pending', progressPct: 0, reliabilityScore: 82, penaltyDebt: 0, streak: 2 },
      { id: 'm21', userId: 'u19', name: 'Ama Serwaa', role: 'member', status: 'pending', progressPct: 0, reliabilityScore: 88, penaltyDebt: 0, streak: 2 },
      { id: 'm22', userId: 'u22', name: 'Akosua Agyemang', role: 'member', status: 'pending', progressPct: 0, reliabilityScore: 68, penaltyDebt: 0, streak: 0 },
    ],
    payoutFrozen: false,
    inviteCode: 'SUSU-2NDF8H',
    adminName: 'Kofi Mensah',
    penaltyFee: 5,
    gracePeriodDays: 3,
    rules: 'Weekly GHS 150 due Mondays. Rotation order agreed before cycle 1 opens.',
    // Cycle 1 has not opened — Mechanism 1: rotation is drag-to-reorder here.
    cycleStarted: false,
    pendingRequests: [],
    rotation: [
      { position: 1, memberId: 'm17', memberName: 'Kofi Mensah', date: '2026-07-20', amount: 900, state: 'upcoming', reliabilityScore: 98 },
      { position: 2, memberId: 'm18', memberName: 'Abena Pokua', date: '2026-07-27', amount: 900, state: 'upcoming', reliabilityScore: 90 },
      { position: 3, memberId: 'm21', memberName: 'Ama Serwaa', date: '2026-08-03', amount: 900, state: 'upcoming', reliabilityScore: 88 },
      { position: 4, memberId: 'm20', memberName: 'Emmanuel Quaye', date: '2026-08-10', amount: 900, state: 'upcoming', reliabilityScore: 82 },
      { position: 5, memberId: 'm19', memberName: 'Yaw Darko', date: '2026-08-17', amount: 900, state: 'upcoming', reliabilityScore: 75 },
      { position: 6, memberId: 'm22', memberName: 'Akosua Agyemang', date: '2026-08-24', amount: 900, state: 'upcoming', reliabilityScore: 68 },
    ],
    history: [],
  },
];

export const totalSavings = groups.reduce((sum, g) => sum + g.collected, 0);

export const recentActivity: ActivityItem[] = [
  { id: 'a1', type: 'payment', title: 'Contribution successful', subtitle: 'Accra Wealth Hub', timestamp: '2h ago' },
  { id: 'a2', type: 'member_joined', title: 'New member joined', subtitle: 'Family Fund', timestamp: 'Yesterday' },
  { id: 'a3', type: 'payout_started', title: 'Cycle 3 payout started', subtitle: 'Accra Wealth Hub', timestamp: 'Jul 8' },
];

// Mechanism 6 — Escalating notifications. The first four entries demonstrate
// the full escalation ladder the backend fires per cycle:
//   Level 1: cycle open        (day 0)         — type 'info'
//   Level 2: 3-day reminder    (due date − 3d) — type 'reminder'
//   Level 3: 1-day final warn  (due date − 1d) — type 'warning'
//   Level 4: late alert        (due date + grace period) — type 'overdue'
export const notifications: AppNotification[] = [
  { id: 'n0a', type: 'info', title: 'Cycle 4 is open', body: 'Cycle 4 of "Accra Wealth Hub" has started. Contribution of GHS 100.00 is due Friday, 17 Jul.', timestamp: 'Just now', read: false },
  { id: 'n0b', type: 'reminder', title: 'Contribution due in 3 days', body: 'Reminder: your GHS 100.00 contribution to "Accra Wealth Hub" is due in 3 days. Pay early to protect your reliability score.', timestamp: '1h ago', read: false },
  { id: 'n0c', type: 'warning', title: 'Final warning — due tomorrow', body: 'Your GHS 500.00 contribution to "Family Fund" is due TOMORROW. A GHS 10.00 late fee applies after the grace period.', timestamp: '3h ago', read: true },
  { id: 'n0d', type: 'overdue', title: 'Contribution overdue', body: 'Your payment for "Family Fund" is now 2 days late. GHS 20.00 in penalties have been added and your reliability score has dropped.', timestamp: '2 days ago', read: true },
  { id: 'n1', type: 'payment', title: 'Payment Received', body: 'Your contribution of GHS 250.00 to "Accra Wealth Hub" has been confirmed.', timestamp: '2m ago', read: false },
  { id: 'n2', type: 'payout', title: 'Payout Scheduled', body: 'Congratulations! You are next in line for the GHS 5,000.00 payout on Friday.', timestamp: '1h ago', read: false },
  { id: 'n3', type: 'warning', title: 'Late Fee Warning', body: 'A late fee of GHS 10.00 will be applied if the payment for "Family Fund" is not made today.', timestamp: '4h ago', read: true },
  { id: 'n4', type: 'info', title: 'Security Update', body: 'We have improved our security protocols. Your account remains protected with bank-grade encryption.', timestamp: 'Yesterday', read: true },
];

export const contributionHistory: ContributionHistoryItem[] = [
  { id: 'c1', label: 'Cycle 11 Contribution', date: '2026-06-14', amount: 500 },
  { id: 'c2', label: 'Cycle 10 Contribution', date: '2026-05-14', amount: 500 },
  { id: 'c3', label: 'Cycle 9 Contribution', date: '2026-04-14', amount: 500 },
];

export const reportsData = {
  savingsGrowth: {
    total: 12450,
    changePct: 12.5,
    labels: ['Week 1', 'Week 2', 'Week 3', 'Current'],
    values: [8200, 9400, 11100, 12450],
  },
  paymentConsistency: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    onTime: [1, 1, 0, 1, 1, 1],
  },
  penalties: { total: 120, count: 2 },
  methods: [
    { name: 'MoMo', pct: 70, color: Colors.primary },
    { name: 'Bank', pct: 20, color: Colors.success },
    { name: 'Other', pct: 10, color: Colors.accent },
  ],
};
