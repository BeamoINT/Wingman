import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
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
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types';

const { width, height } = Dimensions.get('window');
const TOTAL_PAGES = 2;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const { signInWithApple } = useAuth();

  const [currentPage, setCurrentPage] = useState(0);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  // Animation values
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const featuresOpacity = useSharedValue(0);

  useEffect(() => {
    // Check Apple Auth availability
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setIsAppleAuthAvailable(isAvailable);
      }
    };
    checkAppleAuth();

    // Animate first page
    logoScale.value = withSequence(
      withTiming(1.1, { duration: 600, easing: Easing.out(Easing.back()) }),
      withTiming(1, { duration: 200 })
    );
    logoOpacity.value = withTiming(1, { duration: 600 });
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 500 }));
    subtitleOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    featuresOpacity.value = withDelay(800, withTiming(1, { duration: 500 }));
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

  const featuresAnimatedStyle = useAnimatedStyle(() => ({
    opacity: featuresOpacity.value,
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / width);
    if (page !== currentPage) {
      setCurrentPage(page);
      haptics.selection();
    }
  };

  const handleCreateAccount = async () => {
    await haptics.medium();
    navigation.navigate('Signup');
  };

  const handleSignIn = async () => {
    await haptics.light();
    navigation.navigate('SignIn');
  };

  const handleAppleSignIn = async () => {
    try {
      await haptics.medium();

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('Apple auth successful:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
      });

      // Check if we have the identity token
      if (!credential.identityToken) {
        Alert.alert(
          'Sign In Failed',
          'Could not get authentication token from Apple. Please try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Sign in with Supabase using the Apple identity token
      const result = await signInWithApple(credential.identityToken, {
        givenName: credential.fullName?.givenName,
        familyName: credential.fullName?.familyName,
      });

      if (result.success) {
        await haptics.success();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        Alert.alert(
          'Sign In Failed',
          result.error || 'Unable to sign in with Apple. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in
        return;
      }
      console.error('Apple Sign In Error:', error);
      Alert.alert(
        'Sign In Failed',
        'Unable to sign in with Apple. Please try again or use email sign in.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderPageIndicator = () => (
    <View style={styles.pageIndicatorContainer}>
      {Array.from({ length: TOTAL_PAGES }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.pageIndicatorDot,
            currentPage === index && styles.pageIndicatorDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary, colors.background.tertiary]}
      style={styles.container}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      >
        {/* Page 1: Welcome */}
        <View style={[styles.page, { paddingTop: insets.top + spacing.xxl }]}>
          <View style={styles.pageContent}>
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

            <Animated.View style={[styles.featuresContainer, featuresAnimatedStyle]}>
              {[
                { icon: 'shield-checkmark', text: 'Verified & Safe' },
                { icon: 'star', text: 'Rated Companions' },
                { icon: 'calendar', text: 'Easy Booking' },
              ].map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <Ionicons name={feature.icon as any} size={20} color={colors.primary.blue} />
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              ))}
            </Animated.View>
          </View>

          <Animated.View style={[styles.swipeHint, featuresAnimatedStyle]}>
            <Text style={styles.swipeHintText}>Swipe to get started</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </Animated.View>
        </View>

        {/* Page 2: Sign In / Create Account */}
        <View style={[styles.page, { paddingTop: insets.top + spacing.xxl }]}>
          <View style={styles.pageContent}>
            <View style={styles.getStartedHeader}>
              <Text style={styles.getStartedTitle}>Get Started</Text>
              <Text style={styles.getStartedSubtitle}>
                Create an account or sign in to continue
              </Text>
            </View>

            {/* Apple Sign In Button */}
            {isAppleAuthAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={spacing.radius.xl}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {/* Divider */}
            {isAppleAuthAvailable && (
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.divider} />
              </View>
            )}

            {/* Email Buttons */}
            <View style={styles.emailButtonsContainer}>
              <Button
                title="Create Account"
                onPress={handleCreateAccount}
                variant="primary"
                size="large"
                fullWidth
                icon="mail-outline"
              />
              <View style={styles.buttonSpacer} />
              <Button
                title="Sign In with Email"
                onPress={handleSignIn}
                variant="outline"
                size="large"
                fullWidth
                icon="log-in-outline"
              />
            </View>
          </View>

          <View style={[styles.termsContainer, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.navigate('LegalDocument', { documentType: 'terms-of-service' })}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => navigation.navigate('LegalDocument', { documentType: 'privacy-policy' })}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Page Indicator - Fixed at bottom */}
      <View style={[styles.pageIndicatorWrapper, { bottom: insets.bottom + spacing.xl + 80 }]}>
        {renderPageIndicator()}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
  },
  pageContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  logoContainer: {
    marginTop: height * 0.06,
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
    lineHeight: 24,
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
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    gap: spacing.xs,
  },
  swipeHintText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  // Page 2 styles
  getStartedHeader: {
    alignItems: 'center',
    marginTop: height * 0.08,
    marginBottom: spacing.xxl,
  },
  getStartedTitle: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  getStartedSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  appleButton: {
    width: '100%',
    height: 56,
    marginBottom: spacing.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  dividerText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginHorizontal: spacing.md,
  },
  emailButtonsContainer: {
    width: '100%',
  },
  buttonSpacer: {
    height: spacing.md,
  },
  termsContainer: {
    paddingHorizontal: spacing.screenPadding,
  },
  termsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  termsLink: {
    color: colors.primary.blue,
    textDecorationLine: 'underline',
  },
  // Page Indicator
  pageIndicatorWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pageIndicatorContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pageIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.text.muted,
  },
  pageIndicatorDotActive: {
    width: 24,
    backgroundColor: colors.primary.blue,
  },
});
