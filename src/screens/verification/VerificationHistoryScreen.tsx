/**
 * VerificationHistoryScreen
 *
 * Shows all verification events for the user.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Card, Header, InlineBanner, ScreenScaffold, SectionHeader, Skeleton } from '../../components';
import { useTheme } from '../../context/ThemeContext';
import { useVerification } from '../../context/VerificationContext';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type {
  VerificationEvent,
  VerificationEventStatus,
  VerificationEventType,
} from '../../types/verification';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const getEventConfig = (
  tokens: ThemeTokens,
): Record<VerificationEventType, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> => ({
  email_verified: {
    icon: 'mail',
    label: 'Email Verified',
    color: tokens.colors.status.success,
  },
  phone_verified: {
    icon: 'call',
    label: 'Phone Verified',
    color: tokens.colors.status.success,
  },
  id_verified: {
    icon: 'card',
    label: 'ID Verified',
    color: tokens.colors.status.success,
  },
  id_verification_failed: {
    icon: 'card',
    label: 'ID Verification Failed',
    color: tokens.colors.status.error,
  },
  id_verification_started: {
    icon: 'play-circle',
    label: 'ID Verification Started',
    color: tokens.colors.status.warning,
  },
  id_verification_processing: {
    icon: 'time',
    label: 'ID Verification Processing',
    color: tokens.colors.status.warning,
  },
  id_verification_expired: {
    icon: 'alert-circle',
    label: 'ID Verification Expired',
    color: tokens.colors.status.error,
  },
  id_verification_reminder_sent: {
    icon: 'notifications',
    label: 'Expiry Reminder Sent',
    color: tokens.colors.accent.primary,
  },
  id_verification_invalidated_name_change: {
    icon: 'person-circle',
    label: 'Verification Reset (Name Change)',
    color: tokens.colors.status.warning,
  },
  id_verification_status_update: {
    icon: 'swap-horizontal',
    label: 'Verification Status Updated',
    color: tokens.colors.accent.primary,
  },
  verification_level_upgraded: {
    icon: 'trending-up',
    label: 'Verification Level Upgraded',
    color: tokens.colors.accent.primary,
  },
});

const getStatusConfig = (
  tokens: ThemeTokens,
): Record<VerificationEventStatus, { icon: keyof typeof Ionicons.glyphMap; color: string }> => ({
  success: {
    icon: 'checkmark-circle',
    color: tokens.colors.status.success,
  },
  failed: {
    icon: 'close-circle',
    color: tokens.colors.status.error,
  },
  pending: {
    icon: 'time',
    color: tokens.colors.status.warning,
  },
});

export const VerificationHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { history, loadHistory, isLoading } = useVerification();
  const [refreshing, setRefreshing] = useState(false);

  const eventConfig = useMemo(() => getEventConfig(tokens), [tokens]);
  const statusConfig = useMemo(() => getStatusConfig(tokens), [tokens]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const renderItem = ({ item }: { item: VerificationEvent }) => {
    const resolvedEvent = eventConfig[item.eventType] || {
      icon: 'information-circle' as const,
      label: item.eventType.replace(/_/g, ' '),
      color: tokens.colors.text.secondary,
    };

    const resolvedStatus = statusConfig[item.eventStatus];

    return (
      <Card variant="outlined" style={styles.eventCard}>
        <View style={styles.eventRow}>
          <View style={[styles.eventIcon, { backgroundColor: `${resolvedEvent.color}20` }]}>
            <Ionicons name={resolvedEvent.icon} size={18} color={resolvedEvent.color} />
          </View>

          <View style={styles.eventContent}>
            <View style={styles.eventTopRow}>
              <Text style={styles.eventLabel}>{resolvedEvent.label}</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${resolvedStatus.color}20` }]}>
                <Ionicons name={resolvedStatus.icon} size={12} color={resolvedStatus.color} />
                <Text style={[styles.statusText, { color: resolvedStatus.color }]}> 
                  {item.eventStatus}
                </Text>
              </View>
            </View>

            <Text style={styles.eventDate}>{formatDate(item.createdAt)}</Text>

            {item.eventData && Object.keys(item.eventData).length > 0 ? (
              <View style={styles.detailBlock}>
                {item.eventData.result !== undefined ? (
                  <Text style={styles.detailText}>Result: {String(item.eventData.result)}</Text>
                ) : null}
                {item.eventData.reason !== undefined ? (
                  <Text style={styles.detailText}>
                    Reason: {String(item.eventData.reason).replace(/_/g, ' ')}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={46} color={tokens.colors.text.muted} />
      <Text style={styles.emptyTitle}>No Verification History</Text>
      <Text style={styles.emptyDescription}>
        Your verification events will appear here as you complete verification steps.
      </Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3].map((row) => (
        <Skeleton
          key={row}
          width="100%"
          height={84}
          borderRadius={12}
          style={styles.loadingSkeleton}
        />
      ))}
    </View>
  );

  return (
    <ScreenScaffold
      scrollable
      hideHorizontalPadding
      withBottomPadding={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Header
        title="Verification History"
        showBack
        onBackPress={handleBackPress}
        transparent
      />
      <SectionHeader
        title="Event Timeline"
        subtitle="Recent verification and status updates"
      />

      <InlineBanner
        title="Verification access"
        message="Every user must complete ID and photo verification before finalizing a booking."
        variant="info"
      />

      {isLoading && !refreshing ? (
        renderLoading()
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tokens.colors.accent.primary}
            />
          }
        />
      )}
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    gap: spacing.sm,
  },
  loadingSkeleton: {
    marginBottom: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  separator: {
    height: spacing.sm,
  },
  eventCard: {
    padding: spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIcon: {
    width: 38,
    height: 38,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  eventTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  eventLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: spacing.radius.round,
    gap: spacing.xxs,
  },
  statusText: {
    ...typography.presets.caption,
    textTransform: 'capitalize',
  },
  eventDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  detailBlock: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.sm,
    gap: spacing.xxs,
  },
  detailText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.secondary,
  },
  emptyDescription: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
