import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';
import { Button } from '../../components';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Tutorial'>;

interface TutorialSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  features: string[];
}

const SLIDES: TutorialSlide[] = [
  {
    id: '1',
    icon: 'compass',
    iconColor: colors.primary.blue,
    title: 'Find Companions',
    subtitle: 'Discover verified companions for any activity',
    features: [
      'Browse by interests and activities',
      'Filter by location and availability',
      'Read reviews from other users',
      'View detailed profiles and ratings',
    ],
  },
  {
    id: '2',
    icon: 'shield-checkmark',
    iconColor: colors.status.success,
    title: 'Book with Confidence',
    subtitle: 'Every companion is verified for your safety',
    features: [
      'Identity verification for all companions',
      'Background checks available',
      'Secure in-app messaging',
      'Transparent pricing with no surprises',
    ],
  },
  {
    id: '3',
    icon: 'heart',
    iconColor: colors.status.error,
    title: 'Stay Safe',
    subtitle: 'Your safety is our top priority',
    features: [
      'Share your location with trusted contacts',
      'Check-in reminders during bookings',
      'Emergency assistance button',
      '24/7 support team available',
    ],
  },
  {
    id: '4',
    icon: 'sparkles',
    iconColor: colors.primary.gold,
    title: "You're Ready!",
    subtitle: 'Start exploring and find your perfect companion',
    features: [
      'Complete your profile for better matches',
      'Set your preferences and interests',
      'Browse featured companions',
      'Book your first experience today!',
    ],
  },
];

export const TutorialScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { completeTutorial } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const handleNext = async () => {
    await haptics.light();
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await haptics.light();
    handleComplete();
  };

  const handleComplete = async () => {
    await haptics.success();
    completeTutorial();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderSlide = ({ item, index }: { item: TutorialSlide; index: number }) => (
    <View style={styles.slide}>
      <View style={styles.slideContent}>
        <View style={[styles.iconContainer, { backgroundColor: `${item.iconColor}20` }]}>
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </View>

        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

        <View style={styles.featuresContainer}>
          {item.features.map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <View style={styles.featureBullet}>
                <Ionicons name="checkmark" size={12} color={colors.primary.blue} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.pagination}>
      {SLIDES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            currentIndex === index && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        {currentIndex < SLIDES.length - 1 ? (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {renderPagination()}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <Button
          title={currentIndex === SLIDES.length - 1 ? "Let's Go!" : 'Next'}
          onPress={handleNext}
          variant={currentIndex === SLIDES.length - 1 ? 'gold' : 'primary'}
          size="large"
          fullWidth
          icon={currentIndex === SLIDES.length - 1 ? 'arrow-forward' : undefined}
        />
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  slide: {
    width,
    paddingHorizontal: spacing.screenPadding,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  slideTitle: {
    ...typography.presets.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  featuresContainer: {
    alignSelf: 'stretch',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  featureBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: `${colors.primary.blue}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  featureText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    flex: 1,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.quaternary,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: colors.primary.blue,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
  },
});
