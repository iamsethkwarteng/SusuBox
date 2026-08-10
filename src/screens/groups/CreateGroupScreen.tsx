import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
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
import { createGroup } from '@/src/api/groups';
import { Colors } from '@/src/constants/colors';
import { useAuth } from '@/src/hooks/useAuth';
import { refreshGroups } from '@/src/hooks/useGroups';
import type { GroupFrequency } from '@/src/types';

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<GroupFrequency>('weekly');
  const [maxMembers, setMaxMembers] = useState('');
  const [penaltyFee, setPenaltyFee] = useState('0');
  const [gracePeriod, setGracePeriod] = useState('3');
  const [rules, setRules] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const maxMembersNum = Number(maxMembers);
  const isValid = name.trim().length > 0 && amountNum > 0 && maxMembersNum > 1;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // BACKEND REQUIRED: POST /api/groups auto-generates the SUSU-XXXXXX
      // invite code + link and adds the creator as admin, payout_position 1.
      const group = await createGroup({
        name: name.trim(),
        contributionAmount: amountNum,
        frequency,
        maxMembers: maxMembersNum,
        penaltyFee: Number(penaltyFee) || 0,
        gracePeriodDays: Number(gracePeriod) || 3,
        rules: rules.trim() || undefined,
      });
      // Pull the new group into the shared list BEFORE navigating. useGroups
      // holds module-level state that is fetched once at bootstrap and never
      // again, so without this the group the user just created was missing from
      // the Groups tab until they pulled to refresh — which reads as a failed
      // creation even though the server accepted it.
      //
      // Deliberately not awaited: the confirmation screen should appear at
      // once, and the refetch has landed long before the user backs out of it.
      // Silent so it cannot blank the list if this one request fails.
      refreshGroups({ silent: true }).catch(() => {});

      router.replace({
        pathname: '/group/created',
        params: { groupId: group.id, groupName: group.name, inviteCode: group.inviteCode },
      });
    } catch (err) {
      // Never fabricate an invite code: the group was NOT created on the
      // server, so a locally-made code would send members to a group that
      // does not exist. Surface the real failure instead.
      setError(
        isNetworkError(err)
          ? 'Could not reach the server. Check your connection and try again.'
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            'Could not create the group. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create a Group</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TextInput
            mode="outlined"
            label="Group name *"
            placeholder="Adum Market Ladies"
            value={name}
            onChangeText={setName}
            // Matches the server cap, so the limit is felt as the field simply
            // stopping rather than as a rejection after tapping Create.
            maxLength={100}
            left={<TextInput.Icon icon="account-group-outline" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          <TextInput
            mode="outlined"
            label="Contribution amount (GHS) *"
            placeholder="100"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            left={<TextInput.Icon icon="cash" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.toggleRow}>
            {(['weekly', 'monthly'] as GroupFrequency[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.toggle, frequency === f && styles.toggleActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[styles.toggleLabel, frequency === f && styles.toggleLabelActive]}>
                  {f === 'weekly' ? 'Weekly' : 'Monthly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            mode="outlined"
            label="Max members *"
            placeholder="10"
            value={maxMembers}
            onChangeText={setMaxMembers}
            keyboardType="numeric"
            left={<TextInput.Icon icon="account-multiple-outline" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          <TextInput
            mode="outlined"
            label="Penalty fee per late cycle (GHS)"
            placeholder="0"
            value={penaltyFee}
            onChangeText={setPenaltyFee}
            keyboardType="numeric"
            left={<TextInput.Icon icon="alert-circle-outline" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          <TextInput
            mode="outlined"
            label="Grace period (days)"
            placeholder="3"
            value={gracePeriod}
            onChangeText={setGracePeriod}
            keyboardType="numeric"
            left={<TextInput.Icon icon="calendar-clock" />}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          <TextInput
            mode="outlined"
            label="Group rules (optional)"
            placeholder="Contributions due every Friday by 6 PM…"
            value={rules}
            onChangeText={setRules}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.rulesInput]}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.primary}
          />

          {/* Payment account (optional) — member contributions collect into an
              account settled to the admin's MoMo. The subaccount is created from
              your saved MoMo when the group is created; add it first to enable
              in-app payments (you can also add it later in Settings). */}
          <Text style={styles.sectionHeader}>Payment Account (Optional)</Text>
          {user?.momoNumber ? (
            <View style={[styles.momoBox, styles.momoBoxOk]}>
              <MaterialCommunityIcons name="check-decagram" size={20} color={Colors.success} />
              <Text style={styles.momoOkText}>
                In-app payments enabled — contributions settle to your {user.momoNetwork} ****
                {user.momoNumber.slice(-4)}.
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.momoBox, styles.momoBoxWarn]}
              activeOpacity={0.85}
              onPress={() => router.push('/momo-setup')}
            >
              <MaterialCommunityIcons name="cellphone-cog" size={20} color={Colors.warning} />
              <Text style={styles.momoWarnText}>
                Add your MoMo number to collect contributions in-app. Tap to set it up (optional — you
                can also add it later in Settings).
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.warning} />
            </TouchableOpacity>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (!isValid || submitting) && styles.buttonDisabled]}
            disabled={!isValid || submitting}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color={Colors.white} />
            <Text style={styles.buttonLabel}>{submitting ? 'Creating…' : 'Create Group'}</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            You will be the group admin. An invite code is generated automatically so members can join.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
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
    marginBottom: 14,
  },
  rulesInput: {
    minHeight: 100,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleLabelActive: {
    color: Colors.white,
  },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 10, marginTop: 4 },
  momoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  momoBoxOk: { backgroundColor: Colors.successLight, borderColor: Colors.success },
  momoBoxWarn: { backgroundColor: Colors.warningLight, borderColor: Colors.warning },
  momoOkText: { flex: 1, fontSize: 12.5, color: Colors.success, lineHeight: 18, fontWeight: '600' },
  momoWarnText: { flex: 1, fontSize: 12.5, color: Colors.warning, lineHeight: 18 },
  error: {
    color: Colors.danger,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonLabel: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 17,
  },
});
