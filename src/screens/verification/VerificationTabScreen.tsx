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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Card,
  Header,
  InlineBanner,
  ScreenScaffold,
  SectionHeader,
  Skeleton,
} from '../../components';
import {
  VerificationStatusCard,
  VerificationStepItem,
} from '../../components/verification';
import { useVerification } from '../../context/VerificationContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const VerificationTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
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
      <ScreenScaffold scrollable contentContainerStyle={styles.loadingContainer}>
        <Header title="Verification" transparent />
        <Skeleton width="100%" height={150} borderRadius={16} />
        <View style={styles.loadingSpacer} />
        <Skeleton width="100%" height={220} borderRadius={16} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header title="Verification" transparent />

      <InlineBanner
        title="Identity checks protect every booking"
        message="All users must complete ID and photo verification before checkout."
        variant="info"
      />

      <VerificationStatusCard
        overallStatus={overallStatus}
        verificationLevel={verificationLevel}
        completedSteps={completedStepsCount}
        totalSteps={totalStepsCount}
      />

      <View style={styles.section}>
        <SectionHeader
          title="Verification Steps"
          subtitle="Complete each step to unlock booking access"
        />
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

      <View style={styles.section}>
        <SectionHeader title="History" subtitle="Review your verification timeline" />
        <Card variant="outlined" style={styles.actionsCard}>
          <TouchableOpacity style={styles.actionRow} onPress={handleHistoryPress}>
            <View style={styles.actionIcon}>
              <Ionicons name="time-outline" size={20} color={tokens.colors.accent.primary} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionLabel}>Verification History</Text>
              <Text style={styles.actionDescription}>View completed and pending verification events</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tokens.colors.text.tertiary} />
          </TouchableOpacity>
        </Card>
      </View>

      <View style={styles.refreshWrap}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons
            name={refreshing ? 'sync' : 'refresh-outline'}
            size={16}
            color={tokens.colors.accent.primary}
          />
          <Text style={styles.refreshLabel}>{refreshing ? 'Refreshing…' : 'Refresh Status'}</Text>
        </TouchableOpacity>
      </View>

      <InlineBanner
        title="Verification requirement"
        message="Every user must be ID and photo verified before completing a booking on Wingman."
        variant="success"
      />
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  loadingContainer: {
    paddingBottom: spacing.xxxl,
  },
  loadingSpacer: {
    height: spacing.lg,
  },
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.sm,
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
    backgroundColor: colors.accent.soft,
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
  refreshWrap: {
    alignItems: 'flex-start',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  refreshLabel: {
    ...typography.presets.caption,
    color: colors.accent.primary,
  },
});
