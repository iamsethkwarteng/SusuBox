import { Colors } from '@/src/constants/colors';

// Score bands: >=80 healthy, 50-79 watch, <50 at-risk. Shared by ReliabilityBar
// and MemberRow so a member's color never disagrees with itself across screens.
export function reliabilityColor(score: number): string {
  if (score >= 80) return Colors.success;
  if (score >= 50) return Colors.accent;
  return Colors.danger;
}

export function reliabilityLabel(score: number): string {
  if (score >= 80) return 'Reliable';
  if (score >= 50) return 'Watch';
  return 'At risk';
}
