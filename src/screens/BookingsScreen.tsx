import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Badge, Avatar } from '../components';
import { fetchUserBookings } from '../services/api/bookingsApi';
import type { BookingData } from '../services/api/bookingsApi';
import type { RootStackParamList, Booking, CompanionSpecialty } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'upcoming' | 'past';

/**
 * Transform API booking data to our Booking type
 */
function transformBookingData(data: BookingData): Booking {
  const companion = data.companion;
  const user = companion?.user;

  return {
    id: data.id,
    companion: {
      id: companion?.id || '',
      user: {
        id: user?.id || '',
        firstName: user?.first_name || '',
        lastName: user?.last_name || '',
        email: user?.email || '',
        avatar: user?.avatar_url,
        isVerified: user?.phone_verified || false,
        isPremium: user?.subscription_tier !== 'free',
        createdAt: user?.created_at || data.created_at,
      },
      rating: companion?.rating || 0,
      reviewCount: companion?.review_count || 0,
      hourlyRate: companion?.hourly_rate || 0,
      specialties: (companion?.specialties || []) as CompanionSpecialty[],
      languages: companion?.languages || [],
      availability: [],
      isOnline: companion?.is_available || false,
      responseTime: companion?.response_time || '',
      completedBookings: companion?.completed_bookings || 0,
      badges: [],
      gallery: companion?.gallery || [],
      about: companion?.about || '',
      interests: [],
      verificationLevel: user?.verification_level as any || 'basic',
    },
    user: {} as any,
    status: data.status as Booking['status'],
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time || '',
    duration: data.duration_hours,
    totalPrice: data.total_price,
    location: {
      name: data.location_name || 'Location TBD',
      address: data.location_address || '',
      type: 'other' as const,
    },
    activityType: (data.activity_type || 'social-events') as CompanionSpecialty,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export const BookingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('Failed to load bookings');
        console.error('Error loading bookings:', apiError);
      } else {
        setBookings(data.map(transformBookingData));
      }
    } catch (err) {
      setError('Something went wrong');
      console.error('Error in loadBookings:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleTabPress = async (tab: TabType) => {
    await haptics.selection();
    setActiveTab(tab);
  };

  const handleBookingPress = async (booking: Booking) => {
    await haptics.light();
    navigation.navigate('BookingConfirmation', { bookingId: booking.id });
  };

  const handleRefresh = () => {
    loadBookings(true);
  };

  const upcomingBookings = bookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending' || b.status === 'in-progress'
  );
  const pastBookings = bookings.filter(
    (b) => b.status === 'completed' || b.status === 'cancelled'
  );

  const currentBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${(minutes || 0).toString().padStart(2, '0')} ${period}`;
  };

  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadBookings()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentBookings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>No {activeTab} bookings</Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'upcoming'
              ? 'Find a companion and book your first outing!'
              : 'Your completed bookings will appear here.'}
          </Text>
        </View>
      );
    }

    return currentBookings.map((booking) => (
      <TouchableOpacity
        key={booking.id}
        onPress={() => handleBookingPress(booking)}
        activeOpacity={0.8}
      >
        <Card variant="outlined" style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <Avatar
              source={booking.companion.user.avatar}
              name={booking.companion.user.firstName}
              size="medium"
              showVerified
              verificationLevel={booking.companion.verificationLevel}
            />
            <View style={styles.bookingInfo}>
              <Text style={styles.companionName}>
                {booking.companion.user.firstName}
              </Text>
              <View style={styles.bookingMeta}>
                <Badge
                  label={booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('-', ' ')}
                  variant={
                    booking.status === 'confirmed' ? 'success' :
                    booking.status === 'pending' ? 'warning' :
                    booking.status === 'in-progress' ? 'info' :
                    booking.status === 'completed' ? 'info' : 'error'
                  }
                  size="small"
                />
              </View>
            </View>
            <Text style={styles.bookingPrice}>${booking.totalPrice.toFixed(2)}</Text>
          </View>

          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>{formatDate(booking.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText}>
                {formatTime(booking.startTime)}{booking.endTime ? ` - ${formatTime(booking.endTime)}` : ` (${booking.duration}h)`}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color={colors.text.tertiary} />
              <Text style={styles.detailText} numberOfLines={1}>
                {booking.location.name}
              </Text>
            </View>
          </View>

          {(booking.status === 'confirmed' || booking.status === 'in-progress') && (
            <View style={styles.bookingActions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => haptics.light()}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.primary.blue} />
                <Text style={styles.actionText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => haptics.light()}>
                <Ionicons name="navigate-outline" size={18} color={colors.primary.blue} />
                <Text style={styles.actionText}>Directions</Text>
              </TouchableOpacity>
            </View>
          )}

          {booking.status === 'completed' && (
            <TouchableOpacity style={styles.reviewButton} onPress={() => haptics.light()}>
              <Ionicons name="star-outline" size={18} color={colors.primary.gold} />
              <Text style={styles.reviewText}>Leave a Review</Text>
            </TouchableOpacity>
          )}
        </Card>
      </TouchableOpacity>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Bookings</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => handleTabPress('upcoming')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'upcoming' && styles.tabTextActive,
              ]}
            >
              Upcoming
            </Text>
            {upcomingBookings.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{upcomingBookings.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => handleTabPress('past')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'past' && styles.tabTextActive,
              ]}
            >
              Past
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        }
      >
        {renderContent()}
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
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.lg,
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
    ...typography.presets.button,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.text.primary,
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
    gap: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  errorText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
  },
  retryText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.massive,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 250,
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
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bookingPrice: {
    ...typography.presets.h3,
    color: colors.primary.blue,
  },
  bookingDetails: {
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
  bookingActions: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
  },
  actionText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  reviewText: {
    ...typography.presets.button,
    color: colors.primary.gold,
  },
});
