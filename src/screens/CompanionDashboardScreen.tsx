import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Header,
  InlineBanner,
  PillTabs,
  ScreenScaffold,
  SectionHeader,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { BookingData } from '../services/api/bookingsApi';
import {
  cancelBooking,
  fetchCompanionBookings,
  fetchCompanionEarnings,
  updateBookingStatus,
} from '../services/api/bookingsApi';
import { getOrCreateConversation } from '../services/api/messages';
import { supabase } from '../services/supabase';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
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
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
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
      const [
        { bookings: companionBookings, error: bookingsError },
        { earnings: earningsData, error: earningsError },
      ] = await Promise.all([
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
      0,
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
    <ScreenScaffold scrollable contentContainerStyle={styles.contentContainer}>
      <Header
        title="Wingman Dashboard"
        showBack
        onBackPress={handleBackPress}
        rightIcon={isRefreshing ? 'sync' : 'refresh'}
        onRightPress={() => loadDashboardData(true)}
        transparent
      />

      <InlineBanner
        title="All users are ID and photo verified before bookings"
        message="Stay responsive to keep your rating and repeat bookings strong."
        variant="info"
      />

      {error ? (
        <InlineBanner
          title="Dashboard issue"
          message={error}
          variant="error"
        />
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title="Availability"
          subtitle="Control whether you can receive new requests"
        />

        <TouchableOpacity activeOpacity={0.9} onPress={toggleOnlineStatus}>
          <Card variant="outlined" style={styles.availabilityCard}>
            <View style={styles.availabilityLeft}>
              <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
              <View style={styles.availabilityTextWrap}>
                <Text style={styles.availabilityTitle}>
                  {isOnline ? "You're Online" : "You're Offline"}
                </Text>
                <Text style={styles.availabilitySubtitle}>
                  {isOnline ? 'Receiving booking requests' : 'Tap to go online and receive requests'}
                </Text>
              </View>
            </View>

            <View style={[styles.switchRail, isOnline && styles.switchRailActive]}>
              <View style={[styles.switchThumb, isOnline && styles.switchThumbActive]} />
            </View>
          </Card>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Earnings"
          subtitle="Revenue and productivity overview"
        />

        <PillTabs
          items={[
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
            { id: 'year', label: 'Year' },
          ]}
          activeId={timeRange}
          onChange={(value) => {
            void haptics.selection();
            setTimeRange(value as TimeRange);
          }}
        />

        <Card variant="default" style={styles.earningsCard}>
          <Text style={styles.earningsLabel}>Total Earnings</Text>
          <Text style={styles.earningsAmount}>${currentData.total.toLocaleString()}</Text>

          <View style={styles.earningsStats}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{currentData.bookings}</Text>
              <Text style={styles.metricLabel}>Bookings</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{currentData.hours}</Text>
              <Text style={styles.metricLabel}>Hours</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                ${currentData.hours > 0 ? Math.round(currentData.total / currentData.hours) : 0}
              </Text>
              <Text style={styles.metricLabel}>Avg/Hour</Text>
            </View>
          </View>
        </Card>

        <Button
          title="Withdraw Earnings"
          onPress={() => haptics.medium()}
          variant="secondary"
          icon="wallet-outline"
          iconPosition="left"
          fullWidth
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Performance"
          subtitle="Live view of quality and responsiveness"
        />

        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Ionicons name="star" size={18} color={colors.primary.gold} />
            <Text style={styles.statValue}>{stats.rating > 0 ? stats.rating.toFixed(1) : '--'}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="flash" size={18} color={colors.accent.primary} />
            <Text style={styles.statValue}>
              {stats.responseTime.includes('hour')
                ? stats.responseTime.replace('Usually responds within ', '')
                : stats.responseTime}
            </Text>
            <Text style={styles.statLabel}>Avg Response</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={18} color={colors.status.success} />
            <Text style={styles.statValue}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Completion</Text>
          </Card>

          <Card style={styles.statCard}>
            <Ionicons name="repeat" size={18} color={colors.verification.trusted} />
            <Text style={styles.statValue}>{stats.repeatClientRate}%</Text>
            <Text style={styles.statLabel}>Repeat Clients</Text>
          </Card>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Upcoming Bookings"
          subtitle="Requests that need your response"
        />

        {isLoading ? (
          <Card variant="outlined" style={styles.centerCard}>
            <ActivityIndicator size="small" color={colors.accent.primary} />
            <Text style={styles.centerCardText}>Loading bookings...</Text>
          </Card>
        ) : null}

        {!isLoading && visibleBookings.length === 0 ? (
          <Card variant="outlined" style={styles.centerCard}>
            <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
            <Text style={styles.centerCardText}>No upcoming bookings yet.</Text>
          </Card>
        ) : null}

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

            <View style={styles.bookingMetaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="calendar-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.metaPillText}>{booking.date}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.metaPillText}>{booking.time}</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="hourglass-outline" size={12} color={colors.text.tertiary} />
                <Text style={styles.metaPillText}>{booking.duration}h</Text>
              </View>
            </View>

            <View style={styles.bookingFooter}>
              <Text style={styles.bookingAmount}>${booking.amount}</Text>

              {booking.status === 'pending' ? (
                <View style={styles.bookingActions}>
                  <Button
                    title="Decline"
                    size="small"
                    variant="outline"
                    onPress={() => handleDeclineBooking(booking.id)}
                  />
                  <Button
                    title="Accept"
                    size="small"
                    variant="primary"
                    onPress={() => handleAcceptBooking(booking.id)}
                  />
                </View>
              ) : (
                <Button
                  title="Message"
                  size="small"
                  variant="ghost"
                  icon="chatbubble-outline"
                  iconPosition="left"
                  onPress={() => handleMessageClient(booking.clientId)}
                />
              )}
            </View>
          </Card>
        ))}
      </View>

      <Card variant="accent" style={styles.tipCard}>
        <Ionicons name="bulb-outline" size={20} color={colors.primary.gold} />
        <View style={styles.tipTextWrap}>
          <Text style={styles.tipTitle}>Boost Your Earnings</Text>
          <Text style={styles.tipBody}>
            Complete your video introduction to get more booking requests.
          </Text>
        </View>
      </Card>
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  contentContainer: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    gap: spacing.sm,
  },
  availabilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.tertiary,
  },
  statusDotOnline: {
    backgroundColor: colors.status.success,
  },
  availabilityTextWrap: {
    gap: spacing.xs,
    flex: 1,
  },
  availabilityTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  availabilitySubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  switchRail: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface.level2,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  switchRailActive: {
    backgroundColor: colors.status.successLight,
    borderColor: colors.status.success,
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface.level0,
  },
  switchThumbActive: {
    marginLeft: 20,
  },
  earningsCard: {
    padding: spacing.xl,
    borderRadius: spacing.radius.xl,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  earningsLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  earningsAmount: {
    ...typography.presets.hero,
    color: colors.text.primary,
  },
  earningsStats: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border.subtle,
  },
  metricValue: {
    ...typography.presets.h4,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
  },
  metricLabel: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  statValue: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  centerCard: {
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  centerCardText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookingCard: {
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bookingInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  bookingName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  bookingActivity: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  bookingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface.level1,
  },
  metaPillText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.md,
  },
  bookingAmount: {
    ...typography.presets.h4,
    color: colors.accent.primary,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tipCard: {
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tipTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  tipTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  tipBody: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
});
