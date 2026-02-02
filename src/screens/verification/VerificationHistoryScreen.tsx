/**
 * VerificationHistoryScreen
 *
 * Shows all verification events for the user.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { Card, Skeleton } from '../../components';
import { useVerification } from '../../context/VerificationContext';
import type { VerificationEvent, VerificationEventType, VerificationEventStatus } from '../../types/verification';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EVENT_CONFIG: Record<VerificationEventType, {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}> = {
  email_verified: {
    icon: 'mail',
    label: 'Email Verified',
    color: colors.status.success,
  },
  phone_verified: {
    icon: 'call',
    label: 'Phone Verified',
    color: colors.status.success,
  },
  id_verified: {
    icon: 'card',
    label: 'ID Verified',
    color: colors.status.success,
  },
  id_verification_failed: {
    icon: 'card',
    label: 'ID Verification Failed',
    color: colors.status.error,
  },
  verification_level_upgraded: {
    icon: 'trending-up',
    label: 'Verification Level Upgraded',
    color: colors.verification.premium,
  },
  preferences_updated: {
    icon: 'settings',
    label: 'Preferences Updated',
    color: colors.text.secondary,
  },
};

const STATUS_CONFIG: Record<VerificationEventStatus, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  success: {
    icon: 'checkmark-circle',
    color: colors.status.success,
  },
  failed: {
    icon: 'close-circle',
    color: colors.status.error,
  },
  pending: {
    icon: 'time',
    color: colors.status.warning,
  },
};

export const VerificationHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { history, loadHistory, isLoading } = useVerification();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
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

  const renderItem = ({ item, index }: { item: VerificationEvent; index: number }) => {
    const eventConfig = EVENT_CONFIG[item.eventType] || {
      icon: 'information-circle',
      label: item.eventType.replace(/_/g, ' '),
      color: colors.text.secondary,
    };
    const statusConfig = STATUS_CONFIG[item.eventStatus];

    const cardStyle: ViewStyle = index === history.length - 1
      ? { ...styles.eventCard, ...styles.lastCard }
      : styles.eventCard;

    return (
      <Card
        variant="outlined"
        style={cardStyle}
      >
        <View style={styles.eventRow}>
          <View style={[styles.eventIcon, { backgroundColor: `${eventConfig.color}20` }]}>
            <Ionicons name={eventConfig.icon} size={20} color={eventConfig.color} />
          </View>

          <View style={styles.eventContent}>
            <View style={styles.eventHeader}>
              <Text style={styles.eventLabel}>{eventConfig.label}</Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}20` }]}>
                <Ionicons name={statusConfig.icon} size={12} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {item.eventStatus}
                </Text>
              </View>
            </View>

            <Text style={styles.eventDate}>{formatDate(item.createdAt)}</Text>

            {/* Show additional details if available */}
            {item.eventData && Object.keys(item.eventData).length > 0 && (
              <View style={styles.eventDetails}>
                {item.eventData.result !== undefined && (
                  <Text style={styles.detailText}>
                    Result: {String(item.eventData.result)}
                  </Text>
                )}
                {item.eventData.reason !== undefined && (
                  <Text style={styles.detailText}>
                    Reason: {String(item.eventData.reason).replace(/_/g, ' ')}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color={colors.text.muted} />
      <Text style={styles.emptyTitle}>No Verification History</Text>
      <Text style={styles.emptyDescription}>
        Your verification events will appear here as you complete verification steps.
      </Text>
    </View>
  );

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} width="100%" height={80} borderRadius={12} style={{ marginBottom: spacing.md }} />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification History</Text>
        <View style={styles.placeholder} />
      </View>

      {isLoading && !refreshing ? (
        renderLoading()
      ) : (
        <FlatList
          data={history}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary.blue}
            />
          }
        />
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
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
  placeholder: {
    width: 40,
  },
  listContent: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
  },
  loadingContainer: {
    padding: spacing.screenPadding,
  },
  eventCard: {
    marginBottom: spacing.md,
  },
  lastCard: {
    marginBottom: 0,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: typography.weights.medium,
    textTransform: 'capitalize',
  },
  eventDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  eventDetails: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  detailText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.huge,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
