/**
 * VerificationTabScreen
 *
 * Main verification tab showing user's verification status, steps, and actions.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
    RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Skeleton } from '../../components';
import {
    VerificationStatusCard,
    VerificationStepItem
} from '../../components/verification';
import { useVerification } from '../../context/VerificationContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const VerificationTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    isLoading,
    overallStatus,
    verificationLevel,
    completedStepsCount,
    totalStepsCount,
    getVerificationSteps,
    refreshStatus,
  } = useVerification();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStatus();
    setRefreshing(false);
  };

  const handleHistoryPress = async () => {
    await haptics.light();
    navigation.navigate('VerificationHistory');
  };

  const handlePhoneVerificationPress = useCallback(async () => {
    await haptics.light();
    navigation.navigate('VerifyPhone', { source: 'profile' });
  }, [navigation]);

  const verificationSteps = getVerificationSteps();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.headerContent}>
            <Ionicons name="shield-checkmark" size={28} color={colors.primary.blue} />
            <Text style={styles.headerTitle}>Verification</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <Skeleton width="100%" height={140} borderRadius={16} />
          <View style={{ height: spacing.lg }} />
          <Skeleton width="100%" height={200} borderRadius={16} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerContent}>
          <Ionicons name="shield-checkmark" size={28} color={colors.primary.blue} />
          <Text style={styles.headerTitle}>Verification</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        }
      >
        {/* Status Card */}
        <View style={styles.section}>
          <VerificationStatusCard
            overallStatus={overallStatus}
            verificationLevel={verificationLevel}
            completedSteps={completedStepsCount}
            totalSteps={totalStepsCount}
          />
        </View>

        {/* Verification Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Steps</Text>
          <Card variant="outlined" style={styles.stepsCard}>
            {verificationSteps.map((step, index) => (
              <VerificationStepItem
                key={step.id}
                step={step}
                onActionPress={step.id === 'phone' ? handlePhoneVerificationPress : undefined}
                isLast={index === verificationSteps.length - 1}
              />
            ))}
          </Card>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          <Card variant="outlined" style={styles.actionsCard}>
            <TouchableOpacity style={styles.actionRow} onPress={handleHistoryPress}>
              <View style={styles.actionIcon}>
                <Ionicons name="time-outline" size={20} color={colors.primary.blue} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>Verification History</Text>
                <Text style={styles.actionDescription}>
                  View all verification events
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={24} color={colors.text.tertiary} />
            <Text style={styles.infoText}>
              Every user must be ID verified before they can complete a booking on Wingman.
            </Text>
          </View>
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
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  loadingContainer: {
    padding: spacing.screenPadding,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  stepsCard: {
    padding: spacing.md,
  },
  actionsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  actionDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xxs,
  },
  infoSection: {
    padding: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  infoText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    flex: 1,
    lineHeight: 18,
  },
});
