import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { useRequirements } from '../../context/RequirementsContext';
import { RequirementsGate } from '../../components/RequirementsGate';
import type { RootStackParamList } from '../../types';
import type { Group } from '../../types/friends';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock groups
const mockGroups: Group[] = [
  {
    id: '1',
    name: 'SF Hiking Buddies',
    description: 'Weekly hikes around the Bay Area. All skill levels welcome!',
    category: 'outdoor-adventure',
    coverImage: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    memberCount: 234,
    isPublic: true,
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    rules: [],
    admins: [],
    isMember: true,
    isPendingApproval: false,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Foodie Friends',
    description: 'Explore the best restaurants and food trucks in the city together.',
    category: 'food-dining',
    coverImage: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
    memberCount: 567,
    isPublic: true,
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    rules: [],
    admins: [],
    isMember: false,
    isPendingApproval: false,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Book Club SF',
    description: 'Monthly book discussions and author meetups.',
    category: 'book-club',
    coverImage: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600',
    memberCount: 89,
    isPublic: true,
    rules: [],
    admins: [],
    isMember: false,
    isPendingApproval: false,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'Running Buddies',
    description: 'Morning runs, marathon training, and running events.',
    category: 'sports-fitness',
    coverImage: 'https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600',
    memberCount: 156,
    isPublic: true,
    location: { city: 'Oakland', state: 'CA', country: 'USA' },
    rules: [],
    admins: [],
    isMember: true,
    isPendingApproval: false,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'Live Music Lovers',
    description: 'Concert buddies and music festival crew.',
    category: 'music-concerts',
    coverImage: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600',
    memberCount: 312,
    isPublic: true,
    rules: [],
    admins: [],
    isMember: false,
    isPendingApproval: true,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  },
];

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
  const { friendsLimits, friendsUsage, recordGroupJoin, canUseFriendsFeature } = useRequirements();

  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [activeTab, setActiveTab] = useState<'discover' | 'my-groups'>('discover');

  const groupsRemaining = friendsLimits.groupsCanJoin - friendsUsage.groupsJoined;
  const canJoinMore = groupsRemaining > 0 || friendsLimits.groupsCanJoin === 999;

  const myGroups = groups.filter(g => g.isMember);
  const discoverGroups = groups.filter(g => !g.isMember);

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

    await haptics.medium();
    await recordGroupJoin();

    setGroups(groups.map(group =>
      group.id === groupId
        ? { ...group, isMember: true, memberCount: group.memberCount + 1 }
        : group
    ));
  };

  const handleLeaveGroup = async (groupId: string) => {
    await haptics.light();
    setGroups(groups.map(group =>
      group.id === groupId
        ? { ...group, isMember: false, memberCount: group.memberCount - 1 }
        : group
    ));
  };

  const renderGroup = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.groupCard}>
      <Image
        source={{ uri: item.coverImage }}
        style={styles.groupCover}
        resizeMode="cover"
      />
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
            >
              <Text style={styles.leaveButtonText}>Joined</Text>
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
              disabled={!canJoinMore}
            >
              <Text style={styles.joinButtonText}>Join</Text>
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
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'my-groups' ? 'No Groups Yet' : 'No More Groups'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'my-groups'
                ? 'Join groups to connect with people who share your interests'
                : 'Check back later for new groups in your area'}
            </Text>
          </View>
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
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
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
});
