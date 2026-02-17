import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
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
import { formatIdVerificationDate } from '../utils/idVerification';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type VerificationRouteProp = RouteProp<RootStackParamList, 'Verification'>;

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
  action?: string;
}

export const VerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerificationRouteProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const {
    emailVerified,
    phoneVerified,
    idVerified,
    idVerificationStatus,
    idVerificationExpiresAt,
    idVerifiedAt,
    idVerificationReminder,
    refreshStatus,
    startIdVerification,
  } = useVerification();
  const [isStartingIdVerification, setIsStartingIdVerification] = React.useState(false);

  const verificationSource = route.params?.source || 'profile';
  const openedFromFinalBookingStep = verificationSource === 'booking_final_step';
  const hasProfilePhoto = Boolean(user?.avatar?.trim());
  const photoIdMatchAttested = user?.profilePhotoIdMatchAttested === true;

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
        description: 'Use a clear profile photo that visibly matches your government photo ID',
        icon: 'camera',
        status: hasProfilePhoto && photoIdMatchAttested ? 'completed' : 'pending',
        action: (!hasProfilePhoto || !photoIdMatchAttested) && openedFromFinalBookingStep
          ? 'Update Photo'
          : undefined,
      },
      {
        id: 'id',
        title: 'ID Verification',
        description: (() => {
          if (idVerified && idVerificationExpiresAt) {
            return `Verified until ${new Date(idVerificationExpiresAt).toLocaleDateString('en-US')}`;
          }
          if (idVerificationStatus === 'pending') {
            return 'Continue your in-progress ID verification';
          }
          if (idVerificationStatus === 'failed_name_mismatch') {
            return 'Your legal profile name must exactly match your government ID';
          }
          if (idVerificationStatus === 'expired') {
            return 'Verification expired. Re-verify to continue booking';
          }
          if (idVerificationStatus === 'failed') {
            return 'Verification failed. Retry with a clear government-issued ID';
          }
          return 'Upload a government-issued ID';
        })(),
        icon: 'card',
        status: idVerified
          ? 'completed'
          : idVerificationStatus === 'pending'
            ? 'in_progress'
            : (idVerificationStatus === 'failed_name_mismatch' || idVerificationStatus === 'failed' || idVerificationStatus === 'expired')
              ? 'failed'
              : (openedFromFinalBookingStep ? 'in_progress' : 'pending'),
        action: !idVerified
          ? (
            idVerificationStatus === 'expired'
              ? 'Re-verify ID'
              : idVerificationStatus === 'failed_name_mismatch' || idVerificationStatus === 'failed'
                ? 'Retry ID Verification'
                : 'Start ID Verification'
          )
          : undefined,
      },
    ],
    [
      emailVerified,
      phoneVerified,
      hasProfilePhoto,
      photoIdMatchAttested,
      idVerified,
      idVerificationStatus,
      idVerificationExpiresAt,
      openedFromFinalBookingStep,
    ],
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
    if (status === 'failed') return tokens.colors.status.error;
    return tokens.colors.text.tertiary;
  };

  const getStatusIcon = (status: VerificationStep['status']): keyof typeof Ionicons.glyphMap => {
    if (status === 'completed') return 'checkmark-circle';
    if (status === 'in_progress') return 'time';
    if (status === 'failed') return 'alert-circle';
    return 'ellipse-outline';
  };

  const handleStepAction = async (step: VerificationStep) => {
    await haptics.medium();

    if (step.id === 'photo') {
      navigation.navigate('EditProfile');
      return;
    }

    if (step.id === 'id') {
      if (isStartingIdVerification) {
        return;
      }

      setIsStartingIdVerification(true);
      try {
        const result = await startIdVerification();
        if (!result.success || !result.url) {
          Alert.alert('Verification Unavailable', result.error || 'Unable to start ID verification right now.');
          return;
        }

        await WebBrowser.openBrowserAsync(result.url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          showTitle: true,
        });

        await refreshStatus();

        if (openedFromFinalBookingStep) {
          Alert.alert(
            'Return to Booking',
            'ID verification session opened. Return to booking once verification is complete.',
          );
        }
      } catch (error) {
        console.error('Failed to start ID verification:', error);
        Alert.alert('Verification Unavailable', 'Unable to start ID verification right now.');
      } finally {
        setIsStartingIdVerification(false);
      }
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

      <Card variant="outlined" style={styles.verificationMetaCard}>
        <View style={styles.verificationMetaRow}>
          <Text style={styles.verificationMetaLabel}>ID status</Text>
          <Text style={styles.verificationMetaValue}>{idVerificationStatus.replace(/_/g, ' ')}</Text>
        </View>
        <View style={styles.verificationMetaRow}>
          <Text style={styles.verificationMetaLabel}>Verified since</Text>
          <Text style={styles.verificationMetaValue}>
            {idVerifiedAt ? formatIdVerificationDate(idVerifiedAt) : 'Not verified'}
          </Text>
        </View>
        <View style={styles.verificationMetaRow}>
          <Text style={styles.verificationMetaLabel}>Verified until</Text>
          <Text style={styles.verificationMetaValue}>
            {idVerificationExpiresAt ? formatIdVerificationDate(idVerificationExpiresAt) : 'Not set'}
          </Text>
        </View>
      </Card>

      {idVerificationReminder.stage && idVerificationReminder.stage !== 'expired' ? (
        <InlineBanner
          title="Re-verification reminder"
          message={`Your ID verification expires in ${idVerificationReminder.stage} day${idVerificationReminder.stage === 1 ? '' : 's'}. Re-verify now to avoid booking interruptions.`}
          variant="warning"
        />
      ) : null}

      {(idVerificationReminder.stage === 'expired' || idVerificationStatus === 'expired') ? (
        <InlineBanner
          title="Verification expired"
          message="Your ID verification has expired. Re-verify before continuing with bookings."
          variant="error"
        />
      ) : null}

      {idVerificationStatus === 'failed_name_mismatch' ? (
        <InlineBanner
          title="Name mismatch"
          message="Your profile legal name must match your government photo ID exactly. Update your profile name or retry with matching ID."
          variant="error"
        />
      ) : null}

      {!openedFromFinalBookingStep && (!idVerified || !hasProfilePhoto) ? (
        <InlineBanner
          title="Final-step verification"
          message="Your legal profile name and profile photo must exactly match your government photo ID."
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
            'Profile legal name must exactly match submitted photo ID name',
            'Profile photos must clearly match the submitted photo ID',
            'Phone verification adds account recovery protection',
            'ID verification must be renewed every 3 years',
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
                      variant={(step.status === 'in_progress' || step.status === 'failed') ? 'primary' : 'outline'}
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
        message="Verification documents are encrypted and used only for safety workflows. Name matching is required for every ID verification."
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
  verificationMetaCard: {
    gap: spacing.sm,
  },
  verificationMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  verificationMetaLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  verificationMetaValue: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    textTransform: 'capitalize',
    flex: 1,
    textAlign: 'right',
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
