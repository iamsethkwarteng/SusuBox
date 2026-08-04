// SusuBox brand palette — single source of truth for every screen/component.
// Keep this the only place raw hex values live; everything else imports from here.

export const Colors = {
  primary: '#185FA5',
  primaryDark: '#0F3F70',
  primaryLight: '#E8F1FA',

  success: '#1D9E75',
  successLight: '#E4F6EF',

  accent: '#C9860A',
  accentLight: '#FBF0DD',

  warning: '#BA7517',
  warningLight: '#FBEEDC',

  danger: '#791F1F',
  dangerLight: '#F9E6E6',

  background: '#F5F4F0',
  surface: '#FFFFFF',

  textPrimary: '#2C2C2A',
  textSecondary: '#6B6B67',
  textMuted: '#9B9B97',

  border: '#E4E2DC',
  divider: '#ECEAE4',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(44, 44, 42, 0.55)',
} as const;

// Status -> color mapping used by StatusChip, MemberRow, reliability bars, etc.
export const StatusColors = {
  paid: { fg: Colors.success, bg: Colors.successLight },
  pending: { fg: Colors.warning, bg: Colors.warningLight },
  late: { fg: Colors.danger, bg: Colors.dangerLight },
} as const;

export type ContributionStatus = keyof typeof StatusColors;

export default Colors;
