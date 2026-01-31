import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button } from '../components';
import type { RootStackParamList } from '../types';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'people',
    iconColor: colors.primary.blue,
    title: 'Find Your Wingman',
    description:
      'Connect with verified companions for any social situation. Whether you need someone for dinner, a concert, or just company at a coffee shop.',
  },
  {
    id: '2',
    icon: 'shield-checkmark',
    iconColor: colors.status.success,
    title: 'Safety First',
    description:
      'All companions undergo thorough background checks and ID verification. Feel secure knowing you\'re meeting trusted, vetted individuals.',
  },
  {
    id: '3',
    icon: 'heart',
    iconColor: colors.primary.gold,
    title: 'Make Real Friends',
    description:
      'Subscribe to meet new friends organically. No dating pressure - just genuine connections with like-minded people in your area.',
  },
  {
    id: '4',
    icon: 'star',
    iconColor: colors.verification.trusted,
    title: 'Premium Experience',
    description:
      'Unlock unlimited bookings, priority matching, and exclusive events with our premium membership. Never feel alone again.',
  },
];

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = async () => {
    await haptics.light();
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      await haptics.success();
      navigation.replace('Main');
    }
  };

  const handleSkip = async () => {
    await haptics.light();
    navigation.replace('Main');
  };

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={[`${item.iconColor}30`, `${item.iconColor}10`]}
          style={styles.iconGradient}
        >
          <Ionicons name={item.icon} size={64} color={item.iconColor} />
        </LinearGradient>
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={styles.container}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Button
          title={currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          variant={currentIndex === slides.length - 1 ? 'gold' : 'primary'}
          size="large"
          fullWidth
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
  },
  skipButton: {
    padding: spacing.sm,
  },
  skipText: {
    ...typography.presets.button,
    color: colors.text.tertiary,
  },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding * 2,
  },
  iconContainer: {
    marginBottom: spacing.xxxl,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  description: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.tertiary,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary.blue,
  },
});
