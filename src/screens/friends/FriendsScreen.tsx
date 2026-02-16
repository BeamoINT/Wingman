import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FriendFeatureCard = {
  key: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: keyof RootStackParamList;
  previewAccessible: boolean;
};

const FEATURE_CARDS: FriendFeatureCard[] = [
  {
    key: 'matching',
    title: 'Match',
    description: 'View ranked profiles and connect with relevant friends.',
    icon: 'people-outline',
    route: 'FriendMatching',
    previewAccessible: true,
  },
  {
    key: 'requests',
    title: 'Requests',
    description: 'Accept or decline incoming connection requests.',
    icon: 'mail-outline',
    route: 'FriendRequests',
    previewAccessible: false,
  },
  {
    key: 'feed',
    title: 'Feed',
    description: 'Share updates and stay connected with your friend circle.',
    icon: 'newspaper-outline',
    route: 'SocialFeed',
    previewAccessible: false,
  },
  {
    key: 'groups',
    title: 'Groups',
    description: 'Join interest-based communities and group chats.',
    icon: 'people-circle-outline',
    route: 'Groups',
    previewAccessible: false,
  },
  {
    key: 'events',
    title: 'Events',
    description: 'RSVP to local events and open event group chats.',
    icon: 'calendar-outline',
    route: 'Events',
    previewAccessible: false,
  },
];

export const FriendsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { user } = useAuth();

  const isPro = user?.subscriptionTier === 'pro';

  const handleOpenFeature = async (feature: FriendFeatureCard) => {
    await haptics.light();
    if (!isPro && !feature.previewAccessible) {
      navigation.navigate('Subscription');
      return;
    }

    switch (feature.route) {
      case 'FriendMatching':
        navigation.navigate('FriendMatching');
        break;
      case 'FriendRequests':
        navigation.navigate('FriendRequests');
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
      default:
        break;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <TouchableOpacity style={styles.requestsButton} onPress={() => handleOpenFeature(FEATURE_CARDS[1])}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={isPro ? colors.primary.blue : colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>

        <Card variant="accent" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusIconWrap}>
              <Ionicons
                name={isPro ? 'sparkles' : 'eye-outline'}
                size={20}
                color={isPro ? colors.accent.primary : colors.text.secondary}
              />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle}>
                {isPro ? 'Pro Active' : 'Free Preview Mode'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isPro
                  ? 'You have full access to matching, requests, feed, groups, and events.'
                  : 'Browse ranked profiles for free. Upgrade to Pro to send requests and unlock all Friends features.'}
              </Text>
            </View>
          </View>
          {!isPro ? (
            <TouchableOpacity style={styles.upgradeButton} onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
        </Card>

        <View style={styles.grid}>
          {FEATURE_CARDS.map((feature) => {
            const locked = !isPro && !feature.previewAccessible;

            return (
              <TouchableOpacity
                key={feature.key}
                style={styles.featureCard}
                onPress={() => handleOpenFeature(feature)}
                activeOpacity={0.85}
              >
                <View style={styles.featureHeader}>
                  <View style={[styles.featureIcon, locked && styles.featureIconLocked]}>
                    <Ionicons
                      name={feature.icon}
                      size={20}
                      color={locked ? colors.text.tertiary : colors.primary.blue}
                    />
                  </View>
                  {locked ? (
                    <Ionicons name="lock-closed" size={14} color={colors.text.tertiary} />
                  ) : null}
                </View>
                <Text style={[styles.featureTitle, locked && styles.featureTitleLocked]}>
                  {feature.title}
                </Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </TouchableOpacity>
            );
          })}
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
    paddingBottom: spacing.massive,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  requestsButton: {
    width: 42,
    height: 42,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  statusTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  statusSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.full,
    paddingVertical: spacing.sm,
  },
  upgradeButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureCard: {
    width: '48%',
    minHeight: 180,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.background.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconLocked: {
    backgroundColor: colors.surface.level1,
  },
  featureTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  featureTitleLocked: {
    color: colors.text.secondary,
  },
  featureDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
