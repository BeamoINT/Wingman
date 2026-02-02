import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Badge, Avatar, Button } from '../components';
import type { RootStackParamList, Companion } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MatchCriteria {
  id: string;
  label: string;
  icon: string;
  weight: number; // 0-100
}

interface MatchedCompanion extends Companion {
  matchScore: number;
  matchReasons: string[];
}

const defaultCriteria: MatchCriteria[] = [
  { id: 'interests', label: 'Shared Interests', icon: 'heart', weight: 80 },
  { id: 'rating', label: 'High Rating', icon: 'star', weight: 70 },
  { id: 'response', label: 'Quick Response', icon: 'flash', weight: 60 },
  { id: 'experience', label: 'Experience Level', icon: 'trophy', weight: 50 },
  { id: 'availability', label: 'Availability Match', icon: 'calendar', weight: 90 },
];

const mockMatches: MatchedCompanion[] = [
  {
    id: '1',
    user: { id: 'u1', firstName: 'Sarah', lastName: 'J', email: '', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.9, reviewCount: 127, hourlyRate: 45, specialties: ['dining', 'social-events', 'concerts'], languages: ['English', 'Spanish'], availability: [], isOnline: true, responseTime: '15 min', completedBookings: 89, badges: [], gallery: [], about: '', interests: ['Travel', 'Food', 'Music'], verificationLevel: 'premium',
    matchScore: 96,
    matchReasons: ['Loves Italian food like you', 'Available this weekend', 'Highly rated for dining'],
  },
  {
    id: '2',
    user: { id: 'u2', firstName: 'Michael', lastName: 'C', email: '', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', isVerified: true,  isPremium: false, createdAt: '' },
    rating: 4.7, reviewCount: 64, hourlyRate: 35, specialties: ['coffee-chat', 'sports', 'movies'], languages: ['English'], availability: [], isOnline: true, responseTime: '30 min', completedBookings: 42, badges: [], gallery: [], about: '', interests: ['Tech', 'Sports', 'Coffee'], verificationLevel: 'verified',
    matchScore: 89,
    matchReasons: ['Both enjoy sports events', 'Similar age range', 'Fast responder'],
  },
  {
    id: '3',
    user: { id: 'u3', firstName: 'Emma', lastName: 'W', email: '', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.8, reviewCount: 89, hourlyRate: 40, specialties: ['concerts', 'movies', 'emotional-support'], languages: ['English', 'French'], availability: [], isOnline: false, responseTime: '1 hour', completedBookings: 56, badges: [], gallery: [], about: '', interests: ['Music', 'Art', 'Reading'], verificationLevel: 'premium',
    matchScore: 85,
    matchReasons: ['Shared love for live music', 'Great conversationalist', 'Bilingual like you'],
  },
];

export const SmartMatchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [isMatching, setIsMatching] = useState(true);
  const [criteria, setCriteria] = useState(defaultCriteria);
  const [matches, setMatches] = useState<MatchedCompanion[]>([]);

  const pulseScale = useSharedValue(1);
  const rotateValue = useSharedValue(0);

  useEffect(() => {
    if (isMatching) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
      rotateValue.value = withRepeat(
        withTiming(360, { duration: 3000, easing: Easing.linear }),
        -1
      );

      const timer = setTimeout(() => {
        setIsMatching(false);
        setMatches(mockMatches);
        haptics.success();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isMatching]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateValue.value}deg` }],
  }));

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleViewProfile = async (companionId: string) => {
    await haptics.medium();
    navigation.navigate('CompanionProfile', { companionId });
  };

  const handleRefreshMatch = async () => {
    await haptics.medium();
    setIsMatching(true);
    setMatches([]);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return colors.status.success;
    if (score >= 80) return colors.primary.blue;
    if (score >= 70) return colors.status.warning;
    return colors.text.tertiary;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Match</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="options-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {isMatching ? (
          <View style={styles.matchingContainer}>
            <Animated.View style={[styles.matchingCircle, pulseStyle]}>
              <LinearGradient
                colors={colors.gradients.premium}
                style={styles.matchingGradient}
              >
                <Animated.View style={rotateStyle}>
                  <Ionicons name="analytics" size={48} color={colors.primary.darkBlack} />
                </Animated.View>
              </LinearGradient>
            </Animated.View>

            <Text style={styles.matchingTitle}>Finding Your Perfect Match</Text>
            <Text style={styles.matchingSubtitle}>
              Analyzing preferences, availability, and compatibility...
            </Text>

            <View style={styles.criteriaList}>
              {criteria.map((item, index) => (
                <View key={item.id} style={styles.criteriaItem}>
                  <View style={styles.criteriaIcon}>
                    <Ionicons name={item.icon as any} size={16} color={colors.primary.blue} />
                  </View>
                  <Text style={styles.criteriaLabel}>{item.label}</Text>
                  <View style={styles.criteriaBar}>
                    <Animated.View
                      style={[
                        styles.criteriaFill,
                        { width: `${item.weight}%` },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            {/* Match Results Header */}
            <View style={styles.resultsHeader}>
              <View style={styles.resultsInfo}>
                <Text style={styles.resultsTitle}>Your Top Matches</Text>
                <Text style={styles.resultsSubtitle}>
                  Based on your preferences and activity
                </Text>
              </View>
              <TouchableOpacity style={styles.refreshButton} onPress={handleRefreshMatch}>
                <Ionicons name="refresh" size={20} color={colors.primary.blue} />
              </TouchableOpacity>
            </View>

            {/* Match Cards */}
            {matches.map((match, index) => (
              <Card key={match.id} variant="outlined" style={styles.matchCard}>
                {index === 0 && (
                  <View style={styles.topMatchBadge}>
                    <Ionicons name="trophy" size={12} color={colors.primary.gold} />
                    <Text style={styles.topMatchText}>Top Match</Text>
                  </View>
                )}

                <View style={styles.matchHeader}>
                  <View style={styles.matchAvatarContainer}>
                    <Image source={{ uri: match.user.avatar }} style={styles.matchAvatar} />
                    {match.isOnline && <View style={styles.onlineDot} />}
                  </View>

                  <View style={styles.matchInfo}>
                    <View style={styles.matchNameRow}>
                      <Text style={styles.matchName}>{match.user.firstName}</Text>
                      {match.verificationLevel === 'premium' && (
                        <Ionicons name="star" size={14} color={colors.primary.gold} />
                      )}
                    </View>
                    <View style={styles.matchMeta}>
                      <Ionicons name="star" size={12} color={colors.primary.gold} />
                      <Text style={styles.matchRating}>{match.rating}</Text>
                      <Text style={styles.matchReviews}>({match.reviewCount})</Text>
                    </View>
                  </View>

                  <View style={styles.scoreContainer}>
                    <View style={[styles.scoreCircle, { borderColor: getScoreColor(match.matchScore) }]}>
                      <Text style={[styles.scoreText, { color: getScoreColor(match.matchScore) }]}>
                        {match.matchScore}%
                      </Text>
                    </View>
                    <Text style={styles.scoreLabel}>Match</Text>
                  </View>
                </View>

                {/* Match Reasons */}
                <View style={styles.reasonsContainer}>
                  {match.matchReasons.map((reason, i) => (
                    <View key={i} style={styles.reasonItem}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>

                {/* Shared Interests */}
                <View style={styles.interestsContainer}>
                  <Text style={styles.interestsLabel}>Shared Interests:</Text>
                  <View style={styles.interestsTags}>
                    {match.interests.slice(0, 3).map((interest, i) => (
                      <View key={i} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.matchFooter}>
                  <Text style={styles.matchRate}>${match.hourlyRate}/hr</Text>
                  <View style={styles.matchActions}>
                    <TouchableOpacity
                      style={styles.messageAction}
                      onPress={() => haptics.light()}
                    >
                      <Ionicons name="chatbubble-outline" size={20} color={colors.primary.blue} />
                    </TouchableOpacity>
                    <Button
                      title="View Profile"
                      onPress={() => handleViewProfile(match.id)}
                      variant="primary"
                      size="small"
                    />
                  </View>
                </View>
              </Card>
            ))}

            {/* Improve Match Tips */}
            <View style={styles.section}>
              <Card variant="gradient" style={styles.tipsCard}>
                <Ionicons name="bulb-outline" size={24} color={colors.primary.gold} />
                <View style={styles.tipsContent}>
                  <Text style={styles.tipsTitle}>Improve Your Matches</Text>
                  <Text style={styles.tipsText}>
                    Complete your profile and add more interests to get better match suggestions!
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </View>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  matchingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.massive,
    paddingHorizontal: spacing.screenPadding,
  },
  matchingCircle: {
    marginBottom: spacing.xxl,
  },
  matchingGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  matchingTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  matchingSubtitle: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  criteriaList: {
    width: '100%',
    gap: spacing.md,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  criteriaIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  criteriaLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    width: 120,
  },
  criteriaBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
  },
  criteriaFill: {
    height: '100%',
    backgroundColor: colors.primary.blue,
    borderRadius: 3,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.screenPadding,
  },
  resultsInfo: {},
  resultsTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  resultsSubtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    position: 'relative',
  },
  topMatchBadge: {
    position: 'absolute',
    top: -10,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  topMatchText: {
    ...typography.presets.caption,
    color: colors.primary.gold,
    fontWeight: typography.weights.medium,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  matchAvatarContainer: {
    position: 'relative',
  },
  matchAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background.tertiary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  matchInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  matchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  matchName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  matchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  matchRating: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  matchReviews: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    ...typography.presets.bodySmall,
    fontWeight: typography.weights.bold,
  },
  scoreLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
    fontSize: 10,
  },
  reasonsContainer: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reasonText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  interestsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  interestsLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  interestsTags: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  interestTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius.sm,
  },
  interestText: {
    ...typography.presets.caption,
    color: colors.verification.trusted,
    fontSize: 10,
  },
  matchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  matchRate: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  matchActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  messageAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    padding: spacing.screenPadding,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  tipsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
