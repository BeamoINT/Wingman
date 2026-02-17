import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompanionCard, SafetyBanner } from '../components';
import { useAuth } from '../context/AuthContext';
import { fetchCompanions } from '../services/companionsApi';
import type { Companion, MainTabParamList, RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export const HomeScreen: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [companions, setCompanions] = useState<Companion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const greeting = useMemo(() => getGreeting(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await fetchCompanions();
        if (mounted) setCompanions(data);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const featuredCompanion = companions[0] || null;
  const availableCompanions = companions.slice(1);

  const handleCompanionPress = async (companionId: string) => {
    await haptics.medium();
    navigation.navigate('CompanionProfile', { companionId });
  };

  const handleNotificationsPress = async () => {
    await haptics.light();
    navigation.navigate('Notifications');
  };

  const handleSafetyPress = async () => {
    await haptics.light();
    navigation.navigate('Safety');
  };

  const handleFindNowPress = async () => {
    await haptics.light();
    navigation.navigate('Discover');
  };

  const handleSchedulePress = async () => {
    await haptics.light();
    navigation.navigate('Bookings');
  };

  const handleFriendsPress = async () => {
    await haptics.light();
    navigation.navigate('Friends');
  };

  const handleSeeAllPress = async () => {
    await haptics.light();
    navigation.navigate('Discover');
  };

  const handleCategoryPress = async () => {
    await haptics.light();
    navigation.navigate('Discover');
  };

  const handleSubscriptionPress = async () => {
    await haptics.medium();
    navigation.navigate('Subscription');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user?.firstName || 'there'} 👋</Text>
          </View>
          <TouchableOpacity
            onPress={handleNotificationsPress}
            style={styles.notificationButton}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={handleFindNowPress}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary.blueSoft }]}>
              <Ionicons name="search" size={20} color={colors.primary.blue} />
            </View>
            <Text style={styles.quickActionText}>Find Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleSchedulePress}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary.goldSoft }]}>
              <Ionicons name="calendar" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.quickActionText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleFriendsPress}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.verification.trustedLight }]}>
              <Ionicons name="people" size={20} color={colors.verification.trusted} />
            </View>
            <Text style={styles.quickActionText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={handleSafetyPress}>
            <View style={[styles.quickActionIcon, { backgroundColor: colors.status.successLight }]}>
              <Ionicons name="shield" size={20} color={colors.status.success} />
            </View>
            <Text style={styles.quickActionText}>Safety</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.verificationNotice}>
          <Ionicons name="shield-checkmark" size={16} color={colors.status.success} />
          <Text style={styles.verificationNoticeText}>
            Wingman verifies every member with ID and photo checks before bookings.
          </Text>
        </View>

        {/* Pro Banner */}
        <TouchableOpacity onPress={handleSubscriptionPress} activeOpacity={0.9} style={styles.premiumBanner}>
          <View style={styles.premiumContent}>
            <View style={styles.premiumIconWrap}>
              <Ionicons name="star" size={18} color={colors.accent.primary} />
            </View>
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle} numberOfLines={1}>Upgrade to Pro</Text>
              <Text style={styles.premiumSubtitle} numberOfLines={2}>
                Friends matching, requests, groups, and events
              </Text>
            </View>
          </View>
          <View style={styles.premiumChevronWrap}>
            <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
          </View>
        </TouchableOpacity>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.blue} />
          </View>
        )}

        {/* Empty State - No Wingmen */}
        {!isLoading && companions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No wingmen available yet</Text>
            <Text style={styles.emptySubtitle}>Check back soon for new wingmen in your area</Text>
          </View>
        )}

        {/* Featured Wingman */}
        {featuredCompanion && (
          <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Wingman</Text>
            <TouchableOpacity onPress={handleSeeAllPress}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
            <CompanionCard
              companion={featuredCompanion}
              variant="featured"
              onPress={() => handleCompanionPress(featuredCompanion.id)}
            />
          </View>
        )}

        {/* Safety Banner */}
        <View style={styles.section}>
          <SafetyBanner onPress={handleSafetyPress} />
        </View>

        {/* Available Now */}
        {availableCompanions.length > 0 && (
          <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Now</Text>
            <TouchableOpacity onPress={handleSeeAllPress}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
            <View style={styles.companionGrid}>
              {availableCompanions.map((companion) => (
                <CompanionCard
                  key={companion.id}
                  companion={companion}
                  onPress={() => handleCompanionPress(companion.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse by Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {[
              { icon: 'restaurant', label: 'Dining', color: colors.primary.gold },
              { icon: 'wine', label: 'Nightlife', color: colors.verification.trusted },
              { icon: 'cafe', label: 'Coffee', color: colors.primary.blue },
              { icon: 'film', label: 'Movies', color: colors.status.error },
              { icon: 'fitness', label: 'Workout', color: colors.status.success },
              { icon: 'business', label: 'Networking', color: colors.status.info },
            ].map((category, index) => (
              <TouchableOpacity
                key={index}
                style={styles.categoryCard}
                onPress={handleCategoryPress}
              >
                <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
                  <Ionicons name={category.icon as any} size={24} color={category.color} />
                </View>
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  name: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  quickAction: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: spacing.radius.xl,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  verificationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.successLight,
    borderRadius: spacing.radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  verificationNoticeText: {
    ...typography.presets.bodySmall,
    color: colors.status.success,
    flex: 1,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
    minWidth: 0,
  },
  premiumIconWrap: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.soft,
  },
  premiumText: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  premiumTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  premiumSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  premiumChevronWrap: {
    width: 30,
    height: 30,
    borderRadius: spacing.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.level2,
    marginLeft: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.massive,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.massive,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  emptySubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  seeAllText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  categoriesContent: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  categoryCard: {
    alignItems: 'center',
    gap: spacing.sm,
    marginRight: spacing.md,
  },
  categoryIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
});
