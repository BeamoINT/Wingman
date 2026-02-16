import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Animated, Dimensions, PanResponder, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components';
import { RequirementsGate } from '../../components/RequirementsGate';
import { useRequirements } from '../../context/RequirementsContext';
import { fetchMatchingProfiles, recordMatchSwipe } from '../../services/api/friendsApi';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type { FriendProfile } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

/**
 * FriendMatchingScreen - Swipe-based friend matching
 * Subscription-gated: Requires Plus tier or higher
 */
const FriendMatchingContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { friendsLimits, friendsUsage, recordFriendsMatch } = useRequirements();

  const [profiles, setProfiles] = useState<FriendProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingSwipe, setIsSubmittingSwipe] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { profiles: loadedProfiles, error: profilesError } = await fetchMatchingProfiles();
      if (profilesError) {
        console.error('Error loading matching profiles:', profilesError);
        setError('Unable to load people to match with right now.');
        setProfiles([]);
        setCurrentIndex(0);
        return;
      }

      setProfiles(loadedProfiles);
      setCurrentIndex(0);
    } catch (loadError) {
      console.error('Error in loadProfiles:', loadError);
      setError('Something went wrong while loading friend matching.');
      setProfiles([]);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const currentProfile = profiles[currentIndex];
  const matchesRemaining = friendsLimits.matchesPerMonth === 999
    ? 999
    : Math.max(friendsLimits.matchesPerMonth - friendsUsage.matchesThisMonth, 0);
  const hasMatchesLeft = matchesRemaining > 0 || friendsLimits.matchesPerMonth === 999;

  const resetPosition = useCallback(() => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  }, [pan]);

  const nextCard = useCallback(() => {
    pan.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
  }, [pan]);

  const swipeLeft = useCallback(async () => {
    if (!currentProfile || isSubmittingSwipe) {
      resetPosition();
      return;
    }

    setIsSubmittingSwipe(true);
    await haptics.light();

    void recordMatchSwipe(currentProfile.userId || currentProfile.id, 'pass')
      .then(({ error: swipeError }) => {
        if (swipeError) {
          console.error('Error recording pass swipe:', swipeError);
        }
      });

    Animated.timing(pan, {
      toValue: { x: -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      nextCard();
      setIsSubmittingSwipe(false);
    });
  }, [currentProfile, isSubmittingSwipe, nextCard, pan, resetPosition]);

  const swipeRight = useCallback(async () => {
    if (!currentProfile || isSubmittingSwipe) {
      resetPosition();
      return;
    }

    if (!hasMatchesLeft) {
      resetPosition();
      navigation.navigate('Subscription');
      return;
    }

    setIsSubmittingSwipe(true);
    await haptics.medium();
    void recordFriendsMatch(currentProfile.userId || currentProfile.id)
      .then(() => {
        setShowMatch(true);
        setTimeout(() => setShowMatch(false), 2000);
      })
      .catch((swipeError) => {
        console.error('Error recording like swipe:', swipeError);
      });

    Animated.timing(pan, {
      toValue: { x: SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      nextCard();
      setIsSubmittingSwipe(false);
    });
  }, [
    currentProfile,
    hasMatchesLeft,
    isSubmittingSwipe,
    navigation,
    nextCard,
    pan,
    recordFriendsMatch,
    resetPosition,
  ]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gesture) => {
      pan.setValue({ x: gesture.dx, y: gesture.dy });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        void swipeRight();
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        void swipeLeft();
      } else {
        resetPosition();
      }
    },
  }), [pan, resetPosition, swipeLeft, swipeRight]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const cardStyle = {
    transform: [
      { translateX: pan.x },
      { translateY: pan.y },
      {
        rotate: pan.x.interpolate({
          inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          outputRange: ['-10deg', '0deg', '10deg'],
        }),
      },
    ],
  };

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friend Matching</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.emptyTitle}>Loading profiles...</Text>
        </View>
      </View>
    );
  }

  if (error && profiles.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friend Matching</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.status.error} />
          <Text style={styles.emptyTitle}>Unable to Load Matches</Text>
          <Text style={styles.emptySubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProfiles()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friend Matching</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={colors.text.tertiary} />
          <Text style={styles.emptyTitle}>No More Profiles</Text>
          <Text style={styles.emptySubtitle}>Check back later for new people to meet</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadProfiles()}>
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Matching</Text>
        <View style={styles.matchCounter}>
          <Ionicons name="heart" size={16} color={colors.primary.coral} />
          <Text style={styles.matchCountText}>
            {friendsLimits.matchesPerMonth === 999 ? '∞' : matchesRemaining}
          </Text>
        </View>
      </View>

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={[styles.card, cardStyle]}
          {...panResponder.panHandlers}
        >
          {/* Like/Nope Labels */}
          <Animated.View style={[styles.labelContainer, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.labelText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.labelContainer, styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={styles.labelText}>NOPE</Text>
          </Animated.View>

          {/* Profile Content */}
          <View style={styles.cardContent}>
            <Avatar
              source={currentProfile.avatar}
              name={`${currentProfile.firstName} ${currentProfile.lastName}`}
              size="large"
              showOnlineStatus
              isOnline={currentProfile.isOnline}
            />

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>
                  {currentProfile.firstName}, {currentProfile.age}
                </Text>
                {currentProfile.verificationLevel !== 'basic' && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary.blue} />
                )}
              </View>
              <Text style={styles.profileLocation}>
                {[currentProfile.location.city, currentProfile.location.state].filter(Boolean).join(', ')}
              </Text>

              {currentProfile.mutualFriendsCount > 0 && (
                <View style={styles.mutualFriends}>
                  <Ionicons name="people" size={14} color={colors.primary.blue} />
                  <Text style={styles.mutualFriendsText}>
                    {currentProfile.mutualFriendsCount} mutual friends
                  </Text>
                </View>
              )}

              <Text style={styles.profileBio} numberOfLines={3}>
                {currentProfile.bio || 'Looking to make new friends on Wingman.'}
              </Text>

              {currentProfile.interests.length > 0 && (
                <View style={styles.interests}>
                  {currentProfile.interests.slice(0, 4).map((interest, index) => (
                    <View key={index} style={styles.interestTag}>
                      <Text style={styles.interestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.nopeButton]}
          onPress={() => void swipeLeft()}
          disabled={isSubmittingSwipe}
        >
          <Ionicons name="close" size={32} color={colors.status.error} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.superLikeButton]} disabled>
          <Ionicons name="star" size={28} color={colors.primary.coral} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => void swipeRight()}
          disabled={isSubmittingSwipe}
        >
          <Ionicons name="heart" size={32} color={colors.status.success} />
        </TouchableOpacity>
      </View>

      {/* Match Overlay */}
      {showMatch && (
        <View style={styles.matchOverlay}>
          <Text style={styles.matchText}>Like Sent</Text>
          <Text style={styles.matchSubtext}>
            You liked {currentProfile.firstName}
          </Text>
        </View>
      )}
    </View>
  );
};

export const FriendMatchingScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="friends_matching"
      modalTitle="Upgrade to Match"
    >
      <FriendMatchingContent />
    </RequirementsGate>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
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
  matchCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  matchCountText: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  card: {
    width: SCREEN_WIDTH - spacing.screenPadding * 2,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.xl,
    padding: spacing.lg,
    shadowColor: colors.shadow.heavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  labelContainer: {
    position: 'absolute',
    top: 20,
    zIndex: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    borderWidth: 3,
  },
  likeLabel: {
    right: 20,
    borderColor: colors.status.success,
  },
  nopeLabel: {
    left: 20,
    borderColor: colors.status.error,
  },
  labelText: {
    ...typography.presets.h4,
    fontWeight: '700',
    color: colors.text.primary,
  },
  cardContent: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileInfo: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileName: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  profileLocation: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  mutualFriends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.blueSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  mutualFriendsText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
  },
  profileBio: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  interestTag: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.full,
  },
  interestText: {
    ...typography.presets.caption,
    color: colors.text.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    shadowColor: colors.shadow.heavy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nopeButton: {},
  superLikeButton: {
    width: 52,
    height: 52,
  },
  likeButton: {},
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  matchText: {
    ...typography.presets.h1,
    color: colors.primary.coral,
  },
  matchSubtext: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
});
