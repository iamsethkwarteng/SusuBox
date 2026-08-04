import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isActiveSessionError } from '@/src/api/client';
import { Colors } from '@/src/constants/colors';
import { getCurrentAuthUser, useAuth } from '@/src/hooks/useAuth';
import { getPendingInvite, type PendingInvite } from '@/src/utils/pendingInvite';

export default function LoginScreen() {
  const { login, forceLoginHere } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Update 6 — backend returned 423 ACTIVE_SESSION_EXISTS: offer force logout.
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  // Update 8 — invite code parked by the deep link before login.
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  useEffect(() => {
    getPendingInvite().then(setPendingInvite);
  }, []);

  const canSubmit = email.trim().length > 3 && password.length >= 4 && !submitting;

  const navigateAfterAuth = () => {
    // Registered but never opened the verification link: nothing past this
    // screen would work for them, so send them back to finish verifying. Read
    // the store directly — the hook's own state hasn't re-rendered yet here.
    const authed = getCurrentAuthUser();
    if (authed && authed.emailVerified === false) {
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: authed.email, name: authed.name },
      });
      return;
    }
    // A parked invite wins over the dashboard: resume the join flow with the
    // code pre-filled so the user never re-types it.
    if (pendingInvite) {
      router.replace({ pathname: '/join-group', params: { code: pendingInvite.code } });
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      // Two-step verification on: no session was created, so the PIN screen
      // owns the rest of the login.
      if (result.requires2fa) {
        router.push({
          pathname: '/(auth)/two-fa',
          params: { tempToken: result.tempToken, email: email.trim() },
        });
        return;
      }
      navigateAfterAuth();
    } catch (err) {
      if (isActiveSessionError(err)) {
        setSessionModalVisible(true);
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceLogin = async () => {
    setSessionModalVisible(false);
    setSubmitting(true);
    try {
      const result = await forceLoginHere(email.trim(), password);
      if (result.requires2fa) {
        router.push({
          pathname: '/(auth)/two-fa',
          params: { tempToken: result.tempToken, email: email.trim() },
        });
        return;
      }
      navigateAfterAuth();
    } catch {
      setError('Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {pendingInvite ? (
          <View style={styles.inviteBanner}>
            <MaterialCommunityIcons name="account-group" size={16} color={Colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.inviteText}>
                Log in to join {pendingInvite.groupName ?? 'your group'}
              </Text>
              <Link href="/(auth)/register" replace>
                <Text style={styles.inviteRegisterLink}>New to SusuBox? Register first</Text>
              </Link>
            </View>
          </View>
        ) : null}

        <View style={styles.logoBox}>
          <MaterialCommunityIcons name="hand-coin" size={32} color={Colors.white} />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to continue saving with your group.</Text>

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
          placeholder="Enter your password"
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonLabel}>{submitting ? 'Logging in…' : 'Log in'}</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/register" replace>
            <Text style={styles.footerLink}>Create one</Text>
          </Link>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Update 6 — active session on another device (HTTP 423). */}
      <Modal visible={sessionModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="cellphone-lock" size={36} color={Colors.primary} />
            <Text style={styles.modalTitle}>Already logged in elsewhere</Text>
            <Text style={styles.modalBody}>
              You are already logged in on another device. Force logout that device and continue here?
            </Text>
            <TouchableOpacity style={styles.modalPrimary} onPress={handleForceLogin} activeOpacity={0.85}>
              <Text style={styles.modalPrimaryLabel}>Yes, log me in</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSessionModalVisible(false)} hitSlop={8}>
              <Text style={styles.modalCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 32,
  },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  inviteText: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
  },
  inviteRegisterLink: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    marginBottom: 28,
  },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(44,44,42,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalPrimary: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  modalPrimaryLabel: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  modalCancelLabel: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
    padding: 6,
  },
});
