import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Header,
  InlineBanner,
  ProgressBar,
  ScreenScaffold,
  SectionHeader,
} from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { useVerification } from '../../context/VerificationContext';
import { getWingmanOnboardingState } from '../../services/api/wingmanOnboardingApi';
import { trackEvent } from '../../services/monitoring/events';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList, WingmanOnboardingState } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CompanionOnboarding'>;

const defaultState: WingmanOnboardingState = {
  currentStep: 1,
  totalSteps: 3,
  idVerificationCompleted: false,
  idVerificationStatus: 'unverified',
  idVerificationFailureCode: null,
  idVerificationFailureMessage: null,
  companionAgreementCompleted: false,
  companionAgreementVersion: null,
  companionAgreementAcceptedAt: null,
  profileSetupCompleted: false,
  profileSetupCompletedAt: null,
  onboardingLastStep: 1,
  companionId: null,
  companionApplicationStatus: null,
};

interface StepMeta {
  id: 1 | 2 | 3;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
  blocked: boolean;
}

export const CompanionOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    idVerificationStatus,
    idVerificationFailureMessage,
    startIdVerification,
    refreshStatus,
  } = useVerification();

  const [isLoading, setIsLoading] = useState(true);
  const [isLaunchingVerification, setIsLaunchingVerification] = useState(false);
  const [state, setState] = useState<WingmanOnboardingState>(defaultState);
  const completionTrackedRef = useRef({ step1: false, step2: false, step3: false });

  const loadState = useCallback(async () => {
    setIsLoading(true);
    const { state: nextState, error } = await getWingmanOnboardingState();

    if (error) {
      console.error('Failed to load wingman onboarding state:', error);
      trackEvent('wingman_onboarding_blocked', { reason: 'state_load_failed', message: error.message });
    }

    setState(nextState || defaultState);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadState();
      return undefined;
    }, [loadState]),
  );

  useEffect(() => {
    if (state.idVerificationCompleted && !completionTrackedRef.current.step1) {
      completionTrackedRef.current.step1 = true;
      trackEvent('wingman_onboarding_step_completed', { step: 1 });
    }

    if (state.companionAgreementCompleted && !completionTrackedRef.current.step2) {
      completionTrackedRef.current.step2 = true;
      trackEvent('wingman_onboarding_step_completed', { step: 2 });
    }

    if (state.profileSetupCompleted && !completionTrackedRef.current.step3) {
      completionTrackedRef.current.step3 = true;
      trackEvent('wingman_onboarding_step_completed', { step: 3 });
    }
  }, [state.companionAgreementCompleted, state.idVerificationCompleted, state.profileSetupCompleted]);

  const activeStep = useMemo<1 | 2 | 3>(() => state.currentStep, [state.currentStep]);

  const steps: StepMeta[] = useMemo(() => {
    const step1Completed = state.idVerificationCompleted;
    const step2Completed = state.companionAgreementCompleted;
    const step3Completed = state.profileSetupCompleted;

    return [
      {
        id: 1,
        title: 'Government ID Verification',
        description: 'Complete Stripe Identity with government ID + live selfie liveness capture.',
        icon: 'shield-checkmark',
        completed: step1Completed,
        blocked: false,
      },
      {
        id: 2,
        title: 'Accept Wingman Agreement',
        description: 'Read and accept the full agreement (scroll required before acceptance).',
        icon: 'document-text',
        completed: step2Completed,
        blocked: !step1Completed,
      },
      {
        id: 3,
        title: 'Set Up Wingman Profile',
        description: 'Set services, pricing, languages, bio, gallery, and availability, then publish.',
        icon: 'person-circle',
        completed: step3Completed,
        blocked: !(step1Completed && step2Completed),
      },
    ];
  }, [state.companionAgreementCompleted, state.idVerificationCompleted, state.profileSetupCompleted]);

  const completedSteps = steps.filter((step) => step.completed).length;
  const progressStep = state.profileSetupCompleted ? 3 : activeStep;

  const handleBack = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleLaunchIdVerification = async () => {
    if (isLaunchingVerification) {
      return;
    }

    setIsLaunchingVerification(true);
    await haptics.medium();
    trackEvent('wingman_onboarding_step_viewed', { step: 1 });

    try {
      const result = await startIdVerification();
      if (!result.success || !result.url) {
        Alert.alert('Unable to start verification', result.error || 'Please try again.');
        trackEvent('wingman_onboarding_blocked', {
          reason: 'start_id_verification_failed',
          message: result.error || 'unknown',
        });
        return;
      }

      trackEvent('id_verification_retry_started', { source: 'wingman_onboarding' });

      await WebBrowser.openBrowserAsync(result.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        showTitle: true,
      });

      await refreshStatus();
      await loadState();
    } catch (error) {
      console.error('Failed to launch Stripe Identity flow:', error);
      Alert.alert('Unable to start verification', 'Please try again.');
    } finally {
      setIsLaunchingVerification(false);
    }
  };

  const handleOpenAgreement = async () => {
    await haptics.medium();
    trackEvent('wingman_onboarding_step_viewed', { step: 2 });
    navigation.navigate('CompanionAgreement', { returnToOnboarding: true });
  };

  const handleOpenProfileSetup = async () => {
    await haptics.medium();
    trackEvent('wingman_onboarding_step_viewed', { step: 3 });
    navigation.navigate('WingmanProfileSetup', { source: 'onboarding' });
  };

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false}>
      <Header
        title={`Step ${progressStep} of 3`}
        showBack
        onBackPress={handleBack}
        transparent
      />

      <View style={styles.progressWrap}>
        <ProgressBar currentStep={progressStep} totalSteps={3} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InlineBanner
          title="Required onboarding order"
          message="You must complete 1) Stripe ID verification, 2) Wingman Agreement, then 3) profile setup. Steps cannot be skipped or reordered."
          variant="info"
        />

        {isLoading ? (
          <Card variant="outlined" style={styles.loadingCard}>
            <Text style={styles.loadingText}>Refreshing onboarding state…</Text>
          </Card>
        ) : null}

        {!state.idVerificationCompleted && idVerificationStatus === 'failed' ? (
          <InlineBanner
            title="Verification failed"
            message={idVerificationFailureMessage || state.idVerificationFailureMessage || 'Retry verification with a clear government-issued ID and live selfie capture.'}
            variant="warning"
          />
        ) : null}

        {!state.idVerificationCompleted && idVerificationStatus === 'failed_name_mismatch' ? (
          <InlineBanner
            title="Name mismatch"
            message={idVerificationFailureMessage || state.idVerificationFailureMessage || 'Your profile legal name must exactly match your government photo ID.'}
            variant="error"
          />
        ) : null}

        <View style={styles.section}>
          <SectionHeader
            title="Progress"
            subtitle={`${completedSteps} of 3 steps complete`}
          />

          <Card variant="outlined" style={styles.stepCard}>
            {steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.stepLeft}>
                  <View style={styles.stepIconWrap}>
                    <Ionicons
                      name={step.completed ? 'checkmark-circle' : step.icon}
                      size={20}
                      color={step.completed ? tokens.colors.status.success : tokens.colors.accent.primary}
                    />
                  </View>
                  <View style={styles.stepTextWrap}>
                    <Text style={styles.stepTitle}>{`Step ${step.id}: ${step.title}`}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>
                </View>
                {step.completed ? (
                  <Text style={styles.stepComplete}>Done</Text>
                ) : step.blocked ? (
                  <Text style={styles.stepBlocked}>Locked</Text>
                ) : (
                  <Text style={styles.stepCurrent}>Current</Text>
                )}
              </View>
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Current Step"
            subtitle={
              activeStep === 1
                ? 'Complete Stripe Identity verification'
                : activeStep === 2
                  ? 'Accept Wingman Agreement'
                  : 'Set up your Wingman profile'
            }
          />

          {activeStep === 1 ? (
            <Card variant="outlined" style={styles.actionCard}>
              <Text style={styles.actionBody}>
                Stripe Identity requires a government-issued photo ID and a live selfie liveness capture. Uploaded gallery selfies are not allowed.
              </Text>
              <Button
                title={
                  isLaunchingVerification
                    ? 'Launching…'
                    : idVerificationStatus === 'pending'
                      ? 'Continue Verification'
                      : idVerificationStatus === 'failed' || idVerificationStatus === 'failed_name_mismatch'
                        ? 'Retry Verification'
                        : 'Start Verification'
                }
                onPress={handleLaunchIdVerification}
                loading={isLaunchingVerification}
                disabled={isLaunchingVerification || isLoading}
                icon="shield-checkmark"
                iconPosition="left"
                fullWidth
              />
            </Card>
          ) : null}

          {activeStep === 2 ? (
            <Card variant="outlined" style={styles.actionCard}>
              <Text style={styles.actionBody}>
                You must read the full agreement and scroll through it before acceptance is enabled.
              </Text>
              <Button
                title={state.companionAgreementCompleted ? 'Agreement Accepted' : 'Open Wingman Agreement'}
                onPress={handleOpenAgreement}
                disabled={state.companionAgreementCompleted || isLoading}
                icon="document-text"
                iconPosition="left"
                fullWidth
              />
            </Card>
          ) : null}

          {activeStep === 3 ? (
            <Card variant="outlined" style={styles.actionCard}>
              <Text style={styles.actionBody}>
                Configure your services, pricing, bio, languages, and gallery. Saving step 3 publishes your wingman profile immediately.
              </Text>
              <Button
                title={state.profileSetupCompleted ? 'Profile Published' : 'Set Up Wingman Profile'}
                onPress={handleOpenProfileSetup}
                disabled={isLoading}
                icon="create"
                iconPosition="left"
                fullWidth
              />
            </Card>
          ) : null}
        </View>

        {state.profileSetupCompleted ? (
          <Card variant="outlined" style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={24} color={tokens.colors.status.success} />
            <View style={styles.doneTextWrap}>
              <Text style={styles.doneTitle}>Onboarding complete</Text>
              <Text style={styles.doneBody}>Your wingman profile is live.</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CompanionDashboard')}
              style={styles.doneAction}
            >
              <Text style={styles.doneActionText}>Dashboard</Text>
            </TouchableOpacity>
          </Card>
        ) : null}
      </ScrollView>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  progressWrap: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  loadingCard: {
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  stepCard: {
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stepLeft: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  stepIconWrap: {
    marginTop: 2,
  },
  stepTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  stepTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  stepDescription: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  stepComplete: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  stepBlocked: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  stepCurrent: {
    ...typography.presets.caption,
    color: colors.accent.primary,
  },
  actionCard: {
    gap: spacing.md,
  },
  actionBody: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 21,
  },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  doneTextWrap: {
    flex: 1,
  },
  doneTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  doneBody: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  doneAction: {
    borderRadius: spacing.radius.round,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  doneActionText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
  },
});
