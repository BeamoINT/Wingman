import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
    Platform, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components';
import { useAuth } from '../../context/AuthContext';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyEmail'>;

const CODE_LENGTH = 6;

export const VerifyEmailScreen: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signupData, supabaseUser, verifyEmail, resendEmailVerification, setEmailVerified } = useAuth();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const email = signupData.email || supabaseUser?.email || '';

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];

    if (text.length > 1) {
      // Handle paste
      const pastedCode = text.slice(0, CODE_LENGTH).split('');
      pastedCode.forEach((char, i) => {
        if (i + index < CODE_LENGTH) {
          newCode[i + index] = char;
        }
      });
      setCode(newCode);

      const nextIndex = Math.min(index + pastedCode.length, CODE_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      newCode[index] = text;
      setCode(newCode);

      if (text && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }

    setError('');
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete verification code');
      await haptics.warning();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await verifyEmail(fullCode);

      if (result.success) {
        await haptics.success();
        setEmailVerified();

        // Enforce phone verification immediately after email verification during signup.
        navigation.reset({
          index: 0,
          routes: [{ name: 'VerifyPhone', params: { source: 'signup' } }],
        });
      } else {
        setError(result.error || 'Invalid verification code');
        await haptics.error();
      }
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      await haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    await haptics.light();
    setResendCooldown(60);

    const result = await resendEmailVerification();

    if (result.success) {
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } else {
      Alert.alert('Error', result.error || 'Failed to resend code. Please try again.');
      setResendCooldown(0);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeIn.delay(100)} style={styles.iconContainer}>
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <Ionicons name="mail" size={40} color={colors.primary.black} />
          </LinearGradient>
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
          Verify Your Email
        </Animated.Text>

        <Animated.Text entering={FadeInDown.delay(300)} style={styles.subtitle}>
          We've sent a 6-digit verification code to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
                error && styles.codeInputError,
              ]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? CODE_LENGTH : 1}
              selectTextOnFocus
              accessibilityLabel={`Digit ${index + 1} of verification code`}
            />
          ))}
        </Animated.View>

        {error ? (
          <Animated.View entering={FadeIn} style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(500)} style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
          >
            <Text style={[
              styles.resendLink,
              resendCooldown > 0 && styles.resendLinkDisabled,
            ]}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title="Verify Email"
          onPress={handleVerify}
          variant="primary"
          size="large"
          fullWidth
          loading={isLoading}
          disabled={code.join('').length !== CODE_LENGTH}
        />
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    lineHeight: 24,
  },
  emailText: {
    color: colors.primary.blue,
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.light,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: colors.text.primary,
  },
  codeInputFilled: {
    borderColor: colors.primary.blue,
    backgroundColor: colors.background.secondary,
  },
  codeInputError: {
    borderColor: colors.status.error,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorLight,
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  resendLink: {
    ...typography.presets.body,
    color: colors.primary.blue,
    fontWeight: '600',
  },
  resendLinkDisabled: {
    color: colors.text.muted,
  },
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
