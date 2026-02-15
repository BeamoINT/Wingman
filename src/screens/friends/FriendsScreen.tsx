import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRequirements } from '../../context/RequirementsContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'matching' | 'feed' | 'groups' | 'events';

interface TabInfo {
  key: TabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: keyof RootStackParamList;
  requiredTier: 'free' | 'plus' | 'premium' | 'elite';
}

const TABS: TabInfo[] = [
  { key: 'matching', label: 'Match', icon: 'heart-outline', screen: 'FriendMatching', requiredTier: 'plus' },
  { key: 'feed', label: 'Feed', icon: 'newspaper-outline', screen: 'SocialFeed', requiredTier: 'plus' },
  { key: 'groups', label: 'Groups', icon: 'people-outline', screen: 'Groups', requiredTier: 'plus' },
  { key: 'events', label: 'Events', icon: 'calendar-outline', screen: 'Events', requiredTier: 'plus' },
];

/**
 * FriendsScreen - Main hub for the "Find New Friends" feature
 * This is a subscription-gated feature
 */
export const FriendsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { friendsLimits, friendsUsage } = useRequirements();

  const [activeTab, setActiveTab] = useState<TabKey>('matching');

  const subscriptionTier = user?.subscriptionTier || 'free';
  const isFreeTier = subscriptionTier === 'free';

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleTabPress = async (tab: TabInfo) => {
    await haptics.light();

    if (isFreeTier) {
      // Free users can only browse - prompt upgrade
      navigation.navigate('Subscription');
      return;
    }

    setActiveTab(tab.key);
    // Navigate to the Friends sub-screens
    switch (tab.screen) {
      case 'FriendMatching':
        navigation.navigate('FriendMatching');
        break;
      case 'SocialFeed':
        navigation.navigate('SocialFeed');
        break;
      case 'Groups':
        navigation.navigate('Groups');
        break;
      case 'Events':
        navigation.navigate('Events');
        break;
    }
  };

  const handleUpgradePress = async () => {
    await haptics.medium();
    navigation.navigate('Subscription');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find New Friends</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Status Banner */}
        {isFreeTier ? (
          <View style={styles.upgradeBanner}>
            <View style={styles.upgradeBannerContent}>
              <Ionicons name="lock-closed" size={24} color={colors.primary.coral} />
              <View style={styles.upgradeBannerText}>
                <Text style={styles.upgradeBannerTitle}>Upgrade to Connect</Text>
                <Text style={styles.upgradeBannerSubtitle}>
                  Subscribe to match with friends, join groups, and more
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePress}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statsBanner}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {friendsLimits.matchesPerMonth === 999
                  ? 'Unlimited'
                  : `${friendsLimits.matchesPerMonth - friendsUsage.matchesThisMonth}`}
              </Text>
              <Text style={styles.statLabel}>Matches Left</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {friendsLimits.groupsCanJoin === 999
                  ? 'Unlimited'
                  : `${friendsLimits.groupsCanJoin - friendsUsage.groupsJoined}`}
              </Text>
              <Text style={styles.statLabel}>Groups Available</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons
                name={friendsLimits.canPost ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={friendsLimits.canPost ? colors.status.success : colors.text.tertiary}
              />
              <Text style={styles.statLabel}>Can Post</Text>
            </View>
          </View>
        )}

        {/* Feature Tabs */}
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabCard,
                activeTab === tab.key && styles.tabCardActive,
                isFreeTier && styles.tabCardLocked,
              ]}
              onPress={() => handleTabPress(tab)}
            >
              <View style={styles.tabIconContainer}>
                <Ionicons
                  name={tab.icon}
                  size={28}
                  color={isFreeTier ? colors.text.tertiary : colors.primary.blue}
                />
                {isFreeTier && (
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={12} color={colors.text.primary} />
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, isFreeTier && styles.tabLabelLocked]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description Section */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>What is Find New Friends?</Text>
          <Text style={styles.descriptionText}>
            Connect with like-minded people in your area for genuine, platonic friendships.
            Unlike companion bookings, this feature helps you build lasting connections
            with people who share your interests.
          </Text>

          <View style={styles.featureList}>
            <FeatureItem
              icon="heart-outline"
              title="Friend Matching"
              description="Swipe to find friends who share your interests"
              locked={isFreeTier}
            />
            <FeatureItem
              icon="newspaper-outline"
              title="Social Feed"
              description="Share updates and stay connected with your friends"
              locked={isFreeTier}
            />
            <FeatureItem
              icon="people-outline"
              title="Interest Groups"
              description="Join groups based on hobbies and activities"
              locked={isFreeTier}
            />
            <FeatureItem
              icon="calendar-outline"
              title="Local Events"
              description="Discover and host meetups in your area"
              locked={isFreeTier}
            />
          </View>
        </View>

        {/* Upgrade CTA for Free Users */}
        {isFreeTier && (
          <TouchableOpacity style={styles.ctaButton} onPress={handleUpgradePress}>
            <Text style={styles.ctaButtonText}>Unlock Friends Features</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.text.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  locked?: boolean;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description, locked }) => (
  <View style={styles.featureItem}>
    <View style={[styles.featureIcon, locked && styles.featureIconLocked]}>
      <Ionicons
        name={icon}
        size={20}
        color={locked ? colors.text.tertiary : colors.primary.blue}
      />
    </View>
    <View style={styles.featureContent}>
      <Text style={[styles.featureTitle, locked && styles.featureTitleLocked]}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
    {locked && (
      <Ionicons name="lock-closed" size={16} color={colors.text.tertiary} />
    )}
  </View>
);

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
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.xl,
  },
  upgradeBanner: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary.coral,
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  upgradeBannerText: {
    flex: 1,
  },
  upgradeBannerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  upgradeBannerSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  upgradeButton: {
    backgroundColor: colors.primary.coral,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.full,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  statsBanner: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  statLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.light,
  },
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  tabCard: {
    width: '47%',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  tabCardActive: {
    borderWidth: 2,
    borderColor: colors.primary.blue,
  },
  tabCardLocked: {
    opacity: 0.6,
  },
  tabIconContainer: {
    position: 'relative',
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  tabLabelLocked: {
    color: colors.text.tertiary,
  },
  descriptionSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  descriptionText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  featureList: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconLocked: {
    backgroundColor: colors.background.tertiary,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureTitleLocked: {
    color: colors.text.tertiary,
  },
  featureDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  ctaButton: {
    backgroundColor: colors.primary.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: spacing.radius.full,
  },
  ctaButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
