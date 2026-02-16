import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList,
    Image, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RequirementsGate } from '../../components/RequirementsGate';
import { useRequirements } from '../../context/RequirementsContext';
import { fetchFriendGroups, joinFriendGroup, leaveFriendGroup } from '../../services/api/friendsApi';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import type { Group } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'sports-fitness': 'fitness-outline',
  'music-concerts': 'musical-notes-outline',
  'food-dining': 'restaurant-outline',
  'outdoor-adventure': 'trail-sign-outline',
  'arts-culture': 'color-palette-outline',
  'gaming': 'game-controller-outline',
  'book-club': 'book-outline',
  'professional': 'briefcase-outline',
  'travel': 'airplane-outline',
  'pets': 'paw-outline',
  'wellness': 'leaf-outline',
  'language-exchange': 'language-outline',
  'photography': 'camera-outline',
  'tech': 'code-slash-outline',
};

/**
 * GroupsScreen - Browse and join interest-based groups
 * Subscription-gated: Requires Plus tier or higher
 */
const GroupsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    friendsLimits,
    friendsUsage,
    recordGroupJoin,
    canUseFriendsFeature,
    refreshFriendsUsage,
  } = useRequirements();

  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'discover' | 'my-groups'>('discover');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyGroupId, setBusyGroupId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { groups: loadedGroups, error: groupsError } = await fetchFriendGroups();
      if (groupsError) {
        console.error('Error loading friend groups:', groupsError);
        setError('Unable to load groups right now.');
        setGroups([]);
        return;
      }

      setGroups(loadedGroups);
    } catch (loadError) {
      console.error('Error in loadGroups:', loadError);
      setError('Something went wrong while loading groups.');
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const groupsRemaining = friendsLimits.groupsCanJoin === 999
    ? 999
    : Math.max(friendsLimits.groupsCanJoin - friendsUsage.groupsJoined, 0);
  const canJoinMore = groupsRemaining > 0 || friendsLimits.groupsCanJoin === 999;

  const myGroups = useMemo(() => groups.filter((group) => group.isMember), [groups]);
  const discoverGroups = useMemo(() => groups.filter((group) => !group.isMember), [groups]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleJoinGroup = async (groupId: string) => {
    const joinCheck = canUseFriendsFeature('join_group');
    if (!joinCheck.met) {
      navigation.navigate('Subscription');
      return;
    }

    setBusyGroupId(groupId);
    await haptics.medium();

    try {
      const { success, error: joinError } = await joinFriendGroup(groupId);
      if (!success || joinError) {
        console.error('Error joining group:', joinError);
        setError(joinError?.message || 'Unable to join this group right now.');
        return;
      }

      await recordGroupJoin(groupId);
      await refreshFriendsUsage();
      await loadGroups();
    } finally {
      setBusyGroupId(null);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    setBusyGroupId(groupId);
    await haptics.light();

    try {
      const { success, error: leaveError } = await leaveFriendGroup(groupId);
      if (!success || leaveError) {
        console.error('Error leaving group:', leaveError);
        setError(leaveError?.message || 'Unable to leave this group right now.');
        return;
      }

      await refreshFriendsUsage();
      await loadGroups();
    } finally {
      setBusyGroupId(null);
    }
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.groupCard}>
      {item.coverImage ? (
        <Image
          source={{ uri: item.coverImage }}
          style={styles.groupCover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.groupCover, styles.groupCoverFallback]}>
          <Ionicons name="people-outline" size={28} color={colors.text.tertiary} />
        </View>
      )}
      <View style={styles.groupInfo}>
        <View style={styles.groupHeader}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={categoryIcons[item.category] || 'people-outline'}
              size={12}
              color={colors.primary.blue}
            />
          </View>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
        </View>
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.groupFooter}>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={14} color={colors.text.tertiary} />
            <Text style={styles.memberCountText}>{item.memberCount} members</Text>
          </View>
          {item.isMember ? (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={() => handleLeaveGroup(item.id)}
              disabled={busyGroupId === item.id}
            >
              <Text style={styles.leaveButtonText}>
                {busyGroupId === item.id ? 'Updating...' : 'Joined'}
              </Text>
              <Ionicons name="checkmark" size={14} color={colors.status.success} />
            </TouchableOpacity>
          ) : item.isPendingApproval ? (
            <View style={styles.pendingButton}>
              <Text style={styles.pendingButtonText}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, !canJoinMore && styles.joinButtonDisabled]}
              onPress={() => handleJoinGroup(item.id)}
              disabled={!canJoinMore || busyGroupId === item.id}
            >
              <Text style={styles.joinButtonText}>
                {busyGroupId === item.id ? 'Joining...' : 'Join'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.groupsCounter}>
          <Ionicons name="people" size={16} color={colors.primary.blue} />
          <Text style={styles.groupsCountText}>
            {friendsLimits.groupsCanJoin === 999 ? '∞' : groupsRemaining} left
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'discover' && styles.tabActive]}
          onPress={() => setActiveTab('discover')}
        >
          <Text style={[styles.tabText, activeTab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-groups' && styles.tabActive]}
          onPress={() => setActiveTab('my-groups')}
        >
          <Text style={[styles.tabText, activeTab === 'my-groups' && styles.tabTextActive]}>
            My Groups ({myGroups.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Groups List */}
      <FlatList
        data={activeTab === 'discover' ? discoverGroups : myGroups}
        renderItem={renderGroup}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary.blue} />
              <Text style={styles.emptyTitle}>Loading groups...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name={error ? 'alert-circle-outline' : 'people-outline'}
                size={48}
                color={error ? colors.status.error : colors.text.tertiary}
              />
              <Text style={styles.emptyTitle}>
                {error
                  ? 'Unable to Load Groups'
                  : activeTab === 'my-groups'
                    ? 'No Groups Yet'
                    : 'No More Groups'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? error
                  : activeTab === 'my-groups'
                    ? 'Join groups to connect with people who share your interests'
                    : 'Check back later for new groups in your area'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadGroups()}>
                <Text style={styles.retryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
};

export const GroupsScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="friends_groups"
      modalTitle="Upgrade to Join Groups"
    >
      <GroupsContent />
    </RequirementsGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  groupsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  groupsCountText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.radius.full,
    backgroundColor: colors.background.card,
  },
  tabActive: {
    backgroundColor: colors.primary.blue,
  },
  tabText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.screenPadding,
  },
  groupCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
  },
  groupCover: {
    width: '100%',
    height: 120,
  },
  groupCoverFallback: {
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInfo: {
    padding: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    ...typography.presets.h4,
    color: colors.text.primary,
    flex: 1,
  },
  groupDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberCountText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  joinButton: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: '600',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  leaveButtonText: {
    ...typography.presets.caption,
    color: colors.status.success,
    fontWeight: '600',
  },
  pendingButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  pendingButtonText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  separator: {
    height: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
