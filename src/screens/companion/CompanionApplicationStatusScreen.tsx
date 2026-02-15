/**
 * Companion Application Status Screen
 *
 * Shows the current status of the user's companion application.
 * Displayed after submission or when re-tapping "Become a Companion" with an active application.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card } from '../../components';
import { getCompanionApplication } from '../../services/api/companionApplicationApi';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { CompanionApplication, CompanionApplicationStatus, RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<CompanionApplicationStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  description: string;
  badgeVariant: 'info' | 'success' | 'warning' | 'error';
}> = {
  draft: {
    icon: 'document-outline',
    color: colors.text.tertiary,
    title: 'Application In Progress',
    description: 'You have an unfinished application. Continue where you left off.',
    badgeVariant: 'warning',
  },
  pending_review: {
    icon: 'time-outline',
    color: colors.primary.blue,
    title: 'Application Submitted',
    description: 'Your application is in the review queue. Our team typically reviews applications within 1-3 business days.',
    badgeVariant: 'info',
  },
  under_review: {
    icon: 'search-outline',
    color: colors.status.warning,
    title: 'Under Review',
    description: 'A team member is currently reviewing your application. You will be notified once a decision has been made.',
    badgeVariant: 'warning',
  },
  approved: {
    icon: 'checkmark-circle',
    color: colors.status.success,
    title: 'Application Approved',
    description: 'Congratulations! Your Wingman application has been approved. You can now access your Wingman Dashboard.',
    badgeVariant: 'success',
  },
  rejected: {
    icon: 'close-circle',
    color: colors.status.error,
    title: 'Application Not Approved',
    description: 'Unfortunately, your application was not approved at this time.',
    badgeVariant: 'error',
  },
  suspended: {
    icon: 'ban',
    color: colors.status.error,
    title: 'Account Suspended',
    description: 'Your Wingman account has been suspended. Please contact support for more information.',
    badgeVariant: 'error',
  },
};

export const CompanionApplicationStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
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
  const config = STATUS_CONFIG[status];

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Application Status</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadApplication(true)}
            tintColor={colors.primary.blue}
          />
        }
      >
        {/* Status Icon */}
        <View style={styles.statusIconContainer}>
          <View style={[styles.statusIconBg, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon} size={48} color={config.color} />
          </View>
        </View>

        {/* Status Info */}
        <Text style={styles.statusTitle}>{config.title}</Text>
        <View style={styles.badgeContainer}>
          <Badge
            label={status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            variant={config.badgeVariant}
            size="small"
          />
        </View>
        <Text style={styles.statusDescription}>{config.description}</Text>

        {/* Rejection reason */}
        {status === 'rejected' && application?.rejectionReason && (
          <Card variant="outlined" style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <Ionicons name="information-circle" size={18} color={colors.status.error} />
              <Text style={styles.rejectionLabel}>Reason</Text>
            </View>
            <Text style={styles.rejectionText}>{application.rejectionReason}</Text>
          </Card>
        )}

        {/* Timeline */}
        {(status === 'pending_review' || status === 'under_review') && (
          <Card variant="gradient" style={styles.timelineCard}>
            <Text style={styles.timelineTitle}>What Happens Next</Text>
            {[
              { label: 'Application Submitted', done: true, icon: 'checkmark-circle' as const },
              { label: 'Document Verification', done: status === 'under_review', icon: status === 'under_review' ? 'time' as const : 'ellipse-outline' as const },
              { label: 'Identity Matching', done: false, icon: 'ellipse-outline' as const },
              { label: 'Profile Approval', done: false, icon: 'ellipse-outline' as const },
            ].map((step, i) => (
              <View key={i} style={styles.timelineStep}>
                <Ionicons
                  name={step.icon}
                  size={20}
                  color={step.done ? colors.status.success : colors.text.tertiary}
                />
                <Text style={[
                  styles.timelineStepText,
                  step.done && styles.timelineStepDone,
                ]}>
                  {step.label}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Submitted date */}
        {application?.submittedAt && (
          <Text style={styles.submittedDate}>
            Submitted {new Date(application.submittedAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </Text>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {status === 'approved' && (
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
          )}

          {status === 'draft' && (
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
          )}

          {status === 'rejected' && (
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
          )}

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
      </ScrollView>
    </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 100,
  },
  statusIconContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  statusIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusDescription: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  rejectionCard: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rejectionLabel: {
    ...typography.presets.body,
    color: colors.status.error,
    fontWeight: typography.weights.semibold as any,
  },
  rejectionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  timelineCard: {
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  timelineTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  timelineStepText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  timelineStepDone: {
    color: colors.text.primary,
  },
  submittedDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actions: {
    gap: spacing.md,
  },
});
