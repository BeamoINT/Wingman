import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useVerification } from '../context/VerificationContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type VerificationRouteProp = RouteProp<RootStackParamList, 'Verification'>;

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'completed' | 'in_progress' | 'pending';
  action?: string;
}

export const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerificationRouteProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { emailVerified, phoneVerified, idVerified } = useVerification();

  const verificationSource = route.params?.source || 'profile';
  const openedFromFinalBookingStep = verificationSource === 'booking_final_step';
  const hasProfilePhoto = Boolean(user?.avatar?.trim());

  const verificationSteps = useMemo<VerificationStep[]>(
    () => [
      {
        id: 'email',
        title: 'Email Verification',
        description: 'Verify your email address',
        icon: 'mail',
        status: emailVerified ? 'completed' : 'pending',
      },
      {
        id: 'phone',
        title: 'Phone Verification',
        description: 'Verify your phone number',
        icon: 'call',
        status: phoneVerified ? 'completed' : 'pending',
      },
      {
        id: 'photo',
        title: 'Photo Verification',
        description: 'Upload a clear profile photo',
        icon: 'camera',
        status: hasProfilePhoto ? 'completed' : 'pending',
        action: !hasProfilePhoto && openedFromFinalBookingStep ? 'Add Photo' : undefined,
      },
      {
        id: 'id',
        title: 'ID Verification',
        description: 'Upload a government-issued ID',
        icon: 'card',
        status: idVerified ? 'completed' : openedFromFinalBookingStep ? 'in_progress' : 'pending',
        action: !idVerified && openedFromFinalBookingStep ? 'Start ID Verification' : undefined,
      },
    ],
    [emailVerified, phoneVerified, hasProfilePhoto, idVerified, openedFromFinalBookingStep],
  );

  const completedSteps = verificationSteps.filter((step) => step.status === 'completed').length;
  const progress = Math.round((completedSteps / verificationSteps.length) * 100);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const getStatusColor = (status: VerificationStep['status']) => {
    if (status === 'completed') return tokens.colors.status.success;
    if (status === 'in_progress') return tokens.colors.accent.primary;
    return tokens.colors.text.tertiary;
  };

  const getStatusIcon = (status: VerificationStep['status']): keyof typeof Ionicons.glyphMap => {
    if (status === 'completed') return 'checkmark-circle';
    if (status === 'in_progress') return 'time';
    return 'ellipse-outline';
  };

  const handleStepAction = async (step: VerificationStep) => {
    await haptics.medium();

    if (step.id === 'photo') {
      Alert.alert(
        'Add Profile Photo',
        'Upload a clear profile photo before confirming your booking.',
      );
      return;
    }

    if (step.id === 'id') {
      if (!openedFromFinalBookingStep) {
        Alert.alert(
          'ID Verification Happens at Checkout',
          'To control verification costs, ID checks only unlock at the final booking step right before payment.',
        );
        return;
      }

      Alert.alert(
        'Complete Verification',
        'Finish ID verification now, then return to complete your booking.',
      );
      return;
    }

    if (step.id === 'email' && !emailVerified) {
      Alert.alert(
        'Verify Your Email',
        'Use your email code sign-in flow to verify this account before booking.',
      );
      return;
    }

    if (step.id === 'phone' && !phoneVerified) {
      Alert.alert(
        'Verify Your Phone',
        'Complete phone verification from account settings before booking.',
      );
    }
  };

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header title="Verification" showBack onBackPress={handleBackPress} transparent />

      <Card variant="outlined" style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <View>
            <Text style={styles.progressTitle}>Verification Progress</Text>
            <Text style={styles.progressSubtitle}>
              {completedSteps} of {verificationSteps.length} steps completed
            </Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </Card>

      {!openedFromFinalBookingStep && (!idVerified || !hasProfilePhoto) ? (
        <InlineBanner
          title="Final-step verification"
          message="ID and photo verification only unlock right before checkout to reduce verification API costs."
          variant="info"
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Trust & Safety"
          subtitle="Every booking is protected by mandatory identity checks"
        />
        <Card variant="outlined" style={styles.benefitsCard}>
          {[
            'All users must complete ID verification before booking',
            'Photo verification prevents fake identity usage',
            'Phone verification adds account recovery protection',
            'Verification state is reviewed before final checkout',
          ].map((line) => (
            <View key={line} style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={tokens.colors.status.success} />
              <Text style={styles.benefitText}>{line}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Verification Steps"
          subtitle="Complete each required checkpoint"
        />

        {verificationSteps.map((step) => {
          const color = getStatusColor(step.status);
          return (
            <Card key={step.id} variant="outlined" style={styles.stepCard}>
              <View style={styles.stepRow}>
                <View style={[styles.stepIcon, { backgroundColor: `${color}20` }]}>
                  <Ionicons name={step.icon} size={22} color={color} />
                </View>

                <View style={styles.stepContent}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Ionicons name={getStatusIcon(step.status)} size={18} color={color} />
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>

                  {step.action ? (
                    <Button
                      title={step.action}
                      onPress={() => handleStepAction(step)}
                      variant={step.status === 'in_progress' ? 'primary' : 'outline'}
                      size="small"
                      style={styles.stepAction}
                    />
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </View>

      <InlineBanner
        title="Privacy"
        message="Verification documents are encrypted and used only for platform safety workflows."
        variant="success"
      />
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  progressCard: {
    gap: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  progressSubtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  progressBadge: {
    minWidth: 52,
    height: 36,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.accent.soft,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  progressPercent: {
    ...typography.presets.bodyMedium,
    color: colors.accent.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.surface.level2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.round,
  },
  section: {
    gap: spacing.sm,
  },
  benefitsCard: {
    gap: spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  benefitText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  stepCard: {
    marginBottom: spacing.sm,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: spacing.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  stepContent: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  stepTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  stepDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
    marginBottom: spacing.sm,
  },
  stepAction: {
    alignSelf: 'flex-start',
  },
});
