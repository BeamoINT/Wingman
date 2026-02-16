import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Card, Header, ScreenScaffold, SectionHeader } from '../../components';
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
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors, spacing } = tokens;
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  const isPro = user?.subscriptionTier === 'pro';
  const numColumns = width >= 980 ? 3 : 2;
  const contentWidth = Math.min(width, spacing.contentMaxWidthWide) - (spacing.screenPadding * 2);
  const cardWidth = numColumns === 3
    ? (contentWidth - (spacing.md * 2)) / 3
    : (contentWidth - spacing.md) / 2;

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
    <ScreenScaffold withBottomPadding={false}>
      <Header
        title="Friends"
        rightIcon="mail-outline"
        onRightPress={() => handleOpenFeature(FEATURE_CARDS[1])}
        transparent
      />

      <FlatList
        key={`friends-grid-${numColumns}`}
        data={FEATURE_CARDS}
        keyExtractor={(item) => item.key}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <SectionHeader
              title={isPro ? 'Pro Active' : 'Free Preview Mode'}
              subtitle={
                isPro
                  ? 'You have full access to matching, requests, feed, groups, and events.'
                  : 'Browse ranked profiles for free. Upgrade to Pro to send requests and unlock all Friends features.'
              }
            />

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
                  <Text style={styles.statusTitle}>{isPro ? 'Pro Active' : 'Free Preview Mode'}</Text>
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
                  <Ionicons name="arrow-forward" size={16} color={colors.text.onAccent} />
                </TouchableOpacity>
              ) : null}
            </Card>
          </View>
        )}
        renderItem={({ item: feature }) => {
          const locked = !isPro && !feature.previewAccessible;

          return (
            <TouchableOpacity
              style={[styles.featureCard, { width: cardWidth }]}
              onPress={() => handleOpenFeature(feature)}
              activeOpacity={0.85}
            >
              <View style={styles.featureHeader}>
                <View style={[styles.featureIcon, locked && styles.featureIconLocked]}>
                  <Ionicons
                    name={feature.icon}
                    size={20}
                    color={locked ? colors.text.tertiary : colors.accent.primary}
                  />
                </View>
                {locked ? <Ionicons name="lock-closed" size={14} color={colors.text.tertiary} /> : null}
              </View>

              <Text style={[styles.featureTitle, locked && styles.featureTitleLocked]}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  content: {
    paddingBottom: spacing.massive,
    gap: spacing.md,
  },
  listHeader: {
    gap: spacing.lg,
    marginBottom: spacing.md,
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
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingVertical: spacing.sm,
  },
  upgradeButtonText: {
    ...typography.presets.button,
    color: colors.text.onAccent,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  featureCard: {
    minHeight: 180,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
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
    backgroundColor: colors.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconLocked: {
    backgroundColor: colors.surface.level2,
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
