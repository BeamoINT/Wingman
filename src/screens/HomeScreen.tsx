import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompanionCard, SafetyBanner } from '../components';
import { useAuth } from '../context/AuthContext';
import { fetchCompanions } from '../services/companionsApi';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Companion, RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 18) return 'Good afternoon,';
  return 'Good evening,';
}

export const HomeScreen: React.FC = () => {
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
          <TouchableOpacity style={styles.quickAction} onPress={async () => await haptics.light()}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(78, 205, 196, 0.15)' }]}>
              <Ionicons name="search" size={20} color={colors.primary.blue} />
            </View>
            <Text style={styles.quickActionText}>Find Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={async () => await haptics.light()}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
              <Ionicons name="calendar" size={20} color={colors.primary.gold} />
            </View>
            <Text style={styles.quickActionText}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={async () => await haptics.light()}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
              <Ionicons name="people" size={20} color={colors.verification.trusted} />
            </View>
            <Text style={styles.quickActionText}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={async () => await haptics.light()}>
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
              <Ionicons name="shield" size={20} color={colors.status.success} />
            </View>
            <Text style={styles.quickActionText}>Safety</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Banner */}
        <TouchableOpacity onPress={handleSubscriptionPress} activeOpacity={0.9}>
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.premiumBanner}
          >
            <View style={styles.premiumContent}>
              <Ionicons name="star" size={24} color={colors.primary.darkBlack} />
              <View style={styles.premiumText}>
                <Text style={styles.premiumTitle}>Upgrade to Premium</Text>
                <Text style={styles.premiumSubtitle}>
                  Unlimited bookings & make real friends
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary.darkBlack} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.blue} />
          </View>
        )}

        {/* Empty State - No Companions */}
        {!isLoading && companions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No companions available yet</Text>
            <Text style={styles.emptySubtitle}>Check back soon for new companions in your area</Text>
          </View>
        )}

        {/* Featured Companion */}
        {featuredCompanion && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Companion</Text>
              <TouchableOpacity onPress={async () => await haptics.light()}>
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
              <TouchableOpacity onPress={async () => await haptics.light()}>
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
                onPress={async () => await haptics.light()}
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

const styles = StyleSheet.create({
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
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  premiumText: {},
  premiumTitle: {
    ...typography.presets.h4,
    color: colors.primary.darkBlack,
  },
  premiumSubtitle: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    opacity: 0.8,
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
