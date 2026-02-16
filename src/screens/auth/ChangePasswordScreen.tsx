import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    Alert, KeyboardAvoidingView,
    Platform,
    ScrollView, StyleSheet, Text, View
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Header, Input, ScreenScaffold } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';
import { password as passwordValidator } from '../../utils/validation';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ChangePassword'>;

export const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors, spacing } = tokens;
  const { updateUserPassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUpdatePassword = async () => {
    if (!currentPassword.trim()) {
      setError('Please enter your current password');
      await haptics.warning();
      return;
    }

    const pwdError = passwordValidator()(newPassword);
    if (pwdError) {
      setError(pwdError);
      await haptics.warning();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      await haptics.warning();
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      await haptics.warning();
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await updateUserPassword(currentPassword, newPassword);

    if (result.success) {
      await haptics.success();
      Alert.alert(
        'Password Updated',
        'Your password has been changed successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      setError(result.error || 'Failed to update password');
      await haptics.error();
    }

    setIsLoading(false);
  };

  const handleBack = async () => {
    await haptics.light();
    navigation.goBack();
  };

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Header
          title="Change Password"
          showBack
          onBackPress={handleBack}
          transparent
        />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Animated.View entering={FadeIn.delay(100)} style={styles.iconContainer}>
            <View style={styles.iconBadge}>
              <Ionicons name="lock-closed" size={32} color={colors.accent.primary} />
            </View>
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(200)} style={styles.title}>
            Change Password
          </Animated.Text>

          <Animated.Text entering={FadeInDown.delay(300)} style={styles.subtitle}>
            Enter your current password and choose a new one.
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(400)} style={styles.formContainer}>
            <Input
              label="Current Password"
              placeholder="Enter current password"
              value={currentPassword}
              onChangeText={(text) => { setCurrentPassword(text); setError(''); }}
              secureTextEntry={!showCurrentPassword}
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
              rightIcon={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowCurrentPassword(!showCurrentPassword)}
            />

            <View style={styles.divider} />

            <Input
              label="New Password"
              placeholder="Enter new password"
              value={newPassword}
              onChangeText={(text) => { setNewPassword(text); setError(''); }}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              leftIcon="lock-open-outline"
              rightIcon={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowNewPassword(!showNewPassword)}
            />

            <Input
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              leftIcon="lock-open-outline"
              rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </Animated.View>

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
          title="Update Password"
          onPress={handleUpdatePassword}
          variant="primary"
          size="large"
          fullWidth
          loading={isLoading}
          disabled={!currentPassword || !newPassword || !confirmPassword || isLoading}
        />
      </View>
      </KeyboardAvoidingView>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
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
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: spacing.radius.xl,
    backgroundColor: colors.surface.level2,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.lg,
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
  footer: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.surface.level0,
  },
});
