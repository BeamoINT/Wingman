import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
    Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Input } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useVerification } from '../../context/VerificationContext';
import {
    formatPhoneForDisplay, isValidPhoneNumber, sendPhoneOtp,
    verifyPhoneOtp
} from '../../services/api/phoneVerification';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'VerifyPhone'>;
type VerifyPhoneRouteProp = RouteProp<RootStackParamList, 'VerifyPhone'>;

const CODE_LENGTH = 6;

type VerificationStep = 'phone' | 'code';

export const VerifyPhoneScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyPhoneRouteProp>();
  const insets = useSafeAreaInsets();
  const { signupData, setPhoneVerified } = useAuth();
  const { refreshStatus } = useVerification();
  const isSignupFlow = route.params?.source === 'signup';

  const [step, setStep] = useState<VerificationStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState(signupData.phone || '');
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async () => {
    if (!isValidPhoneNumber(phoneNumber)) {
      setError('Please enter a valid phone number');
      await haptics.warning();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await sendPhoneOtp(phoneNumber);

      if (result.success) {
        await haptics.success();
        setStep('code');
        setResendCooldown(60);
      } else {
        setError(result.error || 'Failed to send verification code');
        await haptics.error();
      }
    } catch (err) {
      setError('Failed to send code. Please try again.');
      await haptics.error();
    } finally {
      setIsLoading(false);
    }
  };

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
      const result = await verifyPhoneOtp(phoneNumber, fullCode);

      if (result.verified) {
        await haptics.success();
        setPhoneVerified();
        await refreshStatus();

        Alert.alert(
          'Phone Verified',
          'Your phone number has been verified successfully.',
          [
            {
              text: 'Continue',
              onPress: () => {
                if (isSignupFlow) {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Tutorial' }],
                  });
                  return;
                }

                if (navigation.canGoBack()) {
                  navigation.goBack();
                  return;
                }

                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                });
              },
            },
          ]
        );
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

    const result = await sendPhoneOtp(phoneNumber);

    if (result.success) {
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone.');
    } else {
      Alert.alert('Error', result.error || 'Failed to resend code. Please try again.');
      setResendCooldown(0);
    }
  };

  const handleSkip = () => {
    if (isSignupFlow) {
      Alert.alert(
        'Phone Verification Required',
        'To continue signup, please verify your phone number.'
      );
      return;
    }

    Alert.alert(
      'Skip Phone Verification?',
      'You can verify your phone number later from your profile settings. Some features may be limited until verification.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          },
        },
      ]
    );
  };

  const renderPhoneStep = () => (
    <>
      <Animated.View entering={FadeIn.delay(100)} style={styles.iconContainer}>
        <LinearGradient
          colors={colors.gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="phone-portrait" size={40} color={colors.primary.black} />
        </LinearGradient>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
        Verify Your Phone
      </Animated.Text>

      <Animated.Text entering={FadeInDown.delay(300)} style={styles.subtitle}>
        Enter your phone number to receive a verification code via SMS.
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.inputContainer}>
        <Input
          label="Phone Number"
          placeholder="(555) 123-4567"
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            setError('');
          }}
          keyboardType="phone-pad"
          leftIcon="call-outline"
          error={error}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500)} style={styles.buttonContainer}>
        <Button
          title="Send Verification Code"
          onPress={handleSendCode}
          variant="primary"
          size="large"
          fullWidth
          loading={isLoading}
          disabled={!phoneNumber.trim()}
        />

        {!isSignupFlow && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </>
  );

  const renderCodeStep = () => (
    <>
      <Animated.View entering={FadeIn.delay(100)} style={styles.iconContainer}>
        <LinearGradient
          colors={colors.gradients.premium}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Ionicons name="chatbubble-ellipses" size={40} color={colors.primary.black} />
        </LinearGradient>
      </Animated.View>

      <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
        Enter Verification Code
      </Animated.Text>

      <Animated.Text entering={FadeInDown.delay(300)} style={styles.subtitle}>
        We've sent a 6-digit code to{'\n'}
        <Text style={styles.phoneText}>{formatPhoneForDisplay(phoneNumber)}</Text>
      </Animated.Text>

      <Animated.View entering={FadeInDown.delay(400)} style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
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
        <TouchableOpacity onPress={handleResend} disabled={resendCooldown > 0}>
          <Text
            style={[styles.resendLink, resendCooldown > 0 && styles.resendLinkDisabled]}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(600)} style={styles.buttonContainer}>
        <Button
          title="Verify Phone"
          onPress={handleVerify}
          variant="primary"
          size="large"
          fullWidth
          loading={isLoading}
          disabled={code.join('').length !== CODE_LENGTH}
        />

        <TouchableOpacity
          style={styles.changeButton}
          onPress={() => {
            setStep('phone');
            setCode(Array(CODE_LENGTH).fill(''));
            setError('');
          }}
        >
          <Text style={styles.changeText}>Change phone number</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step === 'code') {
              setStep('phone');
              setCode(Array(CODE_LENGTH).fill(''));
              setError('');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
      </ScrollView>
    </KeyboardAvoidingView>
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
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
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
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  phoneText: {
    color: colors.primary.blue,
    fontWeight: '600',
  },
  inputContainer: {
    width: '100%',
    marginBottom: spacing.lg,
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
    width: '100%',
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
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
  buttonContainer: {
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  skipText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  changeButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  changeText: {
    ...typography.presets.body,
    color: colors.primary.blue,
  },
});
