import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { Avatar } from '../../components';
import { useRequirements } from '../../context/RequirementsContext';
import { RequirementsGate } from '../../components/RequirementsGate';
import type { RootStackParamList } from '../../types';
import type { FriendProfile } from '../../types/friends';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// Mock friend profiles
const mockProfiles: FriendProfile[] = [
  {
    id: '1',
    userId: 'u1',
    firstName: 'Alex',
    lastName: 'K',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    bio: 'Love hiking, coffee, and good conversations. Always looking for new adventure buddies!',
    age: 28,
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    interests: ['Hiking', 'Photography', 'Coffee', 'Travel'],
    languages: ['English', 'Spanish'],
    lookingFor: ['casual-hangouts', 'outdoor-activities', 'coffee-chats'],
    isOnline: true,
    lastActive: new Date().toISOString(),
    verificationLevel: 'verified',
    mutualFriendsCount: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    userId: 'u2',
    firstName: 'Jordan',
    lastName: 'M',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    bio: 'Foodie and music lover. Looking for concert buddies and people to explore restaurants with.',
    age: 25,
    location: { city: 'San Francisco', state: 'CA', country: 'USA' },
    interests: ['Music', 'Food', 'Concerts', 'Art'],
    languages: ['English'],
    lookingFor: ['concerts-events', 'casual-hangouts'],
    isOnline: false,
    lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    verificationLevel: 'premium',
    mutualFriendsCount: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    userId: 'u3',
    firstName: 'Sam',
    lastName: 'R',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    bio: 'Fitness enthusiast and bookworm. Looking for gym buddies and book club friends!',
    age: 31,
    location: { city: 'Oakland', state: 'CA', country: 'USA' },
    interests: ['Fitness', 'Reading', 'Running', 'Yoga'],
    languages: ['English', 'French'],
    lookingFor: ['workout-buddy', 'hobby-partner'],
    isOnline: true,
    lastActive: new Date().toISOString(),
    verificationLevel: 'verified',
    mutualFriendsCount: 5,
    createdAt: new Date().toISOString(),
  },
];

/**
 * FriendMatchingScreen - Swipe-based friend matching
 * Subscription-gated: Requires Plus tier or higher
 */
const FriendMatchingContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { friendsLimits, friendsUsage, recordFriendsMatch } = useRequirements();

  const [profiles] = useState<FriendProfile[]>(mockProfiles);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMatch, setShowMatch] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  const currentProfile = profiles[currentIndex];
  const matchesRemaining = friendsLimits.matchesPerMonth - friendsUsage.matchesThisMonth;
  const hasMatchesLeft = matchesRemaining > 0 || friendsLimits.matchesPerMonth === 999;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        pan.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  };

  const swipeLeft = async () => {
    await haptics.light();
    Animated.timing(pan, {
      toValue: { x: -SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      nextCard();
    });
  };

  const swipeRight = async () => {
    if (!hasMatchesLeft) {
      resetPosition();
      navigation.navigate('Subscription');
      return;
    }

    await haptics.medium();
    await recordFriendsMatch();

    Animated.timing(pan, {
      toValue: { x: SCREEN_WIDTH * 1.5, y: 0 },
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Simulate a match (50% chance)
      if (Math.random() > 0.5) {
        setShowMatch(true);
        setTimeout(() => setShowMatch(false), 2000);
      }
      nextCard();
    });
  };

  const nextCard = () => {
    pan.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev + 1) % profiles.length);
  };

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
                {currentProfile.location.city}, {currentProfile.location.state}
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
                {currentProfile.bio}
              </Text>

              <View style={styles.interests}>
                {currentProfile.interests.slice(0, 4).map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionButton, styles.nopeButton]} onPress={swipeLeft}>
          <Ionicons name="close" size={32} color={colors.status.error} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.superLikeButton]}>
          <Ionicons name="star" size={28} color={colors.primary.coral} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={swipeRight}>
          <Ionicons name="heart" size={32} color={colors.status.success} />
        </TouchableOpacity>
      </View>

      {/* Match Overlay */}
      {showMatch && (
        <View style={styles.matchOverlay}>
          <Text style={styles.matchText}>It's a Match!</Text>
          <Text style={styles.matchSubtext}>
            You and {currentProfile.firstName} liked each other
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
    shadowColor: '#000',
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
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
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
    shadowColor: '#000',
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
  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
