import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header, PillTabs, RequirementsGate, ScreenScaffold, SectionHeader } from '../../components';
import { useRequirements } from '../../context/RequirementsContext';
import { useTheme } from '../../context/ThemeContext';
import { fetchFriendGroups, joinFriendGroup, leaveFriendGroup } from '../../services/api/friendsApi';
import { getOrCreateGroupConversation } from '../../services/api/messages';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
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
  gaming: 'game-controller-outline',
  'book-club': 'book-outline',
  professional: 'briefcase-outline',
  travel: 'airplane-outline',
  pets: 'paw-outline',
  wellness: 'leaf-outline',
  'language-exchange': 'language-outline',
  photography: 'camera-outline',
  tech: 'code-slash-outline',
};

const GroupsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
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
    void loadGroups();
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

  const handleOpenGroupChat = async (groupId: string) => {
    await haptics.light();
    const { conversation, error: conversationError } = await getOrCreateGroupConversation(groupId);
    if (conversationError || !conversation?.id) {
      setError(conversationError?.message || 'Unable to open group chat right now.');
      return;
    }

    navigation.navigate('Chat', { conversationId: conversation.id });
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.groupCard} activeOpacity={0.9}>
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.groupCover} resizeMode="cover" />
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
              color={colors.accent.primary}
            />
          </View>
          <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
        </View>
        <Text style={styles.groupDescription} numberOfLines={2}>{item.description}</Text>
        <View style={styles.groupFooter}>
          <View style={styles.memberCount}>
            <Ionicons name="people" size={14} color={colors.text.tertiary} />
            <Text style={styles.memberCountText}>{item.memberCount} members</Text>
          </View>
          {item.isMember ? (
            <View style={styles.memberActions}>
              <TouchableOpacity style={styles.chatButton} onPress={() => handleOpenGroupChat(item.id)}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent.primary} />
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={() => {
                  void handleLeaveGroup(item.id);
                }}
                disabled={busyGroupId === item.id}
              >
                <Text style={styles.leaveButtonText}>{busyGroupId === item.id ? 'Updating...' : 'Joined'}</Text>
                <Ionicons name="checkmark" size={14} color={colors.status.success} />
              </TouchableOpacity>
            </View>
          ) : item.isPendingApproval ? (
            <View style={styles.pendingButton}>
              <Text style={styles.pendingButtonText}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.joinButton, !canJoinMore && styles.joinButtonDisabled]}
              onPress={() => {
                void handleJoinGroup(item.id);
              }}
              disabled={!canJoinMore || busyGroupId === item.id}
            >
              <Text style={styles.joinButtonText}>{busyGroupId === item.id ? 'Joining...' : 'Join'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header title="Groups" showBack onBackPress={handleBackPress} transparent />

      <View style={styles.innerContent}>
        <SectionHeader
          title="Community Groups"
          subtitle={friendsLimits.groupsCanJoin === 999 ? 'Unlimited joins available' : `${groupsRemaining} joins remaining this month`}
        />

        <PillTabs
          items={[
            { id: 'discover', label: 'Discover' },
            { id: 'my-groups', label: 'My Groups', count: myGroups.length },
          ]}
          activeId={activeTab}
          onChange={(value) => setActiveTab(value as 'discover' | 'my-groups')}
        />

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
                <ActivityIndicator size="large" color={colors.accent.primary} />
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
                <TouchableOpacity style={styles.retryButton} onPress={() => {
                  void loadGroups();
                }}>
                  <Text style={styles.retryButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </View>
    </ScreenScaffold>
  );
};

export const GroupsScreen: React.FC = () => {
  return (
    <RequirementsGate feature="friends_groups" modalTitle="Upgrade to Join Groups">
      <GroupsContent />
    </RequirementsGate>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.level0,
  },
  innerContent: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.massive,
  },
  groupCard: {
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  groupCover: {
    width: '100%',
    height: 120,
  },
  groupCoverFallback: {
    backgroundColor: colors.surface.level2,
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
    backgroundColor: colors.accent.soft,
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
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  chatButtonText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
    fontWeight: typography.weights.semibold,
  },
  joinButton: {
    backgroundColor: colors.accent.primary,
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
    fontWeight: typography.weights.semibold,
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  leaveButtonText: {
    ...typography.presets.caption,
    color: colors.status.success,
    fontWeight: typography.weights.semibold,
  },
  pendingButton: {
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pendingButtonText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontWeight: typography.weights.semibold,
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
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
