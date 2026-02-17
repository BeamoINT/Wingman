import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Header, Rating, SafetyBanner, ScreenScaffold, SectionHeader } from '../components';
import { useFeatureGate } from '../components/RequirementsGate';
import { useTheme } from '../context/ThemeContext';
import { blockUser } from '../services/api/blocksApi';
import type { CompanionData } from '../services/api/companions';
import { fetchCompanionById, fetchCompanionReviews } from '../services/api/companions';
import { getOrCreateConversation } from '../services/api/messages';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Companion, LegalDocumentType, RootStackParamList, VerificationLevel } from '../types';
import { haptics } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'CompanionProfile'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CompanionReview {
  id: string;
  name: string;
  rating: number;
  date: string;
  comment: string;
}

function formatReviewDate(dateString?: string): string {
  if (!dateString) return '';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function transformCompanionData(data: CompanionData): Companion {
  const hasIdVerification = !!data.user?.id_verified;
  const verificationLevel: VerificationLevel = data.user?.verification_level === 'premium'
    ? 'premium'
    : data.user?.verification_level === 'verified' || hasIdVerification
      ? 'verified'
      : 'basic';

  return {
    id: data.id,
    user: {
      id: data.user_id,
      firstName: data.user?.first_name || '',
      lastName: data.user?.last_name || '',
      email: data.user?.email || '',
      avatar: data.user?.avatar_url || undefined,
      bio: data.user?.bio || undefined,
      isVerified: (
        verificationLevel === 'verified'
        || verificationLevel === 'premium'
        || !!data.user?.id_verified
      ),
      isPremium: (data.user?.subscription_tier || 'free') !== 'free',
      createdAt: data.user?.created_at || data.created_at,
      location: data.user?.city ? {
        city: data.user.city,
        state: data.user?.state || undefined,
        country: data.user?.country || 'USA',
      } : undefined,
    },
    rating: toNumber(data.rating, 0),
    reviewCount: Math.max(0, Math.round(toNumber(data.review_count, 0))),
    hourlyRate: Math.max(0, toNumber(data.hourly_rate, 0)),
    specialties: toStringArray(data.specialties) as Companion['specialties'],
    languages: toStringArray(data.languages),
    availability: [],
    isOnline: typeof data.is_available === 'boolean' ? data.is_available : true,
    responseTime: data.response_time || 'Usually responds within 1 hour',
    completedBookings: Math.max(0, Math.round(toNumber(data.completed_bookings, 0))),
    badges: [],
    gallery: toStringArray(data.gallery),
    about: data.about || '',
    interests: [],
    verificationLevel,
  };
}

function transformReviewData(rawReview: any): CompanionReview | null {
  if (!rawReview || typeof rawReview !== 'object') return null;

  const reviewer = rawReview.reviewer || {};
  const reviewerName = `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() || 'Verified User';
  const fallbackReviewId = `${reviewerName}-${rawReview.created_at || ''}-${rawReview.rating || ''}`;

  return {
    id: String(rawReview.id || fallbackReviewId),
    name: reviewerName,
    rating: Math.max(1, Math.min(5, toNumber(rawReview.rating, 5))),
    date: formatReviewDate(rawReview.created_at) || 'Recent',
    comment: typeof rawReview.comment === 'string' ? rawReview.comment : '',
  };
}

export const CompanionProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors, spacing } = tokens;
  const [isFavorite, setIsFavorite] = useState(false);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [reviews, setReviews] = useState<CompanionReview[]>([]);
  const [isLoadingCompanion, setIsLoadingCompanion] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { checkBooking } = useFeatureGate();

  const loadCompanion = useCallback(async () => {
    setIsLoadingCompanion(true);
    setLoadError(null);

    try {
      const { companion: companionData, error } = await fetchCompanionById(route.params.companionId);

      if (error || !companionData) {
        console.error('Error fetching companion profile:', error);
        setLoadError('Unable to load this wingman right now.');
        setCompanion(null);
        setReviews([]);
        return;
      }

      setCompanion(transformCompanionData(companionData));

      const { reviews: reviewData, error: reviewError } = await fetchCompanionReviews(route.params.companionId);
      if (reviewError) {
        console.error('Error fetching companion reviews:', reviewError);
      }

      const transformedReviews = (reviewData || [])
        .map(transformReviewData)
        .filter((review): review is CompanionReview => review !== null && !!review.comment);

      setReviews(transformedReviews);
    } catch (error) {
      console.error('Unexpected error loading companion profile:', error);
      setLoadError('Unable to load this wingman right now.');
      setCompanion(null);
      setReviews([]);
    } finally {
      setIsLoadingCompanion(false);
    }
  }, [route.params.companionId]);

  useEffect(() => {
    loadCompanion();
  }, [loadCompanion]);

  /**
   * Handle book press with requirement validation
   * SECURITY: Validates all booking requirements before navigating to booking screen
   */
  const handleBookPress = useCallback(async () => {
    await haptics.medium();

    if (!companion) {
      return;
    }

    // Check if all booking requirements are met
    const { allowed, unmetRequirements } = checkBooking();

    if (!allowed && unmetRequirements.length > 0) {
      const firstUnmet = unmetRequirements[0];

      await haptics.warning();

      Alert.alert(
        'Complete Requirements First',
        firstUnmet.requirement,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: firstUnmet.action || 'Complete',
            onPress: () => {
              // Navigate to the appropriate screen to complete the requirement
              if (firstUnmet.navigateTo === 'Verification') {
                navigation.navigate('Verification', { source: 'requirements' });
              } else if (firstUnmet.navigateTo === 'VerifyPhone') {
                navigation.navigate('VerifyPhone', { source: 'requirements' });
              } else if (firstUnmet.navigateTo === 'Subscription') {
                navigation.navigate('Subscription');
              } else if (firstUnmet.navigateTo === 'SignIn') {
                navigation.navigate('SignIn');
              } else if (firstUnmet.navigateTo === 'LegalDocument') {
                navigation.navigate('LegalDocument', { documentType: 'terms-of-service' as LegalDocumentType });
              } else if (firstUnmet.navigateTo === 'EditProfile') {
                navigation.navigate('EditProfile');
              }
            },
          },
        ]
      );
      return;
    }

    // All requirements met, proceed to booking
    navigation.navigate('Booking', { companionId: companion.id });
  }, [navigation, companion?.id, checkBooking]);

  const handleMessagePress = async () => {
    if (!companion) {
      return;
    }

    if (!companion.user.id) {
      Alert.alert('Unavailable', 'Messaging is unavailable for this wingman right now.');
      return;
    }

    const { conversation, error } = await getOrCreateConversation(companion.user.id);
    if (error || !conversation?.id) {
      console.error('Error creating/opening conversation:', error);
      Alert.alert('Message Failed', 'Unable to open chat right now.');
      return;
    }

    await haptics.light();
    navigation.navigate('Chat', { conversationId: conversation.id });
  };

  const handleFavoritePress = async () => {
    await haptics.selection();
    setIsFavorite(!isFavorite);
  };

  const handleBlockUserPress = useCallback(() => {
    if (!companion?.user.id || isBlockingUser) {
      return;
    }

    const displayName = `${companion.user.firstName || 'this'} ${companion.user.lastName || 'user'}`.trim();

    Alert.alert(
      'Block User',
      `Block ${displayName}? You will no longer see each other in Discover, bookings, messages, or search.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsBlockingUser(true);
              await haptics.warning();

              const { success, error } = await blockUser(companion.user.id);
              setIsBlockingUser(false);

              if (!success || error) {
                Alert.alert('Unable to Block', 'Unable to complete this action right now.');
                return;
              }

              navigation.goBack();
            })();
          },
        },
      ],
    );
  }, [companion?.user.firstName, companion?.user.id, companion?.user.lastName, isBlockingUser, navigation]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const getSpecialtyLabel = (specialty: string): string => {
    const labels: Record<string, string> = {
      'social-events': 'Social Events',
      'dining': 'Dining',
      'nightlife': 'Nightlife',
      'movies': 'Movies',
      'concerts': 'Concerts',
      'sports': 'Sports',
      'outdoor-activities': 'Outdoors',
      'shopping': 'Shopping',
      'travel': 'Travel',
      'coffee-chat': 'Coffee',
      'workout-buddy': 'Workout',
      'professional-networking': 'Networking',
      'emotional-support': 'Support',
      'safety-companion': 'Safety',
    };
    return labels[specialty] || specialty;
  };

  if (isLoadingCompanion) {
    return (
      <ScreenScaffold>
        <Header title="Wingman Profile" showBack onBackPress={handleBackPress} transparent />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.loadingText}>Loading wingman profile...</Text>
        </View>
      </ScreenScaffold>
    );
  }

  if (loadError || !companion) {
    return (
      <ScreenScaffold>
        <Header title="Wingman Profile" showBack onBackPress={handleBackPress} transparent />
        <View style={styles.loadingScreen}>
          <Ionicons name="alert-circle" size={36} color={colors.status.error} />
          <Text style={styles.errorTextCentered}>
            {loadError || 'Wingman profile is unavailable.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadCompanion()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header
        title="Wingman Profile"
        showBack
        onBackPress={handleBackPress}
        transparent
        rightComponent={(
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerButton} onPress={() => haptics.light()}>
              <Ionicons name="share-outline" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleBlockUserPress} disabled={isBlockingUser}>
              <Ionicons name="ellipsis-vertical" size={20} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleFavoritePress}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? colors.status.error : colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        )}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          {companion.user.avatar ? (
            <Image
              source={{ uri: companion.user.avatar }}
              style={styles.heroImage}
            />
          ) : (
            <View style={styles.heroImageFallback}>
              <Ionicons name="person" size={80} color={colors.text.tertiary} />
            </View>
          )}

          {/* Online Status */}
          {companion.isOnline && (
            <View style={styles.onlineIndicator}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Online Now</Text>
            </View>
          )}
        </View>

        {/* Profile Content */}
        <View style={styles.content}>
          {/* Name & Basic Info */}
          <View style={styles.basicInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>
                {companion.user.firstName} {companion.user.lastName?.charAt(0)}.
              </Text>
              {companion.verificationLevel === 'premium' && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={14} color={colors.primary.gold} />
                </View>
              )}
            </View>
            <Text style={styles.location}>
              <Ionicons name="location" size={14} color={colors.text.tertiary} />
              {' '}
              {companion.user.location?.city
                ? `${companion.user.location.city}${companion.user.location?.state ? `, ${companion.user.location.state}` : ''}`
                : 'Location unavailable'}
            </Text>
            <View style={styles.ratingRow}>
              <Rating rating={companion.rating} reviewCount={companion.reviewCount} />
              <Text style={styles.completedText}>
                {companion.completedBookings} bookings completed
              </Text>
            </View>
          </View>

          {/* Verification Badges */}
          <View style={styles.verificationRow}>
            <Badge label="ID Verified" variant="verified" icon="checkmark-circle" />
            <Badge label="Photo Verified" variant="verified" icon="camera" />
            {companion.verificationLevel === 'premium' && (
              <Badge label="Premium" variant="premium" icon="star" />
            )}
          </View>
          <Text style={styles.verificationNote}>Wingman verifies identity and profile photos before bookings.</Text>

          {/* Specialties */}
          {companion.specialties.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Specialties</Text>
              <View style={styles.tagsContainer}>
                {companion.specialties.map((specialty, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{getSpecialtyLabel(specialty)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* About */}
          {!!companion.about.trim() && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.aboutText}>{companion.about}</Text>
            </View>
          )}

          {/* Languages */}
          {companion.languages.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Languages</Text>
              <View style={styles.languagesRow}>
                {companion.languages.map((lang, index) => (
                  <View key={index} style={styles.languageBadge}>
                    <Ionicons name="globe-outline" size={14} color={colors.primary.blue} />
                    <Text style={styles.languageText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Interests */}
          {companion.interests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.tagsContainer}>
                {companion.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Badges */}
          {companion.badges.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {companion.badges.map((badge) => (
                  <Card key={badge.id} style={styles.badgeCard}>
                    <View style={styles.badgeIcon}>
                      <Ionicons name={badge.icon as any} size={24} color={colors.primary.gold} />
                    </View>
                    <Text style={styles.badgeName}>{badge.name}</Text>
                    <Text style={styles.badgeDescription}>{badge.description}</Text>
                  </Card>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Safety */}
          <View style={styles.section}>
            <SafetyBanner variant="compact" />
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <SectionHeader title="Reviews" />
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <Card key={review.id} variant="outlined" style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewerName}>{review.name}</Text>
                    <Text style={styles.reviewDate}>{review.date}</Text>
                  </View>
                  <Rating rating={review.rating} showCount={false} size="small" />
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                </Card>
              ))
            ) : (
              <Text style={styles.noReviewsText}>No reviews yet.</Text>
            )}
          </View>

          {/* Response Time */}
          <View style={styles.responseInfo}>
            <Ionicons name="flash" size={16} color={colors.primary.blue} />
            <Text style={styles.responseText}>{companion.responseTime}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.price}>${companion.hourlyRate}</Text>
          <Text style={styles.priceUnit}>/hr</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={handleMessagePress}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.accent.primary} />
            <Text style={styles.messageButtonText}>Chat first</Text>
          </TouchableOpacity>
          <Button
            title="Request Booking"
            onPress={handleBookPress}
            variant="primary"
            size="large"
            style={styles.bookButton}
          />
        </View>
      </View>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.level0,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorTextCentered: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
  },
  retryText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    height: 320,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface.level2,
  },
  heroImageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surface.level2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    gap: spacing.xs,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  onlineText: {
    ...typography.presets.caption,
    color: colors.text.primary,
  },
  content: {
    padding: spacing.screenPadding,
    marginTop: -spacing.xl,
  },
  basicInfo: {
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  premiumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  location: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.lg,
  },
  completedText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  verificationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  verificationNote: {
    ...typography.presets.bodySmall,
    color: colors.status.success,
    marginBottom: spacing.xl,
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
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tagText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  aboutText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  languagesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  languageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
  },
  languageText: {
    ...typography.presets.bodySmall,
    color: colors.accent.primary,
  },
  interestTag: {
    backgroundColor: colors.surface.level2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  interestText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  badgeCard: {
    width: 120,
    marginRight: spacing.md,
    alignItems: 'center',
    padding: spacing.lg,
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  badgeName: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  badgeDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  reviewCard: {
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reviewerName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  reviewDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  reviewComment: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  noReviewsText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  responseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  responseText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface.level0,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginRight: spacing.xs,
  },
  price: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  priceUnit: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  messageButton: {
    minHeight: 48,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.surface.level1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  messageButtonText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookButton: {
    paddingHorizontal: spacing.xxl,
  },
});
