import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { showToast } from '@/src/components/Toast';
import { INVITE_WEB_BASE } from '@/src/constants/api';
import { Colors } from '@/src/constants/colors';

export default function GroupCreatedScreen() {
  const { groupId, groupName, inviteCode } = useLocalSearchParams<{
    groupId: string;
    groupName: string;
    inviteCode: string;
  }>();

  // Large green tick pops in with a spring — celebratory without needing a
  // Lottie dependency.
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
  }, [scale]);

  const copyCode = async () => {
    await Clipboard.setStringAsync(inviteCode ?? '');
    showToast('Copied!');
  };

  const shareInvite = async () => {
    await Share.share({
      message: `I invited you to join ${groupName} on SusuBox! Code: ${inviteCode} Link: ${INVITE_WEB_BASE}/${inviteCode} Download SusuBox to join.`,
    }).catch(() => undefined);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Animated.View style={[styles.tickCircle, { transform: [{ scale }] }]}>
          <MaterialCommunityIcons name="check-bold" size={56} color={Colors.white} />
        </Animated.View>

        <Text style={styles.title}>Group created successfully!</Text>
        <Text style={styles.subtitle}>
          Share the invite code below so members can request to join {groupName}.
        </Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>INVITE CODE</Text>
          <Text style={styles.code}>{inviteCode}</Text>
        </View>

        <TouchableOpacity style={styles.copyButton} onPress={copyCode} activeOpacity={0.8}>
          <MaterialCommunityIcons name="content-copy" size={16} color={Colors.primary} />
          <Text style={styles.copyLabel}>Copy Code</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.shareButton} onPress={shareInvite} activeOpacity={0.85}>
          <MaterialCommunityIcons name="share-variant" size={18} color={Colors.white} />
          <Text style={styles.shareLabel}>Share Invite</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.goButton}
          onPress={() => router.replace(`/group/${groupId}`)}
          activeOpacity={0.85}
        >
          <Text style={styles.goLabel}>Go to Group</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  tickCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  codeBox: {
    marginTop: 32,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 18,
    borderStyle: 'dashed',
    paddingHorizontal: 36,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 6,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  copyLabel: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: 24,
    gap: 12,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareLabel: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  goButton: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  goLabel: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
