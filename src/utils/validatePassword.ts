// Client mirror of the backend's password policy
// (SusuBox-backend/src/utils/validatePassword.js).
//
// This is a CONVENIENCE, not a control. /auth/register is public, so the server
// re-runs every one of these rules and its verdict is the only one that counts.
// The point of duplicating them here is that a user should never fill in four
// registration steps and only then be told their password is unacceptable.
//
// Keep the two files in step. If a rule changes server-side and not here, the
// symptom is a WEAK_PASSWORD rejection the UI said nothing about.

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789',
  '1234567890', 'qwerty123', 'qwertyui', 'abc12345', 'letmein1', 'welcome1',
  'admin123', 'iloveyou', 'sunshine', 'princess', 'football', 'monkey123',
  'ghana123', 'accra123', 'susubox1', 'susubox123', 'momo1234',
];

export interface PasswordContext {
  email?: string;
  phone?: string;
  full_name?: string;
}

export interface PasswordCheck {
  valid: boolean;
  errors: string[];
  /** 0-4. Drives the meter only — the server does not grade, it accepts or rejects. */
  score: number;
  label: 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
}

export function validatePassword(
  password: string,
  context: PasswordContext = {},
): PasswordCheck {
  const errors: string[] = [];

  if (!password) {
    return { valid: false, errors: ['Password is required.'], score: 0, label: 'Too short' };
  }

  if (password.length < MIN_LENGTH) errors.push(`At least ${MIN_LENGTH} characters`);
  if (password.length > MAX_LENGTH) errors.push(`No more than ${MAX_LENGTH} characters`);
  if (!/[a-z]/.test(password)) errors.push('A lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('An uppercase letter');
  if (!/\d/.test(password)) errors.push('A number');

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.some((p) => lower === p || lower.includes(p))) {
    errors.push('Not a common password');
  }

  if (context.email) {
    const localPart = context.email.split('@')[0].toLowerCase();
    if (localPart.length >= 4 && lower.includes(localPart)) errors.push('Not your email address');
  }
  if (context.phone) {
    const tail = context.phone.replace(/\D/g, '').slice(-6);
    if (tail.length === 6 && password.includes(tail)) errors.push('Not your phone number');
  }
  if (context.full_name) {
    const names = context.full_name.toLowerCase().split(/\s+/);
    if (names.some((n) => n.length >= 4 && lower.includes(n))) errors.push('Not your name');
  }

  if (/^(.)\1+$/.test(password)) errors.push('Not one repeated character');
  if (/012345|123456|234567|345678|456789|abcdef|qwerty/i.test(password)) {
    errors.push('No obvious sequences');
  }

  // Score is for the bar. Length beyond the minimum and symbol use do not
  // affect acceptance, but they do make a password meaningfully better, so the
  // meter rewards them rather than showing "Strong" the moment it is merely legal.
  let score = 0;
  if (password.length >= MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (errors.length > 0) score = Math.min(score, 1);

  const label: PasswordCheck['label'] =
    password.length < MIN_LENGTH
      ? 'Too short'
      : errors.length > 0
        ? 'Weak'
        : score >= 4
          ? 'Strong'
          : score === 3
            ? 'Good'
            : 'Fair';

  return { valid: errors.length === 0, errors, score, label };
}
