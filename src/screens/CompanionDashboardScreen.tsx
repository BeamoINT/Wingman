import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card } from '../components';
import { useAuth } from '../context/AuthContext';
import type { BookingData } from '../services/api/bookingsApi';
import {
    cancelBooking,
    fetchCompanionBookings,
    fetchCompanionEarnings,
    updateBookingStatus
} from '../services/api/bookingsApi';
import { getOrCreateConversation } from '../services/api/messages';
import { supabase } from '../services/supabase';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TimeRange = 'week' | 'month' | 'year';

interface Booking {
  id: string;
  clientId: string;
  user: { name: string; avatar: string };
  date: string;
  time: string;
  duration: number;
  amount: number;
  status: 'upcoming' | 'completed' | 'pending';
  activity: string;
}

interface CompanionStats {
  rating: number;
  reviewCount: number;
  responseTime: string;
  completionRate: number;
  repeatClientRate: number;
  isAvailable: boolean;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatBookingDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeLabel(time: string): string {
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${(Number.isNaN(minutes) ? 0 : minutes).toString().padStart(2, '0')} ${period}`;
}

export const CompanionDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [earnings, setEarnings] = useState<{ week: number; month: number; year: number; total: number }>({
    week: 0,
    month: 0,
    year: 0,
    total: 0,
  });
  const [stats, setStats] = useState<CompanionStats>({
    rating: 0,
    reviewCount: 0,
    responseTime: 'Usually responds within 1 hour',
    completionRate: 0,
    repeatClientRate: 0,
    isAvailable: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [{ bookings: companionBookings, error: bookingsError }, { earnings: earningsData, error: earningsError }] = await Promise.all([
        fetchCompanionBookings(),
        fetchCompanionEarnings(),
      ]);

      if (bookingsError) {
        console.error('Error loading companion bookings:', bookingsError);
        setError(bookingsError.message || 'Unable to load dashboard bookings.');
      }

      if (earningsError) {
        console.error('Error loading companion earnings:', earningsError);
        setError((current) => current || earningsError.message || 'Unable to load dashboard earnings.');
      } else {
        setEarnings(earningsData);
      }

      const safeBookings = companionBookings || [];
      setBookings(safeBookings);

      if (user?.id) {
        const { data: companionRow, error: companionError } = await supabase
          .from('companions')
          .select('rating, review_count, response_time, is_available')
          .eq('user_id', user.id)
          .maybeSingle();

        if (companionError) {
          console.error('Error loading companion stats:', companionError);
        }

        const completed = safeBookings.filter((booking) => booking.status === 'completed');
        const completedOrCancelled = safeBookings.filter((booking) => (
          booking.status === 'completed'
          || booking.status === 'cancelled'
          || booking.status === 'disputed'
        ));
        const uniqueClients = new Set(completed.map((booking) => booking.client_id).filter(Boolean)).size;
        const repeatClients = Math.max(completed.length - uniqueClients, 0);

        const companionRecord = companionRow as Record<string, unknown> | null;
        setStats({
          rating: toNumber(companionRecord?.rating, 0),
          reviewCount: Math.max(0, Math.round(toNumber(companionRecord?.review_count, 0))),
          responseTime: String(companionRecord?.response_time || 'Usually responds within 1 hour'),
          completionRate: completedOrCancelled.length > 0
            ? Math.round((completed.length / completedOrCancelled.length) * 100)
            : 0,
          repeatClientRate: completed.length > 0
            ? Math.round((repeatClients / completed.length) * 100)
            : 0,
          isAvailable: companionRecord?.is_available === true,
        });
      }
    } catch (loadError) {
      console.error('Error loading companion dashboard:', loadError);
      setError('Something went wrong while loading your dashboard.');
      setBookings([]);
      setEarnings({ week: 0, month: 0, year: 0, total: 0 });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const isOnline = stats.isAvailable;

  const currentData = useMemo(() => {
    const now = new Date();
    const rangeStart = timeRange === 'week'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : timeRange === 'month'
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const completedInRange = bookings.filter((booking) => (
      booking.status === 'completed'
      && new Date(booking.created_at) >= rangeStart
    ));

    const completedHours = completedInRange.reduce(
      (sum, booking) => sum + Math.max(0, Math.round(toNumber(booking.duration_hours, 0))),
      0
    );

    return {
      total: timeRange === 'week' ? earnings.week : timeRange === 'month' ? earnings.month : earnings.year,
      bookings: completedInRange.length,
      hours: completedHours,
    };
  }, [bookings, earnings.month, earnings.week, earnings.year, timeRange]);

  const visibleBookings = useMemo<Booking[]>(() => (
    bookings
      .filter((booking) => booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in_progress')
      .slice(0, 6)
      .map((booking) => ({
        id: booking.id,
        clientId: booking.client_id || '',
        user: {
          name: `${booking.client?.first_name || 'Client'} ${booking.client?.last_name || ''}`.trim(),
          avatar: booking.client?.avatar_url || '',
        },
        date: formatBookingDateLabel(booking.date),
        time: formatTimeLabel(booking.start_time),
        duration: Math.max(0, Math.round(toNumber(booking.duration_hours, 0))),
        amount: Math.round(toNumber(booking.subtotal, 0) * 0.9),
        status: booking.status === 'pending' ? 'pending' : 'upcoming',
        activity: booking.activity_type || 'Wingman booking',
      }))
  ), [bookings]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const toggleOnlineStatus = async () => {
    await haptics.medium();
    if (!user?.id) return;

    const { error: updateError } = await supabase
      .from('companions')
      .update({ is_available: !isOnline })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating companion availability:', updateError);
      setError('Unable to update your availability right now.');
      return;
    }

    await loadDashboardData(true);
  };

  const handleAcceptBooking = useCallback(async (bookingId: string) => {
    await haptics.success();
    const { success, error: updateError } = await updateBookingStatus(bookingId, 'confirmed');
    if (!success || updateError) {
      console.error('Error accepting booking:', updateError);
      setError(updateError?.message || 'Unable to accept booking right now.');
      return;
    }

    await loadDashboardData(true);
  }, [loadDashboardData]);

  const handleDeclineBooking = useCallback(async (bookingId: string) => {
    await haptics.light();
    const { success, error: declineError } = await cancelBooking(bookingId, 'Declined by wingman');
    if (!success || declineError) {
      console.error('Error declining booking:', declineError);
      setError(declineError?.message || 'Unable to decline booking right now.');
      return;
    }

    await loadDashboardData(true);
  }, [loadDashboardData]);

  const handleMessageClient = useCallback(async (clientId: string) => {
    if (!clientId) {
      setError('Client details are unavailable for this booking.');
      return;
    }

    const { conversation, error: conversationError } = await getOrCreateConversation(clientId);
    if (!conversation?.id || conversationError) {
      console.error('Error opening conversation:', conversationError);
      setError(conversationError?.message || 'Unable to open messages right now.');
      return;
    }

    await haptics.light();
    navigation.navigate('Chat', { conversationId: conversation.id });
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wingman Dashboard</Text>
        <TouchableOpacity onPress={() => loadDashboardData(true)}>
          <Ionicons
            name={isRefreshing ? 'sync' : 'refresh'}
            size={24}
            color={colors.text.primary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {error && (
          <View style={styles.section}>
            <Card variant="outlined" style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          </View>
        )}

        {/* Status Toggle */}
        <View style={styles.section}>
          <Card
            variant="gradient"
            style={styles.statusCard}
            onPress={toggleOnlineStatus}
          >
            <View style={styles.statusContent}>
              <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>
                  {isOnline ? 'You\'re Online' : 'You\'re Offline'}
                </Text>
                <Text style={styles.statusDescription}>
                  {isOnline
                    ? 'Receiving booking requests'
                    : 'Tap to go online and receive requests'}
                </Text>
              </View>
              <View style={[styles.statusToggle, isOnline && styles.statusToggleActive]}>
                <View style={[styles.toggleKnob, isOnline && styles.toggleKnobActive]} />
              </View>
            </View>
          </Card>
        </View>

        {/* Earnings Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.timeRangeSelector}>
              {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    timeRange === range && styles.timeRangeButtonActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setTimeRange(range);
                  }}
                >
                  <Text style={[
                    styles.timeRangeText,
                    timeRange === range && styles.timeRangeTextActive,
                  ]}>
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.earningsCard}
          >
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsAmount}>${currentData.total.toLocaleString()}</Text>

            <View style={styles.earningsStats}>
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>{currentData.bookings}</Text>
                <Text style={styles.earningStatLabel}>Bookings</Text>
              </View>
              <View style={styles.earningsStatDivider} />
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>{currentData.hours}</Text>
                <Text style={styles.earningStatLabel}>Hours</Text>
              </View>
              <View style={styles.earningsStatDivider} />
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>
                  ${currentData.hours > 0 ? Math.round(currentData.total / currentData.hours) : 0}
                </Text>
                <Text style={styles.earningStatLabel}>Avg/Hour</Text>
              </View>
            </View>
          </LinearGradient>

          <TouchableOpacity style={styles.withdrawButton} onPress={() => haptics.medium()}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary.blue} />
            <Text style={styles.withdrawText}>Withdraw Earnings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                <Ionicons name="star" size={20} color={colors.primary.gold} />
              </View>
              <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : '--'}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(78, 205, 196, 0.15)' }]}>
                <Ionicons name="flash" size={20} color={colors.primary.blue} />
              </View>
              <Text style={styles.statValue}>
                {stats.responseTime.includes('hour')
                  ? stats.responseTime.replace('Usually responds within ', '')
                  : stats.responseTime}
              </Text>
              <Text style={styles.statLabel}>Avg Response</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              </View>
              <Text style={styles.statValue}>{stats.completionRate}%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                <Ionicons name="repeat" size={20} color={colors.verification.trusted} />
              </View>
              <Text style={styles.statValue}>{stats.repeatClientRate}%</Text>
              <Text style={styles.statLabel}>Repeat Clients</Text>
            </Card>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
            <TouchableOpacity onPress={() => haptics.light()}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {visibleBookings.length === 0 && !isLoading && (
            <Card variant="outlined" style={styles.emptyBookingsCard}>
              <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
              <Text style={styles.emptyBookingsText}>No upcoming bookings yet.</Text>
            </Card>
          )}

          {isLoading && (
            <Card variant="outlined" style={styles.emptyBookingsCard}>
              <ActivityIndicator size="small" color={colors.primary.blue} />
              <Text style={styles.emptyBookingsText}>Loading bookings...</Text>
            </Card>
          )}

          {visibleBookings.map((booking) => (
            <Card key={booking.id} variant="outlined" style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Avatar source={booking.user.avatar} name={booking.user.name} size="small" />
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingName}>{booking.user.name}</Text>
                  <Text style={styles.bookingActivity}>{booking.activity}</Text>
                </View>
                <Badge
                  label={booking.status === 'pending' ? 'Pending' : 'Confirmed'}
                  variant={booking.status === 'pending' ? 'warning' : 'success'}
                  size="small"
                />
              </View>

              <View style={styles.bookingDetails}>
                <View style={styles.bookingDetail}>
                  <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.date}</Text>
                </View>
                <View style={styles.bookingDetail}>
                  <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.time}</Text>
                </View>
                <View style={styles.bookingDetail}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.duration}h</Text>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.bookingAmount}>${booking.amount}</Text>
                {booking.status === 'pending' ? (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={styles.declineButton}
                      onPress={() => handleDeclineBooking(booking.id)}
                    >
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.acceptButton}
                      onPress={() => handleAcceptBooking(booking.id)}
                    >
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={() => handleMessageClient(booking.clientId)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={colors.primary.blue} />
                    <Text style={styles.messageText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.tipsCard}>
            <Ionicons name="bulb-outline" size={24} color={colors.primary.gold} />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Boost Your Earnings</Text>
              <Text style={styles.tipsText}>
                Complete your video introduction to get 40% more booking requests!
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </Card>
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
  scrollView: {
    flex: 1,
  },
  section: {
    padding: spacing.screenPadding,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: colors.status.error,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  seeAllText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  statusCard: {
    padding: spacing.lg,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.tertiary,
    marginRight: spacing.md,
  },
  statusDotOnline: {
    backgroundColor: colors.status.success,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  statusDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background.tertiary,
    padding: 3,
  },
  statusToggleActive: {
    backgroundColor: colors.status.success,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text.primary,
  },
  toggleKnobActive: {
    marginLeft: 20,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.sm,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.background.card,
  },
  timeRangeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  timeRangeTextActive: {
    color: colors.text.primary,
  },
  earningsCard: {
    padding: spacing.xl,
    borderRadius: spacing.radius.xl,
    marginBottom: spacing.md,
  },
  earningsLabel: {
    ...typography.presets.bodySmall,
    color: colors.primary.darkBlack,
    opacity: 0.8,
  },
  earningsAmount: {
    ...typography.presets.hero,
    color: colors.primary.darkBlack,
    marginVertical: spacing.sm,
  },
  earningsStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  earningStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningStatValue: {
    ...typography.presets.h3,
    color: colors.primary.darkBlack,
  },
  earningStatLabel: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    opacity: 0.8,
    marginTop: 2,
  },
  earningsStatDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
  },
  withdrawText: {
    ...typography.presets.button,
    color: colors.primary.blue,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  bookingCard: {
    marginBottom: spacing.md,
  },
  emptyBookingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  emptyBookingsText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  bookingName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  bookingActivity: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bookingDetailText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  bookingAmount: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  declineButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.errorLight,
    borderRadius: spacing.radius.md,
  },
  declineText: {
    ...typography.presets.buttonSmall,
    color: colors.status.error,
  },
  acceptButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.success,
    borderRadius: spacing.radius.md,
  },
  acceptText: {
    ...typography.presets.buttonSmall,
    color: colors.text.primary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messageText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  tipsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
