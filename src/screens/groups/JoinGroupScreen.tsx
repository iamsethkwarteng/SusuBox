import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNetworkError } from '@/src/api/client';
import { fetchGroupPreview, requestToJoin } from '@/src/api/groups';
import { Colors } from '@/src/constants/colors';
import type { GroupPreview } from '@/src/types';
import { formatCurrency } from '@/src/utils/formatCurrency';
import { clearPendingInvite } from '@/src/utils/pendingInvite';

// Codes are SUSU-XXXXXX; the screen owns the "SUSU-" prefix so the user only
// types the 6-character suffix (auto-uppercased) and the preview auto-fetches
// the moment the suffix is complete — no button tap needed.
const CODE_PREFIX = 'SUSU-';
const SUFFIX_LENGTH = 6;

type JoinState = 'idle' | 'loadingPreview' | 'previewReady' | 'submitting' | 'pending' | 'error';

// Backend error codes (see src/api/groups.ts requestToJoin) → user messages.
const JOIN_ERRORS: Record<string, string> = {
  ALREADY_MEMBER: 'You are already a member of this group',
  REMOVED_BLOCKED: 'You have been removed from this group and cannot rejoin.',
  GROUP_FULL: 'This group is full — no slots available.',
  REQUEST_PENDING: 'Your request is already pending admin approval.',
};

export default function JoinGroupScreen() {
  const { code: prefillCode } = useLocalSearchParams<{ code?: string }>();
  const [suffix, setSuffix] = useState('');
  const [state, setState] = useState<JoinState>('idle');
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [rulesAgreed, setRulesAgreed] = useState(false);
  const rulesFitViewport = useRef(false);

  const fullCode = `${CODE_PREFIX}${suffix}`;

  const loadPreview = useCallback(async (code: string) => {
    setState('loadingPreview');
    setErrorMessage(null);
    setScrolledToEnd(false);
    setRulesAgreed(false);
    try {
      // BACKEND REQUIRED: GET /api/groups/preview/:inviteCode (public).
      const data = await fetchGroupPreview(code);
      setPreview(data);
      setState('previewReady');
    } catch (error) {
      // Never invent a group from sample data — a user must only ever see a
      // real group they are about to join.
      setErrorMessage(
        isNetworkError(error)
          ? 'Could not reach the server. Check your connection and try again.'
          : 'Invite code not found. Check the code and try again.',
      );
      setState('error');
    }
  }, []);

  // Deep link / post-login prefill.
  useEffect(() => {
    if (prefillCode) {
      const cleaned = prefillCode.toUpperCase().replace(CODE_PREFIX, '').replace(/[^A-Z0-9]/g, '');
      setSuffix(cleaned.slice(0, SUFFIX_LENGTH));
    }
  }, [prefillCode]);

  // Auto-fetch when the suffix is complete.
  useEffect(() => {
    if (suffix.length === SUFFIX_LENGTH) {
      loadPreview(`${CODE_PREFIX}${suffix}`);
    } else {
      setPreview(null);
      if (suffix.length > 0) setState('idle');
    }
  }, [suffix, loadPreview]);

  const handleCodeChange = (text: string) => {
    const cleaned = text.toUpperCase().replace(CODE_PREFIX, '').replace(/[^A-Z0-9]/g, '');
    setSuffix(cleaned.slice(0, SUFFIX_LENGTH));
  };

  const handleRulesScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) {
      setScrolledToEnd(true);
    }
  };

  const handleJoin = async () => {
    if (!rulesAgreed || !preview) return;
    setState('submitting');
    setErrorMessage(null);
    try {
      // Mechanism 7 — persist when this member agreed to this group's rules.
      await SecureStore.setItemAsync(
        `susubox_rules_agreed_${preview.id}`,
        new Date().toISOString(),
      ).catch(() => undefined);

      await requestToJoin(fullCode);
      await clearPendingInvite();
      setState('pending');
    } catch (error) {
      if (isNetworkError(error)) {
        // Never fake a successful join request — the server never received it,
        // so tell the user plainly instead of showing a false "pending" state.
        setErrorMessage('Could not send your request. Check your connection and try again.');
        setState('previewReady');
        return;
      }
      const code = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      if (code === 'ALREADY_MEMBER' && preview.id) {
        await clearPendingInvite();
        router.replace(`/group/${preview.id}`);
        return;
      }
      setErrorMessage(JOIN_ERRORS[code ?? ''] ?? 'Could not send your request. Please try again.');
      setState('previewReady');
    }
  };

  const dismiss = async () => {
    await clearPendingInvite();
    router.back();
  };

  if (state === 'pending') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.pendingWrap}>
          <View style={styles.pendingIcon}>
            <MaterialCommunityIcons name="clock-check-outline" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.pendingTitle}>Request sent!</Text>
          <Text style={styles.pendingBody}>
            Your request has been sent. Waiting for admin approval. We&apos;ll notify you as soon as{' '}
            {preview?.adminName ?? 'the admin'} responds.
          </Text>
          <TouchableOpacity style={styles.pendingButton} onPress={() => router.replace('/(tabs)/groups')}>
            <Text style={styles.pendingButtonLabel}>Back to My Groups</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={dismiss} hitSlop={10}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join a Group</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextInput
          mode="outlined"
          label="Invite code"
          placeholder="SUSU-4K7PQ2"
          value={suffix.length > 0 ? fullCode : ''}
          onChangeText={handleCodeChange}
          autoCapitalize="characters"
          autoCorrect={false}
          left={<TextInput.Icon icon="ticket-confirmation-outline" />}
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.primary}
        />

        {state === 'loadingPreview' ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Finding group…</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {preview && (state === 'previewReady' || state === 'submitting') ? (
          <>
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>{preview.name}</Text>
              <View style={styles.previewRow}>
                <MaterialCommunityIcons name="cash" size={16} color={Colors.textSecondary} />
                <Text style={styles.previewMeta}>
                  {formatCurrency(preview.contributionAmount)} / {preview.frequency === 'weekly' ? 'week' : 'month'}
                </Text>
              </View>
              <View style={styles.previewRow}>
                <MaterialCommunityIcons name="account-multiple-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.previewMeta}>
                  {preview.slotsRemaining} {preview.slotsRemaining === 1 ? 'slot' : 'slots'} remaining
                </Text>
              </View>
              <View style={styles.previewRow}>
                <MaterialCommunityIcons name="shield-account-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.previewMeta}>Admin: {preview.adminName}</Text>
              </View>
            </View>

            <Text style={styles.rulesLabel}>GROUP RULES</Text>
            <ScrollView
              style={styles.rulesBox}
              nestedScrollEnabled
              onScroll={handleRulesScroll}
              scrollEventThrottle={64}
              onContentSizeChange={(w, contentHeight) => {
                // If the rules fit without scrolling there is no "bottom" to
                // reach — unlock the checkbox immediately.
                if (contentHeight <= 150) {
                  rulesFitViewport.current = true;
                  setScrolledToEnd(true);
                }
              }}
            >
              <Text style={styles.rulesText}>{preview.rules}</Text>
              <Text style={styles.rulesEndMark}>— End of rules —</Text>
            </ScrollView>
            {!scrolledToEnd ? (
              <Text style={styles.scrollHint}>Scroll to the bottom of the rules to continue</Text>
            ) : (
              // Mechanism 7 — agreement checkbox only appears after the member
              // has demonstrably seen the full rules.
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setRulesAgreed((v) => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rulesAgreed && styles.checkboxChecked]}>
                  {rulesAgreed ? <MaterialCommunityIcons name="check" size={13} color={Colors.white} /> : null}
                </View>
                <Text style={styles.checkboxLabel}>I have read and agree to the group rules</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.joinButton, (!rulesAgreed || state === 'submitting') && styles.joinButtonDisabled]}
              disabled={!rulesAgreed || state === 'submitting'}
              onPress={handleJoin}
              activeOpacity={0.85}
            >
              {state === 'submitting' ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.joinLabel}>Request to Join</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: Colors.primary },
  container: { padding: 24, paddingBottom: 48 },
  input: {
    backgroundColor: Colors.surface,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: 13 },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 8,
    marginBottom: 20,
  },
  previewName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewMeta: { fontSize: 13, color: Colors.textSecondary },
  rulesLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  rulesBox: {
    maxHeight: 150,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
  },
  rulesText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
  rulesEndMark: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  scrollHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: { flex: 1, fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  joinButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  joinButtonDisabled: { opacity: 0.45 },
  joinLabel: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  pendingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pendingIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pendingTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  pendingBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 21,
  },
  pendingButton: {
    marginTop: 28,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  pendingButtonLabel: { color: Colors.white, fontWeight: '700', fontSize: 14 },
});
