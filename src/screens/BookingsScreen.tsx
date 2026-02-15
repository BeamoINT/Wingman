import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    Linking,
    Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, EmptyState } from '../components';
import type { BookingData } from '../services/api/bookingsApi';
import { cancelBooking, fetchUserBookings } from '../services/api/bookingsApi';
import { getOrCreateConversation } from '../services/api/messages';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type {
    Booking,
    BookingStatus,
    CompanionSpecialty, RootStackParamList, VerificationLevel
} from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabType = 'upcoming' | 'completed' | 'cancelled';

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBookingStatus(status: unknown): BookingStatus {
  const normalized = String(status || 'pending').toLowerCase().replace(/_/g, '-');
  switch (normalized) {
    case 'pending':
    case 'confirmed':
    case 'in-progress':
    case 'completed':
    case 'cancelled':
    case 'disputed':
      return normalized;
    default:
      return 'pending';
  }
}

/**
 * Transform API booking data to app Booking type
 */
function transformBookingData(data: BookingData): Booking {
  const companion = data.companion;
  const user = companion?.user;
  const hasIdVerification = !!user?.id_verified;
  const verificationLevel: VerificationLevel = user?.verification_level === 'premium'
    ? 'premium'
    : user?.verification_level === 'verified' || hasIdVerification
      ? 'verified'
      : 'basic';

  const status = normalizeBookingStatus(data.status);

  return {
    id: data.id,
    companion: {
      id: companion?.id || data.companion_id || '',
      user: {
        id: user?.id || companion?.user_id || '',
        firstName: user?.first_name || 'Wingman',
        lastName: user?.last_name || '',
        email: user?.email || '',
        avatar: user?.avatar_url || undefined,
        isVerified: (
          verificationLevel === 'verified'
          || verificationLevel === 'premium'
          || !!user?.id_verified
        ),
        isPremium: (user?.subscription_tier || 'free') !== 'free',
        createdAt: user?.created_at || data.created_at,
      },
      rating: toNumber(companion?.rating, 0),
      reviewCount: Math.max(0, Math.round(toNumber(companion?.review_count, 0))),
      hourlyRate: toNumber(companion?.hourly_rate, toNumber(data.hourly_rate, 0)),
      specialties: (companion?.specialties || []) as CompanionSpecialty[],
      languages: companion?.languages || [],
      availability: [],
      isOnline: typeof companion?.is_available === 'boolean' ? companion.is_available : true,
      responseTime: companion?.response_time || 'Usually responds within 1 hour',
      completedBookings: Math.max(0, Math.round(toNumber(companion?.completed_bookings, 0))),
      badges: [],
      gallery: companion?.gallery || [],
      about: companion?.about || '',
      interests: [],
      verificationLevel,
    },
    user: {
      id: data.client_id || '',
      firstName: '',
      lastName: '',
      email: '',
      isVerified: false,
      isPremium: false,
      createdAt: data.created_at,
    },
    status,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time || '',
    duration: Math.max(0, Math.round(toNumber(data.duration_hours, 0))),
    totalPrice: toNumber(data.total_price, 0),
    location: {
      name: data.location_name || 'Location TBD',
      address: data.location_address || '',
      type: 'other',
    },
    activityType: (data.activity_type || 'social-events') as CompanionSpecialty,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function formatDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;

  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(time: string): string {
  if (!time) return '';
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (Number.isNaN(hours)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${(Number.isNaN(minutes) ? 0 : minutes).toString().padStart(2, '0')} ${period}`;
}

function mapBookingStatusToBadge(status: BookingStatus): 'success' | 'warning' | 'info' | 'error' {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'pending':
      return 'warning';
    case 'in-progress':
      return 'info';
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'disputed':
      return 'error';
    default:
      return 'info';
  }
}

function buildMapUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?q=${encoded}`;
  }

  return `geo:0,0?q=${encoded}`;
}

export const BookingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [messagingBookingId, setMessagingBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const { bookings: data, error: apiError } = await fetchUserBookings();

      if (apiError) {
        setError(apiError.message || 'Failed to load bookings');
        console.error('Error loading bookings:', apiError);
        setBookings([]);
      } else {
        setBookings(data.map(transformBookingData));
      }
    } catch (err) {
      setError('Something went wrong while loading bookings.');
      console.error('Error in loadBookings:', err);
      setBookings([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const upcomingBookings = useMemo(() => bookings.filter(
    booking => booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'in-progress'
  ), [bookings]);

  const completedBookings = useMemo(() => bookings.filter(
    booking => booking.status === 'completed'
  ), [bookings]);

  const cancelledBookings = useMemo(() => bookings.filter(
    booking => booking.status === 'cancelled' || booking.status === 'disputed'
  ), [bookings]);

  const currentBookings = useMemo(() => {
    switch (activeTab) {
      case 'completed':
        return completedBookings;
      case 'cancelled':
        return cancelledBookings;
      case 'upcoming':
      default:
        return upcomingBookings;
    }
  }, [activeTab, upcomingBookings, completedBookings, cancelledBookings]);

  const handleTabPress = useCallback(async (tab: TabType) => {
    await haptics.selection();
    setActiveTab(tab);
  }, []);

  const handleBookingPress = useCallback(async (bookingId: string) => {
    await haptics.light();
    navigation.navigate('BookingConfirmation', { bookingId });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    loadBookings(true);
  }, [loadBookings]);

  const handleOpenDirections = useCallback(async (booking: Booking) => {
    const query = booking.location.address || booking.location.name;
    if (!query.trim()) {
      Alert.alert('No Location', 'This booking does not have a location yet.');
      return;
    }

    const mapUrl = buildMapUrl(query);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    try {
      const canOpenMapUrl = await Linking.canOpenURL(mapUrl);
      const targetUrl = canOpenMapUrl ? mapUrl : fallbackUrl;
      await Linking.openURL(targetUrl);
    } catch (error) {
      console.error('Error opening map:', error);
      Alert.alert('Unable to Open Maps', 'Please check your maps application and try again.');
    }
  }, []);

  const handleMessageCompanion = useCallback(async (booking: Booking) => {
    const companionUserId = booking.companion.user.id;
    if (!companionUserId) {
      Alert.alert('Unavailable', 'Wingman messaging is unavailable for this booking.');
      return;
    }

    setMessagingBookingId(booking.id);
    try {
      const { conversation, error } = await getOrCreateConversation(companionUserId);
      if (error || !conversation?.id) {
        console.error('Error creating/opening conversation:', error);
        Alert.alert('Message Failed', error?.message || 'Unable to open chat right now.');
        return;
      }

      await haptics.light();
      navigation.navigate('Chat', { conversationId: conversation.id });
    } finally {
      setMessagingBookingId(null);
    }
  }, [navigation]);

  const handleCancelBooking = useCallback((booking: Booking) => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setCancellingBookingId(booking.id);
            try {
              const { success, error } = await cancelBooking(booking.id);
              if (!success || error) {
                console.error('Error cancelling booking:', error);
                Alert.alert('Cancel Failed', error?.message || 'Unable to cancel booking.');
                return;
              }

              await haptics.success();
              await loadBookings();
            } finally {
              setCancellingBookingId(null);
            }
          },
        },
      ]
    );
  }, [loadBookings]);

  const renderHeader = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.title}>Bookings</Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => handleTabPress('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
          {upcomingBookings.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{upcomingBookings.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => handleTabPress('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'cancelled' && styles.tabActive]}
          onPress={() => handleTabPress('cancelled')}
        >
          <Text style={[styles.tabText, activeTab === 'cancelled' && styles.tabTextActive]}>
            Cancelled
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderState = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle" size={42} color={colors.status.error} />
          <Text style={styles.errorTitle}>Couldn’t Load Bookings</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadBookings()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <EmptyState
        icon="calendar-outline"
        title={`No ${activeTab} bookings`}
        message={
          activeTab === 'upcoming'
            ? 'Your confirmed and pending bookings will appear here.'
            : activeTab === 'completed'
              ? 'Completed bookings will appear here after your sessions.'
              : 'Cancelled or disputed bookings will appear here.'
        }
      />
    );
  };

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const statusLabel = item.status
      .replace('-', ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());

    const canCancel = item.status === 'pending' || item.status === 'confirmed';
    const canMessage = !!item.companion.user.id;
    const bookingIsCancelling = cancellingBookingId === item.id;
    const bookingIsOpeningChat = messagingBookingId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleBookingPress(item.id)}
      >
        <Card variant="outlined" style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <Avatar
              source={item.companion.user.avatar}
              name={item.companion.user.firstName}
              size="medium"
              showVerified
              verificationLevel={item.companion.verificationLevel}
            />

            <View style={styles.bookingInfo}>
              <Text style={styles.companionName}>
                {item.companion.user.firstName} {item.companion.user.lastName?.charAt(0) ? `${item.companion.user.lastName.charAt(0)}.` : ''}
              </Text>
              <Badge
                label={statusLabel}
                variant={mapBookingStatusToBadge(item.status)}
                size="small"
              />
            </View>

            <Text style={styles.bookingPrice}>${item.totalPrice.toFixed(2)}</Text>
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>
                {formatTime(item.startTime)}
                {item.endTime ? ` - ${formatTime(item.endTime)}` : ` (${item.duration}h)`}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.location.name}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, !canMessage && styles.actionButtonDisabled]}
              disabled={!canMessage || bookingIsOpeningChat}
              onPress={() => handleMessageCompanion(item)}
            >
              <Ionicons name="chatbubble-outline" size={18} color={canMessage ? colors.primary.blue : colors.text.muted} />
              <Text style={[styles.actionLabel, !canMessage && styles.actionLabelDisabled]}>
                {bookingIsOpeningChat ? 'Opening...' : 'Message'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOpenDirections(item)}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.primary.blue} />
              <Text style={styles.actionLabel}>Directions</Text>
            </TouchableOpacity>

            {canCancel ? (
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                disabled={bookingIsCancelling}
                onPress={() => handleCancelBooking(item)}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.status.error} />
                <Text style={styles.cancelLabel}>
                  {bookingIsCancelling ? 'Cancelling...' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader}
      <FlatList
        data={currentBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        ListEmptyComponent={renderState}
        contentContainerStyle={[
          styles.content,
          currentBookings.length === 0 && styles.emptyContent,
        ]}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
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
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.background.card,
  },
  tabText: {
    ...typography.presets.buttonSmall,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
  },
  tabBadge: {
    backgroundColor: colors.primary.blue,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontSize: 10,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 110,
    gap: spacing.md,
  },
  emptyContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  errorSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.primary.blue,
  },
  retryText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  bookingCard: {
    padding: spacing.lg,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingInfo: {
    flex: 1,
    marginLeft: spacing.md,
    gap: spacing.xs,
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  bookingPrice: {
    ...typography.presets.h3,
    color: colors.primary.blue,
  },
  detailGrid: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    paddingVertical: spacing.md,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
  },
  actionLabelDisabled: {
    color: colors.text.muted,
  },
  cancelButton: {
    backgroundColor: colors.status.errorLight,
  },
  cancelLabel: {
    ...typography.presets.buttonSmall,
    color: colors.status.error,
  },
});
