import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
    Platform,
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

export const SignInScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    const checkAppleAuth = async () => {
      if (Platform.OS === 'ios') {
        const isAvailable = await AppleAuthentication.isAvailableAsync();
        setIsAppleAuthAvailable(isAvailable);
      }
    };
    checkAppleAuth();
  }, []);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      await haptics.warning();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await signIn(email, password);
      if (result.success) {
        await haptics.success();
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        setError(result.error || 'Invalid email or password');
        await haptics.error();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleCreateAccount = async () => {
    await haptics.light();
    navigation.navigate('Signup');
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
        setError(result.error || 'Sign in failed');
        await haptics.error();
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
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

  const handleForgotPassword = async () => {
    await haptics.light();
    navigation.navigate('ForgotPassword', { email: email.trim() || undefined });
  };

  const handleMagicLinkLogin = async () => {
    await haptics.light();
    navigation.navigate('MagicLinkLogin', { email: email.trim() || undefined });
  };

  const handleOtherSocialSignIn = async (provider: 'google' | 'facebook') => {
    await haptics.medium();
    Alert.alert(
      `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
      'This sign-in method will be available soon. Please use Apple or email sign-in.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon="mail-outline"
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            leftIcon="lock-closed-outline"
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPassword(!showPassword)}
          />

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Button
            title="Sign In"
            onPress={handleSignIn}
            variant="primary"
            size="large"
            fullWidth
            loading={loading}
            disabled={loading}
          />

          <TouchableOpacity style={styles.magicLinkButton} onPress={handleMagicLinkLogin}>
            <Ionicons name="sparkles" size={18} color={colors.primary.blue} />
            <Text style={styles.magicLinkText}>Sign in with email code</Text>
          </TouchableOpacity>

          {/* Social Sign In Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          {/* Apple Sign In Button - Native */}
          {isAppleAuthAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={spacing.radius.xl}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )}

          {/* Other Social Sign In Buttons */}
          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleOtherSocialSignIn('google')}
              activeOpacity={0.7}
              accessibilityLabel="Sign in with Google"
              accessibilityRole="button"
            >
              <Ionicons name="logo-google" size={22} color={colors.text.primary} />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleOtherSocialSignIn('facebook')}
              activeOpacity={0.7}
              accessibilityLabel="Sign in with Facebook"
              accessibilityRole="button"
            >
              <Ionicons name="logo-facebook" size={22} color={colors.text.primary} />
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createAccountContainer}>
            <Text style={styles.createAccountText}>Don't have an account? </Text>
            <TouchableOpacity onPress={handleCreateAccount}>
              <Text style={styles.createAccountLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorLight,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },
  forgotPasswordText: {
    ...typography.presets.body,
    color: colors.primary.blue,
  },
  footer: {
    paddingTop: spacing.xl,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  createAccountText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  createAccountLink: {
    ...typography.presets.body,
    color: colors.primary.blue,
    fontWeight: typography.weights.semibold as any,
  },
  magicLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  magicLinkText: {
    ...typography.presets.body,
    color: colors.primary.blue,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
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
  appleButton: {
    width: '100%',
    height: 56,
    marginBottom: spacing.md,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  socialButtonText: {
    ...typography.presets.label,
    color: colors.text.primary,
  },
});
