import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
    Platform,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';
import { email as emailValidator } from '../../utils/validation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChangeEmail'>;

type Step = 'email' | 'verify';
const CODE_LENGTH = 6;

export const ChangeEmailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, updateUserEmail, confirmEmailChange } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];

    if (text.length > 1) {
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

  const handleSendVerification = async () => {
    const emailErr = emailValidator()(newEmail.trim());
    if (emailErr) {
      setError(emailErr);
      await haptics.warning();
      return;
    }

    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setError('New email must be different from your current email');
      await haptics.warning();
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await updateUserEmail(newEmail.trim());

    if (result.success) {
      await haptics.success();
      setStep('verify');
      setResendCooldown(60);
    } else {
      setError(result.error || 'Failed to send verification code');
      await haptics.error();
    }

    setIsLoading(false);
  };

  const handleVerifyEmail = async () => {
    const fullCode = code.join('');

    if (fullCode.length !== CODE_LENGTH) {
      setError('Please enter the complete verification code');
      await haptics.warning();
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await confirmEmailChange(newEmail.trim(), fullCode);

    if (result.success) {
      await haptics.success();
      Alert.alert(
        'Email Updated',
        'Your email has been changed successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      setError(result.error || 'Failed to verify email');
      await haptics.error();
    }

    setIsLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    await haptics.light();
    setResendCooldown(60);

    const result = await updateUserEmail(newEmail.trim());

    if (result.success) {
      Alert.alert('Code Sent', 'A new verification code has been sent to your new email.');
    } else {
      Alert.alert('Error', result.error || 'Failed to resend code.');
      setResendCooldown(0);
    }
  };

  const handleBack = async () => {
    await haptics.light();
    if (step === 'verify') {
      setStep('email');
      setCode(Array(CODE_LENGTH).fill(''));
      setError('');
    } else {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
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
              <Ionicons
                name={step === 'email' ? 'mail' : 'checkmark-circle'}
                size={40}
                color={colors.primary.black}
              />
            </LinearGradient>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
            {step === 'email' ? 'Change Email' : 'Verify New Email'}
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(300)} style={styles.subtitle}>
            {step === 'email'
              ? `Your current email is\n${user?.email || ''}`
              : `We've sent a 6-digit code to\n${newEmail}`}
          </Animated.Text>

          {step === 'email' ? (
            <Animated.View entering={FadeInDown.delay(400)} style={styles.formContainer}>
              <Input
                label="New Email"
                placeholder="Enter new email address"
                value={newEmail}
                onChangeText={(text) => { setNewEmail(text); setError(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon="mail-outline"
              />
            </Animated.View>
          ) : (
            <>
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

              <Animated.View entering={FadeInDown.delay(500)} style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn't receive the code?</Text>
                <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
                  <Text style={[
                    styles.resendLink,
                    resendCooldown > 0 && styles.resendLinkDisabled,
                  ]}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}

          {error ? (
            <Animated.View entering={FadeIn} style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={16} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Button
          title={step === 'email' ? 'Send Verification Code' : 'Verify Email'}
          onPress={step === 'email' ? handleSendVerification : handleVerifyEmail}
          variant="primary"
          size="large"
          fullWidth
          loading={isLoading}
          disabled={
            step === 'email'
              ? !newEmail.trim() || isLoading
              : code.join('').length !== CODE_LENGTH || isLoading
          }
        />
      </View>
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
  formContainer: {
    width: '100%',
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
    marginTop: spacing.md,
    width: '100%',
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginLeft: spacing.sm,
    flex: 1,
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
