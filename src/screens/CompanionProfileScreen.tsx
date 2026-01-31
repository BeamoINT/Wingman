import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button, Badge, Rating, Card, SafetyBanner } from '../components';
import type { RootStackParamList, Companion } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'CompanionProfile'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock data
const mockCompanion: Companion = {
  id: '1',
  user: {
    id: 'u1',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    bio: 'Outgoing and friendly, I love making new connections!',
    isVerified: true,
    isBackgroundChecked: true,
    isPremium: true,
    createdAt: '2024-01-01',
    location: {
      city: 'San Francisco',
      state: 'CA',
      country: 'USA',
    },
  },
  rating: 4.9,
  reviewCount: 127,
  hourlyRate: 45,
  specialties: ['dining', 'social-events', 'nightlife', 'concerts'],
  languages: ['English', 'Spanish', 'French'],
  availability: [],
  isOnline: true,
  responseTime: 'Usually responds within 15 minutes',
  completedBookings: 89,
  badges: [
    { id: '1', name: 'Top Rated', icon: 'star', description: 'Maintained 4.8+ rating', earnedAt: '' },
    { id: '2', name: 'Super Host', icon: 'trophy', description: '50+ successful bookings', earnedAt: '' },
    { id: '3', name: 'Quick Reply', icon: 'flash', description: 'Responds within 15 min', earnedAt: '' },
  ],
  gallery: [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
  ],
  about: 'Hey there! I\'m Sarah, a social butterfly who genuinely enjoys meeting new people and making everyone feel welcome. Whether you need a dining companion, someone to hit up a concert with, or just want company for a night out, I\'m your girl!\n\nI\'ve lived in San Francisco for 5 years and know all the best spots. I speak three languages fluently and love learning about different cultures. Let\'s make some great memories together!',
  interests: ['Travel', 'Food & Wine', 'Live Music', 'Art Galleries', 'Hiking', 'Photography'],
  verificationLevel: 'premium',
};

const mockReviews = [
  {
    id: '1',
    name: 'Michael T.',
    rating: 5,
    date: '2 weeks ago',
    comment: 'Sarah was absolutely wonderful! She made me feel so comfortable at a business dinner. Highly recommend!',
  },
  {
    id: '2',
    name: 'Emily R.',
    rating: 5,
    date: '1 month ago',
    comment: 'Had a great time at the concert. Sarah is super fun and easy to talk to!',
  },
];

export const CompanionProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const [isFavorite, setIsFavorite] = useState(false);

  const companion = mockCompanion;

  const handleBookPress = async () => {
    await haptics.medium();
    navigation.navigate('Booking', { companionId: companion.id });
  };

  const handleMessagePress = async () => {
    await haptics.light();
    navigation.navigate('Chat', { conversationId: companion.id });
  };

  const handleFavoritePress = async () => {
    await haptics.selection();
    setIsFavorite(!isFavorite);
  };

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: companion.user.avatar }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />

          {/* Header Buttons */}
          <View style={[styles.headerButtons, { top: insets.top + spacing.sm }]}>
            <TouchableOpacity style={styles.headerButton} onPress={handleBackPress}>
              <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.headerButton} onPress={() => haptics.light()}>
                <Ionicons name="share-outline" size={22} color={colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleFavoritePress}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={22}
                  color={isFavorite ? colors.status.error : colors.text.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

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
              {' '}{companion.user.location?.city}, {companion.user.location?.state}
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
            <Badge label="Background Checked" variant="verified" icon="shield-checkmark" />
            {companion.verificationLevel === 'premium' && (
              <Badge label="Premium" variant="premium" icon="star" />
            )}
          </View>

          {/* Specialties */}
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

          {/* About */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.aboutText}>{companion.about}</Text>
          </View>

          {/* Languages */}
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

          {/* Interests */}
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

          {/* Badges */}
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

          {/* Safety */}
          <View style={styles.section}>
            <SafetyBanner variant="compact" />
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reviews</Text>
              <TouchableOpacity onPress={() => haptics.light()}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            {mockReviews.map((review) => (
              <Card key={review.id} variant="outlined" style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{review.name}</Text>
                  <Text style={styles.reviewDate}>{review.date}</Text>
                </View>
                <Rating rating={review.rating} showCount={false} size="small" />
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </Card>
            ))}
          </View>

          {/* Response Time */}
          <View style={styles.responseInfo}>
            <Ionicons name="flash" size={16} color={colors.primary.blue} />
            <Text style={styles.responseText}>{companion.responseTime}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>From</Text>
          <Text style={styles.price}>${companion.hourlyRate}</Text>
          <Text style={styles.priceUnit}>/hr</Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.messageButton} onPress={handleMessagePress}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.primary.blue} />
          </TouchableOpacity>
          <Button
            title="Book Now"
            onPress={handleBookPress}
            variant="primary"
            size="large"
            style={styles.bookButton}
          />
        </View>
      </LinearGradient>
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
  heroContainer: {
    height: 400,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  headerButtons: {
    position: 'absolute',
    left: spacing.screenPadding,
    right: spacing.screenPadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
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
  seeAllText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
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
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
  },
  languageText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  interestTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
  },
  interestText: {
    ...typography.presets.bodySmall,
    color: colors.verification.trusted,
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
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
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
    paddingTop: spacing.xl,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary.blue,
  },
  bookButton: {
    paddingHorizontal: spacing.xxl,
  },
});
