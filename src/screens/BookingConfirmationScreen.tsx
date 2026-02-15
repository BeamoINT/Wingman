import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, EmptyState } from '../components';
import type { BookingData } from '../services/api/bookingsApi';
import { cancelBooking, fetchBookingById } from '../services/api/bookingsApi';
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

type Props = NativeStackScreenProps<RootStackParamList, 'BookingConfirmation'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

function transformBookingData(data: BookingData): Booking {
  const companion = data.companion;
  const user = companion?.user;
  const hasIdVerification = !!user?.id_verified;
  const verificationLevel: VerificationLevel = user?.verification_level === 'premium'
    ? 'premium'
    : user?.verification_level === 'verified' || hasIdVerification
      ? 'verified'
      : 'basic';

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
    status: normalizeBookingStatus(data.status),
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
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

function buildMapUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  if (Platform.OS === 'ios') {
    return `http://maps.apple.com/?q=${encoded}`;
  }

  return `geo:0,0?q=${encoded}`;
}

function statusVariant(status: BookingStatus): 'success' | 'warning' | 'info' | 'error' {
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

export const BookingConfirmationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadBooking = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { booking: bookingData, error: apiError } = await fetchBookingById(route.params.bookingId);
      if (apiError || !bookingData) {
        setError(apiError?.message || 'Unable to load booking details.');
        setBooking(null);
      } else {
        setBooking(transformBookingData(bookingData));
      }
    } catch (err) {
      console.error('Error loading booking details:', err);
      setError('Unable to load booking details.');
      setBooking(null);
    } finally {
      setIsLoading(false);
    }
  }, [route.params.bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleBack = useCallback(async () => {
    await haptics.light();
    navigation.goBack();
  }, [navigation]);

  const handleMessageCompanion = useCallback(async () => {
    if (!booking?.companion.user.id) {
      Alert.alert('Unavailable', 'Wingman messaging is unavailable for this booking.');
      return;
    }

    setIsOpeningChat(true);
    try {
      const { conversation, error } = await getOrCreateConversation(booking.companion.user.id);
      if (error || !conversation?.id) {
        Alert.alert('Message Failed', error?.message || 'Unable to open chat right now.');
        return;
      }

      await haptics.light();
      navigation.navigate('Chat', { conversationId: conversation.id });
    } finally {
      setIsOpeningChat(false);
    }
  }, [booking?.companion.user.id, navigation]);

  const handleDirections = useCallback(async () => {
    if (!booking) return;

    const query = booking.location.address || booking.location.name;
    if (!query.trim()) {
      Alert.alert('No Location', 'This booking does not have a location yet.');
      return;
    }

    const mapUrl = buildMapUrl(query);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

    try {
      const canOpenMapUrl = await Linking.canOpenURL(mapUrl);
      await Linking.openURL(canOpenMapUrl ? mapUrl : fallbackUrl);
    } catch (error) {
      console.error('Error opening map:', error);
      Alert.alert('Unable to Open Maps', 'Please check your maps application and try again.');
    }
  }, [booking]);

  const handleCancelBooking = useCallback(() => {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              const { success, error } = await cancelBooking(booking.id);
              if (!success || error) {
                Alert.alert('Cancel Failed', error?.message || 'Unable to cancel booking.');
                return;
              }

              await haptics.success();
              await loadBooking();
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }, [booking, loadBooking]);

  if (isLoading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.stateText}>Loading booking details...</Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.stateScreen}>
        <EmptyState
          icon="alert-circle-outline"
          title="Booking Unavailable"
          message={error || 'Unable to load this booking.'}
          actionLabel="Try Again"
          onAction={loadBooking}
          secondaryActionLabel="Back"
          onSecondaryAction={handleBack}
        />
      </View>
    );
  }

  const statusLabel = booking.status
    .replace('-', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());

  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.background.primary, colors.background.secondary]}
        style={[styles.header, { paddingTop: insets.top + spacing.sm }]}
      >
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.headerSpacer} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Card variant="outlined">
          <View style={styles.companionRow}>
            <Avatar
              source={booking.companion.user.avatar}
              name={booking.companion.user.firstName}
              size="medium"
              showVerified
              verificationLevel={booking.companion.verificationLevel}
            />
            <View style={styles.companionInfo}>
              <Text style={styles.companionName}>
                {booking.companion.user.firstName} {booking.companion.user.lastName?.charAt(0) ? `${booking.companion.user.lastName.charAt(0)}.` : ''}
              </Text>
              <Text style={styles.companionMeta}>{booking.companion.responseTime}</Text>
            </View>
            <Badge label={statusLabel} variant={statusVariant(booking.status)} size="small" />
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.text.tertiary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(booking.date)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={18} color={colors.text.tertiary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>
                {formatTime(booking.startTime)}
                {booking.endTime ? ` - ${formatTime(booking.endTime)}` : ` (${booking.duration}h)`}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="wallet-outline" size={18} color={colors.text.tertiary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Total</Text>
              <Text style={styles.detailValue}>${booking.totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={colors.text.tertiary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{booking.location.name}</Text>
              {!!booking.location.address && (
                <Text style={styles.detailSubValue}>{booking.location.address}</Text>
              )}
            </View>
          </View>

          {!!booking.notes?.trim() && (
            <>
              <View style={styles.divider} />
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </>
          )}
        </Card>

        <View style={styles.safetyTip}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary.blue} />
          <Text style={styles.safetyTipText}>
            Keep communication in-app and share your live location with trusted contacts when needed. All Wingman members are ID and photo verified.
          </Text>
        </View>
      </ScrollView>

      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomActions, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Button
          title={isOpeningChat ? 'Opening Chat...' : 'Message Wingman'}
          onPress={handleMessageCompanion}
          variant="outline"
          size="large"
          fullWidth
          disabled={isOpeningChat}
          icon="chatbubble-outline"
        />
        <Button
          title="Open Directions"
          onPress={handleDirections}
          variant="secondary"
          size="large"
          fullWidth
          icon="navigate-outline"
        />
        {canCancel && (
          <Button
            title={isCancelling ? 'Cancelling...' : 'Cancel Booking'}
            onPress={handleCancelBooking}
            variant="ghost"
            size="large"
            fullWidth
            disabled={isCancelling}
          />
        )}
      </LinearGradient>
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
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.screenPadding,
    gap: spacing.lg,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  companionMeta: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  detailValue: {
    ...typography.presets.body,
    color: colors.text.primary,
    marginTop: 2,
  },
  detailSubValue: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  notesLabel: {
    ...typography.presets.label,
    color: colors.text.secondary,
  },
  notesText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  safetyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderRadius: spacing.radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  safetyTipText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  bottomActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
});
