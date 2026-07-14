import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GroupCard from '@/src/components/GroupCard';
import { GroupCardSkeleton } from '@/src/components/SkeletonLoader';
import { Colors } from '@/src/constants/colors';
import { useGroups } from '@/src/hooks/useGroups';
import type { Group } from '@/src/types';

export default function GroupsScreen() {
  const { groups, isLoading, error, refresh } = useGroups();
  // FAB bottom sheet: "Create a group" or "Join a group".
  const [sheetVisible, setSheetVisible] = useState(false);

  const openGroup = (group: Group) => router.push(`/group/${group.id}`);
  const goCreate = () => {
    setSheetVisible(false);
    router.push('/group/create');
  };
  const goJoin = () => {
    setSheetVisible(false);
    router.push('/join-group');
  };

  const actionButtons = (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.createButton} onPress={goCreate} activeOpacity={0.85}>
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color={Colors.white} />
        <Text style={styles.createLabel}>Create a Group</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.joinButton} onPress={goJoin} activeOpacity={0.85}>
        <MaterialCommunityIcons name="ticket-confirmation-outline" size={18} color={Colors.primary} />
        <Text style={styles.joinLabel}>Join with Invite Code</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
      </View>

      {error ? (
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="wifi-alert" size={28} color={Colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : isLoading && groups.length === 0 ? (
        <View style={styles.listPadding}>
          {actionButtons}
          <GroupCardSkeleton />
          <GroupCardSkeleton />
          <GroupCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listPadding}
          ListHeaderComponent={actionButtons}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={Colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <GroupCard group={item} onPress={openGroup} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIllustration}>
                <MaterialCommunityIcons name="account-group-outline" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>You have no groups yet</Text>
              <Text style={styles.emptyText}>
                Create your own susu circle or join one with an invite code from a friend.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setSheetVisible(true)}>
        <MaterialCommunityIcons name="plus" size={26} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={() => setSheetVisible(false)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setSheetVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>What would you like to do?</Text>
          <TouchableOpacity style={styles.sheetOption} onPress={goCreate} activeOpacity={0.7}>
            <View style={[styles.sheetIcon, { backgroundColor: Colors.primaryLight }]}>
              <MaterialCommunityIcons name="plus-circle-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Create a group</Text>
              <Text style={styles.sheetOptionSub}>Start a new susu circle as the admin</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetOption} onPress={goJoin} activeOpacity={0.7}>
            <View style={[styles.sheetIcon, { backgroundColor: Colors.successLight }]}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={22} color={Colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetOptionTitle}>Join a group</Text>
              <Text style={styles.sheetOptionSub}>Enter an invite code from a member</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  actions: { gap: 10, marginBottom: 18 },
  createButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createLabel: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  joinButton: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  joinLabel: { color: Colors.primary, fontSize: 15, fontWeight: '700' },
  listPadding: { paddingHorizontal: 20, paddingBottom: 100 },
  centerState: { alignItems: 'center', gap: 10, paddingTop: 40, paddingHorizontal: 32 },
  emptyIllustration: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  errorText: { color: Colors.textSecondary, textAlign: 'center', fontSize: 13 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: Colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(44,44,42,0.5)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  sheetOptionSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
