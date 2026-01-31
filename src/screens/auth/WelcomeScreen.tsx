import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import type { RootStackParamList } from '../../types';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate logo
    logoScale.value = withSequence(
      withTiming(1.1, { duration: 600, easing: Easing.out(Easing.back) }),
      withTiming(1, { duration: 200 })
    );
    logoOpacity.value = withTiming(1, { duration: 600 });

    // Animate text
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    subtitleOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    buttonsOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  const handleCreateAccount = async () => {
    await haptics.medium();
    navigation.navigate('Signup');
  };

  const handleSignIn = async () => {
    await haptics.light();
    navigation.navigate('SignIn');
  };

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary, colors.background.tertiary]}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Ionicons name="people" size={56} color={colors.primary.darkBlack} />
          </LinearGradient>
        </Animated.View>

        <Animated.Text style={[styles.title, titleAnimatedStyle]}>
          Wingman
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
          Find friendly companions for social outings, events, and activities
        </Animated.Text>

        <View style={styles.featuresContainer}>
          {[
            { icon: 'shield-checkmark', text: 'Verified & Safe' },
            { icon: 'star', text: 'Rated Companions' },
            { icon: 'calendar', text: 'Easy Booking' },
          ].map((feature, index) => (
            <Animated.View
              key={index}
              style={[
                styles.featureItem,
                { opacity: subtitleOpacity },
              ]}
            >
              <Ionicons name={feature.icon as any} size={20} color={colors.primary.blue} />
              <Text style={styles.featureText}>{feature.text}</Text>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View
        style={[
          styles.buttonsContainer,
          { paddingBottom: insets.bottom + spacing.xl },
          buttonsAnimatedStyle,
        ]}
      >
        <Button
          title="Create Account"
          onPress={handleCreateAccount}
          variant="primary"
          size="large"
          fullWidth
        />
        <View style={styles.buttonSpacer} />
        <Button
          title="Sign In"
          onPress={handleSignIn}
          variant="outline"
          size="large"
          fullWidth
        />
        <Text style={styles.termsText}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  logoContainer: {
    marginTop: height * 0.08,
    marginBottom: spacing.xl,
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    ...typography.presets.hero,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featureText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  buttonsContainer: {
    paddingHorizontal: spacing.screenPadding,
  },
  buttonSpacer: {
    height: spacing.md,
  },
  termsText: {
    ...typography.presets.caption,
    color: colors.text.quaternary,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
});
