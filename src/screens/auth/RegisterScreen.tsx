import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { sendPhoneOtp } from '@/src/api/otp';
import { PHONE_OTP_ENABLED } from '@/src/constants/api';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import IDCaptureScreen, {
  DOCUMENT_LABELS,
  validateIDNumber,
  type DocumentType,
} from '@/src/screens/auth/IDCaptureScreen';
import PhoneOTPScreen from '@/src/screens/auth/PhoneOTPScreen';
import SelfieScreen from '@/src/screens/auth/SelfieScreen';
import { validatePassword } from '@/src/utils/validatePassword';

const TOTAL_STEPS = 4;

// Update 10 — registration state survives the app being backgrounded/killed
// mid-KYC. Stored in expo-secure-store (not AsyncStorage) because the blob
// contains PII + the password; cleared on success or "Start over".
const REG_STATE_KEY = 'susubox_registration_state';

interface SavedRegistrationState {
  step: number;
  name: string;
  phone: string;
  email: string;
  password: string;
  documentType: DocumentType;
  idNumber: string;
  idImageUrl: string | null;
  selfieUrl: string | null;
  /** Proof the phone was OTP-verified; the register call is refused without it. */
  phoneVerificationToken: string;
}

function StepHeader({ step, label, onBack }: { step: number; label?: string; onBack?: () => void }) {
  return (
    <View>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.headerTitle}>SusuBox</Text>
        <Text style={styles.headerStep}>
          {step === TOTAL_STEPS ? '100% Complete' : `STEP ${step} OF ${TOTAL_STEPS}`}
        </Text>
      </View>
      {label ? <Text style={styles.headerSubLabel}>{label}</Text> : null}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(step / TOTAL_STEPS) * 100}%` },
            step === TOTAL_STEPS && { backgroundColor: Colors.success },
          ]}
        />
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [showResumeBanner, setShowResumeBanner] = useState(false);

  // Step 1 — basic details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Phone OTP — a sub-state of step 1, NOT a new numbered step. Steps 2, 3 and
  // 4 are untouched; the user simply can't leave step 1 until the code checks
  // out, which is also enforced server-side at registration.
  const [showOtp, setShowOtp] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [phoneVerificationToken, setPhoneVerificationToken] = useState('');

  // Steps 2 + 3 — Cloudinary URLs only (never local file paths).
  const [documentType, setDocumentType] = useState<DocumentType>('ghana_card');
  const [idNumber, setIdNumber] = useState('');
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  // Step 4 — T&C
  const [tcAccepted, setTcAccepted] = useState(false);

  // Restore any in-flight registration on mount (Update 10).
  useEffect(() => {
    (async () => {
      try {
        const raw = await SecureStore.getItemAsync(REG_STATE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as SavedRegistrationState;
          setName(saved.name);
          setPhone(saved.phone);
          setEmail(saved.email);
          setPassword(saved.password);
          setDocumentType(saved.documentType);
          // Older drafts (saved before the ID number field existed) have no
          // idNumber — default it rather than writing `undefined` into state.
          setIdNumber(saved.idNumber ?? '');
          setPhoneVerificationToken(saved.phoneVerificationToken ?? '');
          setIdImageUrl(saved.idImageUrl);
          setSelfieUrl(saved.selfieUrl);
          setStep(saved.step);
          setShowResumeBanner(true);
        }
      } catch {
        await SecureStore.deleteItemAsync(REG_STATE_KEY).catch(() => undefined);
      } finally {
        setRestored(true);
      }
    })();
  }, []);

  const persistState = useCallback(
    async (patch: Partial<SavedRegistrationState> = {}) => {
      const state: SavedRegistrationState = {
        step,
        name,
        phone,
        email,
        password,
        documentType,
        idNumber,
        idImageUrl,
        selfieUrl,
        phoneVerificationToken,
        ...patch,
      };
      await SecureStore.setItemAsync(REG_STATE_KEY, JSON.stringify(state)).catch(() => undefined);
    },
    [
      step,
      name,
      phone,
      email,
      password,
      documentType,
      idNumber,
      idImageUrl,
      selfieUrl,
      phoneVerificationToken,
    ],
  );

  const goToStep = (next: number) => {
    // Clear any error from the step being left. Without this, a failure on
    // step 1 stayed in state and reappeared under the Create Account button on
    // step 4 — an error about a phone number, shown against the wrong action.
    setError(null);
    setStep(next);
    persistState({ step: next });
  };

  const startOver = async () => {
    await SecureStore.deleteItemAsync(REG_STATE_KEY).catch(() => undefined);
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setDocumentType('ghana_card');
    setIdNumber('');
    setIdImageUrl(null);
    setSelfieUrl(null);
    setTcAccepted(false);
    setShowResumeBanner(false);
    setShowOtp(false);
    setPhoneVerificationToken('');
    setStep(1);
  };

  // Step 1 → OTP. The code goes to the number typed above, so a mistyped or
  // borrowed number simply never receives one. On success the OTP screen takes
  // over; step 2 is only reachable after it hands back a token.
  const handleStep1Next = async () => {
    if (!step1Valid || sendingOtp) return;
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^0\d{9}$/.test(cleaned)) {
      setError('Enter a valid Ghana phone number — 10 digits starting with 0.');
      return;
    }

    // HUBTEL PENDING: with SMS off, no code could ever arrive, so step 1 goes
    // straight to step 2. The backend skips its matching check while
    // PHONE_OTP_ENABLED=false, and those accounts keep phone_verified: false.
    if (!PHONE_OTP_ENABLED) {
      goToStep(2);
      return;
    }

    // Already verified this exact number in this session (e.g. user stepped
    // back from step 2): don't spend another SMS.
    if (phoneVerificationToken) {
      goToStep(2);
      return;
    }

    setSendingOtp(true);
    setError(null);
    try {
      await sendPhoneOtp(cleaned);
      setShowOtp(true);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(
        isNetworkError(err)
          ? 'Cannot reach the server. Make sure the backend is running and your phone is on the same Wi‑Fi.'
          : (data?.message ?? 'Could not send the verification code. Please try again.'),
      );
    } finally {
      setSendingOtp(false);
    }
  };

  // Mirrors the server policy, so a password that passes here is one the
  // register call will accept. Previously the only client rule was length >= 8,
  // and anything else the server refused surfaced as a failure at the END of a
  // four-step flow — after ID capture and the OTP.
  const passwordCheck = validatePassword(password, { email, phone, full_name: name });

  const step1Valid =
    name.trim().length > 1 && phone.trim().length >= 9 && email.includes('@') && passwordCheck.valid;

  // Step 2 now needs BOTH the card photo and a well-formed ID number.
  const step2Valid = Boolean(idImageUrl) && validateIDNumber(idNumber, documentType) === null;

  const goBack = () => {
    if (step === 1) {
      router.back();
      return;
    }
    goToStep(step - 1);
  };

  const handleFinish = async () => {
    if (!tcAccepted || !idImageUrl || !selfieUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      await register(
        {
          name: name.trim(),
          phone: phone.replace(/[\s\-()]/g, ''),
          email: email.trim(),
          password,
          phoneVerificationToken,
        },
        { documentType, idNumber, idImageUrl, selfieImageUrl: selfieUrl },
      );
      await SecureStore.deleteItemAsync(REG_STATE_KEY).catch(() => undefined);
      // The account now exists and is logged in, but its email is unproven, so
      // every protected route is closed. Go to verification, not the dashboard.
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: email.trim(), name: name.trim() },
      });
    } catch (err) {
      // Surface the real cause instead of a blanket message: a network failure
      // (backend down / wrong LAN IP / firewall) vs. a server response such as
      // "This email is already registered".
      const message = isNetworkError(err)
        ? 'Cannot reach the server. Make sure the backend is running and your phone is on the same Wi‑Fi.'
        : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Something went wrong creating your account. Please try again.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!restored) return <SafeAreaView style={styles.flex} edges={['top', 'bottom']} />;

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {showResumeBanner ? (
          <View style={styles.resumeBanner}>
            <MaterialCommunityIcons name="hand-wave-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.resumeText}>Welcome back — continue where you left off</Text>
            <TouchableOpacity onPress={startOver} hitSlop={8}>
              <Text style={styles.startOverLabel}>Start over</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Phone verification — still step 1 on the progress header, because
            the user has not completed identity capture yet. */}
        {step === 1 && showOtp && (
          <>
            <StepHeader step={1} onBack={() => setShowOtp(false)} />
            <PhoneOTPScreen
              phone={phone.replace(/[\s\-()]/g, '')}
              onVerified={(token) => {
                setPhoneVerificationToken(token);
                setShowOtp(false);
                // setStep, not goToStep, so clear the error explicitly — a
                // failed first send followed by a successful one would
                // otherwise carry its message onto step 2.
                setError(null);
                setStep(2);
                persistState({ step: 2, phoneVerificationToken: token });
              }}
              onBack={() => setShowOtp(false)}
            />
          </>
        )}

        {step === 1 && !showOtp && (
          <>
            <StepHeader step={1} onBack={goBack} />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Join our community of savers and start building your financial future today.
            </Text>

            <TextInput
              mode="outlined"
              label="Full name"
              placeholder="Kwame Mensah"
              value={name}
              onChangeText={setName}
              left={<TextInput.Icon icon="account-outline" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              mode="outlined"
              label="Phone number"
              placeholder="+233 24 000 0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              left={<TextInput.Icon icon="cellphone" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              mode="outlined"
              label="Email address"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              left={<TextInput.Icon icon="email-outline" />}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />
            <TextInput
              mode="outlined"
              label="Password"
              placeholder="Min. 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowPassword((v) => !v)}
                />
              }
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.primary}
            />

            {/* Only once they have started typing — showing a red bar and a
                list of demands on an untouched field is hostile. */}
            {password.length > 0 && (
              <View style={styles.strengthWrap}>
                <View style={styles.strengthTrack}>
                  {[0, 1, 2, 3].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        i < passwordCheck.score && {
                          backgroundColor: passwordCheck.valid
                            ? passwordCheck.score >= 4
                              ? Colors.success
                              : Colors.primary
                            : Colors.danger,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[
                    styles.strengthLabel,
                    { color: passwordCheck.valid ? Colors.textSecondary : Colors.danger },
                  ]}
                >
                  {passwordCheck.label}
                  {passwordCheck.errors.length > 0 ? ` — needs: ${passwordCheck.errors.join(', ')}` : ''}
                </Text>
              </View>
            )}

            <Text style={styles.terms}>
              By tapping Next, you agree to our <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>

            {/* THE BUG. handleStep1Next set `error` correctly on every failure,
                but the only <Text> bound to it lived inside the step 4 block —
                so on step 1 the message had nowhere to render. The spinner
                cleared in the finally, setShowOtp(true) was skipped, and the
                screen simply sat there. "PHONE_TAKEN" and "a code was already
                sent" both arrived with perfectly good copy that no one saw. */}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, (!step1Valid || sendingOtp) && styles.buttonDisabled]}
              disabled={!step1Valid || sendingOtp}
              onPress={handleStep1Next}
              activeOpacity={0.85}
            >
              {sendingOtp ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Text style={styles.buttonLabel}>Next</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" replace>
                <Text style={styles.footerLink}>Log in</Text>
              </Link>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader step={2} onBack={goBack} />
            <Text style={styles.title}>Verify your identity</Text>
            <Text style={styles.subtitle}>
              Choose your document type and capture your {DOCUMENT_LABELS[documentType]} within the frame below.
            </Text>

            <IDCaptureScreen
              documentType={documentType}
              onDocumentTypeChange={(type) => {
                setDocumentType(type);
                // The number format is document-specific, so a type switch
                // invalidates whatever was typed for the previous one.
                setIdNumber('');
                persistState({ documentType: type, idNumber: '' });
              }}
              uploadedUrl={idImageUrl}
              onUploaded={(url) => {
                setIdImageUrl(url);
                persistState({ idImageUrl: url });
              }}
              idNumber={idNumber}
              onIdNumberChange={(value) => {
                setIdNumber(value);
                persistState({ idNumber: value });
              }}
            />

            {/* Same gap as step 1 — `error` had no renderer outside step 4. */}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !step2Valid && styles.buttonDisabled]}
              disabled={!step2Valid}
              onPress={() => goToStep(3)}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonLabel}>Next</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader step={3} label="Identity" onBack={goBack} />
            <Text style={styles.title}>Take a selfie</Text>
            <Text style={styles.subtitle}>Make sure your face is clearly visible and matches your ID.</Text>

            <SelfieScreen
              uploadedUrl={selfieUrl}
              onUploaded={(url) => {
                setSelfieUrl(url);
                persistState({ selfieUrl: url });
              }}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, !selfieUrl && styles.buttonDisabled]}
              disabled={!selfieUrl}
              onPress={() => goToStep(4)}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonLabel}>Next</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.white} />
            </TouchableOpacity>
          </>
        )}

        {step === 4 && (
          <>
            <StepHeader step={4} onBack={goBack} />
            <Text style={styles.title}>Terms & Conditions</Text>
            <Text style={styles.subtitle}>
              Please review our membership agreement and operational policies before finalizing your account.
            </Text>

            <ScrollView style={styles.termsCard} nestedScrollEnabled>
              <Text style={styles.termsIntro}>
                Welcome to SusuBox. By clicking &quot;Create account&quot;, you agree to be bound by the
                following terms and conditions which govern the relationship between you and our communal
                savings platform.
              </Text>

              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Identity Verification</Text>
                <Text style={styles.termsSectionBody}>
                  To ensure the security of our community, all members must undergo mandatory biometric and ID
                  verification. You agree to provide accurate information and acknowledge that failure to
                  verify identity will result in immediate account restriction.
                </Text>
              </View>

              <Text style={styles.termsIntro}>
                Participants must maintain a high Reliability Score. This score is calculated based on
                contribution timeliness and historical participation.
              </Text>

              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Penalty Fees</Text>
                <Text style={styles.termsSectionBody}>
                  Late contributions incur a flat fee of 2.5% per day. These fees are redistributed back into
                  the pool to compensate members whose payouts may be delayed as a result.
                </Text>
              </View>

              <View style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>Payout Rotation</Text>
                <Text style={styles.termsSectionBody}>
                  Payouts follow the agreed rotation order. A group organizer may freeze a payout when a
                  recipient has outstanding arrears until the balance is cleared.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setTcAccepted((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, tcAccepted && styles.checkboxChecked]}>
                {tcAccepted ? <MaterialCommunityIcons name="check" size={14} color={Colors.white} /> : null}
              </View>
              <Text style={styles.checkboxLabel}>
                I have read, understood, and agree to the Terms & Conditions and Privacy Policy.
              </Text>
            </TouchableOpacity>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, (!tcAccepted || submitting) && styles.buttonDisabled]}
              disabled={!tcAccepted || submitting}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonLabel}>{submitting ? 'Creating account…' : 'Create account'}</Text>
            </TouchableOpacity>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 16,
  },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  resumeText: {
    flex: 1,
    color: Colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
  startOverLabel: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  headerStep: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  headerSubLabel: {
    textAlign: 'right',
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    marginTop: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  // Password strength meter — four segments, filled to `score`.
  strengthWrap: { marginTop: -8, marginBottom: 16, gap: 6 },
  strengthTrack: { flexDirection: 'row', gap: 4 },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
  },
  strengthLabel: { fontSize: 11.5, lineHeight: 16 },
  terms: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  footerLink: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  termsCard: {
    maxHeight: 320,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 20,
  },
  termsIntro: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 14,
  },
  termsSection: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  termsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
    marginBottom: 6,
  },
  termsSectionBody: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 19,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});
