/**
 * Companion Application Status Screen
 *
 * Shows the current status of the user's companion application.
 * Displayed after submission or when re-tapping "Become a Companion" with an active application.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Button, Card, Header, InlineBanner, ScreenScaffold, SectionHeader } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { getCompanionApplication } from '../../services/api/companionApplicationApi';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { CompanionApplication, CompanionApplicationStatus, RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface StatusConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
  badgeVariant: 'info' | 'success' | 'warning' | 'error';
}

const buildStatusConfig = (tokens: ThemeTokens): Record<CompanionApplicationStatus, StatusConfig> => ({
  draft: {
    icon: 'document-outline',
    color: tokens.colors.text.tertiary,
    title: 'Application In Progress',
    description: 'You have an unfinished application. Continue where you left off.',
    badgeVariant: 'warning',
  },
  pending_review: {
    icon: 'time-outline',
    color: tokens.colors.accent.primary,
    title: 'Application Submitted',
    description: 'Your application is in the review queue. Our team typically reviews applications within 1-3 business days.',
    badgeVariant: 'info',
  },
  under_review: {
    icon: 'search-outline',
    color: tokens.colors.status.warning,
    title: 'Under Review',
    description: 'A team member is currently reviewing your application. You will be notified once a decision has been made.',
    badgeVariant: 'warning',
  },
  approved: {
    icon: 'checkmark-circle',
    color: tokens.colors.status.success,
    title: 'Application Approved',
    description: 'Congratulations! Your Wingman application has been approved. You can now access your Wingman Dashboard.',
    badgeVariant: 'success',
  },
  rejected: {
    icon: 'close-circle',
    color: tokens.colors.status.error,
    title: 'Application Not Approved',
    description: 'Unfortunately, your application was not approved at this time.',
    badgeVariant: 'error',
  },
  suspended: {
    icon: 'ban',
    color: tokens.colors.status.error,
    title: 'Account Suspended',
    description: 'Your Wingman account has been suspended. Please contact support for more information.',
    badgeVariant: 'error',
  },
});

export const CompanionApplicationStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [application, setApplication] = useState<CompanionApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadApplication = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    const { application: app } = await getCompanionApplication();
    setApplication(app);
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleBack = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const status = application?.status || 'pending_review';
  const config = useMemo(() => buildStatusConfig(tokens)[status], [status, tokens]);

  if (isLoading) {
    return (
      <ScreenScaffold>
        <Header
          title="Application Status"
          showBack
          onBackPress={handleBack}
          rightIcon={isRefreshing ? 'sync' : 'refresh'}
          onRightPress={() => loadApplication(true)}
          transparent
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={tokens.colors.accent.primary} />
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header
        title="Application Status"
        showBack
        onBackPress={handleBack}
        rightIcon={isRefreshing ? 'sync' : 'refresh'}
        onRightPress={() => loadApplication(true)}
        transparent
      />

      <InlineBanner
        title="All wingmen are ID and photo verified"
        message="Applications are reviewed to maintain trusted in-person experiences."
        variant="info"
      />

      <Card variant="default" style={styles.statusPanel}>
        <View style={styles.statusIconContainer}>
          <View style={[styles.statusIconBg, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon} size={42} color={config.color} />
          </View>
        </View>

        <Text style={styles.statusTitle}>{config.title}</Text>

        <View style={styles.badgeContainer}>
          <Badge
            label={status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
            variant={config.badgeVariant}
            size="small"
          />
        </View>

        <Text style={styles.statusDescription}>{config.description}</Text>

        {status === 'rejected' && application?.rejectionReason ? (
          <Card variant="outlined" style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <Ionicons name="information-circle" size={18} color={tokens.colors.status.error} />
              <Text style={styles.rejectionLabel}>Reason</Text>
            </View>
            <Text style={styles.rejectionText}>{application.rejectionReason}</Text>
          </Card>
        ) : null}
      </Card>

      {(status === 'pending_review' || status === 'under_review') ? (
        <View style={styles.section}>
          <SectionHeader
            title="Review Timeline"
            subtitle="Progress of your submission"
          />
          <Card variant="outlined" style={styles.timelineCard}>
            {[
              { label: 'Application Submitted', done: true, icon: 'checkmark-circle' as const },
              {
                label: 'Document Verification',
                done: status === 'under_review',
                icon: status === 'under_review' ? 'time' as const : 'ellipse-outline' as const,
              },
              { label: 'Identity Matching', done: false, icon: 'ellipse-outline' as const },
              { label: 'Profile Approval', done: false, icon: 'ellipse-outline' as const },
            ].map((step) => (
              <View key={step.label} style={styles.timelineStep}>
                <Ionicons
                  name={step.icon}
                  size={18}
                  color={step.done ? tokens.colors.status.success : tokens.colors.text.tertiary}
                />
                <Text style={[styles.timelineStepText, step.done && styles.timelineStepDone]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {application?.submittedAt ? (
        <Text style={styles.submittedDate}>
          Submitted {new Date(application.submittedAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {status === 'approved' ? (
          <Button
            title="Go to Dashboard"
            onPress={async () => {
              await haptics.medium();
              navigation.navigate('CompanionDashboard');
            }}
            variant="primary"
            fullWidth
            icon="grid"
            iconPosition="left"
          />
        ) : null}

        {status === 'draft' ? (
          <Button
            title="Continue Application"
            onPress={async () => {
              await haptics.medium();
              navigation.navigate('CompanionOnboarding');
            }}
            variant="primary"
            fullWidth
            icon="arrow-forward"
            iconPosition="right"
          />
        ) : null}

        {status === 'rejected' ? (
          <Button
            title="Reapply"
            onPress={async () => {
              await haptics.medium();
              navigation.navigate('CompanionOnboarding');
            }}
            variant="primary"
            fullWidth
            icon="refresh"
            iconPosition="left"
          />
        ) : null}

        <Button
          title="Back to Profile"
          onPress={async () => {
            await haptics.light();
            navigation.navigate('Main');
          }}
          variant="ghost"
          fullWidth
        />
      </View>
    </ScreenScaffold>
  );
};

const createStyles = (tokens: ThemeTokens) => {
  const { colors, spacing, typography } = tokens;

  return StyleSheet.create({
      contentContainer: {
        gap: spacing.lg,
        paddingBottom: spacing.xxxl,
      },
      loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      },
      statusPanel: {
        alignItems: 'center',
        gap: spacing.sm,
      },
      statusIconContainer: {
        marginTop: spacing.sm,
      },
      statusIconBg: {
        width: 90,
        height: 90,
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
      },
      statusTitle: {
        ...typography.presets.h2,
        color: colors.text.primary,
        textAlign: 'center',
      },
      badgeContainer: {
        marginBottom: spacing.xs,
      },
      statusDescription: {
        ...typography.presets.body,
        color: colors.text.secondary,
        textAlign: 'center',
        lineHeight: 22,
      },
      rejectionCard: {
        marginTop: spacing.md,
        alignSelf: 'stretch',
      },
      rejectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
      },
      rejectionLabel: {
        ...typography.presets.bodyMedium,
        color: colors.status.error,
      },
      rejectionText: {
        ...typography.presets.bodySmall,
        color: colors.text.secondary,
      },
      section: {
        gap: spacing.sm,
      },
      timelineCard: {
        gap: spacing.sm,
      },
      timelineStep: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
      },
      timelineStepText: {
        ...typography.presets.body,
        color: colors.text.tertiary,
      },
      timelineStepDone: {
        color: colors.text.primary,
        fontWeight: typography.weights.semibold,
      },
      submittedDate: {
        ...typography.presets.caption,
        color: colors.text.tertiary,
        textAlign: 'center',
      },
      actions: {
        gap: spacing.sm,
      },
    });
};
