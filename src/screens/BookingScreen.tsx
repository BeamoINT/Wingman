import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, EmptyState, Input } from '../components';
import { RequirementsGate } from '../components/RequirementsGate';
import { useRequirements } from '../context/RequirementsContext';
import { useVerification } from '../context/VerificationContext';
import { createBooking } from '../services/api/bookingsApi';
import type { CompanionData } from '../services/api/companions';
import { fetchCompanionById } from '../services/api/companions';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { CompanionSpecialty, RootStackParamList, VerificationLevel } from '../types';
import { haptics } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Booking'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const timeSlots = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM',
  '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM',
];

const durations = [
  { hours: 1, label: '1 hour' },
  { hours: 2, label: '2 hours' },
  { hours: 3, label: '3 hours' },
  { hours: 4, label: '4 hours' },
  { hours: 6, label: '6 hours' },
  { hours: 8, label: 'Full day' },
];

const activities: { id: CompanionSpecialty; label: string; icon: string }[] = [
  { id: 'dining', label: 'Dining', icon: 'restaurant' },
  { id: 'nightlife', label: 'Nightlife', icon: 'wine' },
  { id: 'coffee-chat', label: 'Coffee', icon: 'cafe' },
  { id: 'movies', label: 'Movies', icon: 'film' },
  { id: 'concerts', label: 'Concert', icon: 'musical-notes' },
  { id: 'sports', label: 'Sports', icon: 'fitness' },
  { id: 'shopping', label: 'Shopping', icon: 'bag' },
  { id: 'safety-companion', label: 'Safety', icon: 'shield' },
];

interface CompanionPreview {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  responseTime: string;
  verificationLevel: VerificationLevel;
  isAvailable: boolean;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVerificationLevel(value: unknown): VerificationLevel {
  const normalized = String(value || 'basic').toLowerCase();
  if (normalized === 'premium') return 'premium';
  if (normalized === 'verified') return 'verified';
  return 'basic';
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toSqlTime(value: string): string | null {
  const trimmed = value.trim();

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return null;
  }

  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (!Number.isFinite(rawHours) || !Number.isFinite(minutes) || rawHours < 1 || rawHours > 12) {
    return null;
  }

  let hours = rawHours % 12;
  if (meridiem === 'PM') {
    hours += 12;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function transformCompanionData(data: CompanionData): CompanionPreview {
  const firstName = data.user?.first_name?.trim() || 'Wingman';
  const lastName = data.user?.last_name?.trim() || '';
  const lastInitial = lastName ? `${lastName.charAt(0)}.` : '';
  const hasIdVerification = !!data.user?.id_verified;
  const normalizedLevel = normalizeVerificationLevel(data.user?.verification_level);

  return {
    id: data.id,
    userId: data.user_id,
    displayName: `${firstName} ${lastInitial}`.trim(),
    avatarUrl: data.user?.avatar_url || undefined,
    hourlyRate: Math.max(0, toNumber(data.hourly_rate, 0)),
    rating: Math.max(0, toNumber(data.rating, 0)),
    reviewCount: Math.max(0, Math.round(toNumber(data.review_count, 0))),
    responseTime: data.response_time || 'Usually responds within 1 hour',
    verificationLevel: normalizedLevel === 'premium'
      ? 'premium'
      : (normalizedLevel === 'verified' || hasIdVerification ? 'verified' : 'basic'),
    isAvailable: typeof data.is_available === 'boolean' ? data.is_available : true,
  };
}

// Inner component that contains the actual booking UI
const BookingScreenContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { checkBookingRequirements } = useRequirements();
  const { idVerified, emailVerified, phoneVerified } = useVerification();
  const bookingRequirements = useMemo(
    () => checkBookingRequirements('finalize'),
    [checkBookingRequirements]
  );
  const photoVerified = bookingRequirements.photoVerified.met;

  const verificationWarningMessage = useMemo(() => {
    const missing: string[] = [];
    if (!emailVerified) missing.push('email');
    if (!phoneVerified) missing.push('phone');
    if (!idVerified) missing.push('ID');
    if (!photoVerified) missing.push('profile photo');

    if (missing.length === 0) {
      return '';
    }

    if (missing.length === 1) {
      return `Complete ${missing[0]} verification to book.`;
    }

    if (missing.length === 2) {
      return `Complete ${missing[0]} and ${missing[1]} verification to book.`;
    }

    const missingLast = missing[missing.length - 1];
    const missingPrefix = missing.slice(0, -1).join(', ');
    return `Complete ${missingPrefix}, and ${missingLast} verification to book.`;
  }, [emailVerified, phoneVerified, idVerified, photoVerified]);

  const dates = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + index);

      return {
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        full: toDateString(date),
      };
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('7:00 PM');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedActivity, setSelectedActivity] = useState<CompanionSpecialty>('dining');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [companion, setCompanion] = useState<CompanionPreview | null>(null);
  const [isLoadingCompanion, setIsLoadingCompanion] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCompanion = useCallback(async () => {
    setIsLoadingCompanion(true);
    setLoadError(null);

    try {
      const { companion: companionData, error } = await fetchCompanionById(route.params.companionId);
      if (error || !companionData) {
        console.error('Error loading companion for booking:', error);
        setLoadError(error?.message || 'Unable to load wingman details.');
        setCompanion(null);
        return;
      }

      setCompanion(transformCompanionData(companionData));
    } catch (error) {
      console.error('Unexpected error loading companion:', error);
      setLoadError('Unable to load wingman details.');
      setCompanion(null);
    } finally {
      setIsLoadingCompanion(false);
    }
  }, [route.params.companionId]);

  useEffect(() => {
    loadCompanion();
  }, [loadCompanion]);

  const hourlyRate = companion?.hourlyRate || 0;
  const totalPrice = hourlyRate * selectedDuration;
  const serviceFee = Math.round(totalPrice * 0.1 * 100) / 100;
  const grandTotal = totalPrice + serviceFee;

  const validateBeforeBooking = useCallback((): { valid: boolean; message?: string } => {
    const requirements = checkBookingRequirements('finalize');

    if (!requirements.isAuthenticated.met) {
      return { valid: false, message: 'You must be signed in to book a wingman.' };
    }

    if (!requirements.ageConfirmed.met) {
      return { valid: false, message: 'You must confirm you are 18 or older.' };
    }

    if (!requirements.termsAccepted.met) {
      return { valid: false, message: 'You must accept the Terms of Service.' };
    }

    if (!requirements.privacyAccepted.met) {
      return { valid: false, message: 'You must accept the Privacy Policy.' };
    }

    if (!requirements.emailVerified.met) {
      return { valid: false, message: 'You must verify your email address before booking.' };
    }

    if (!requirements.phoneVerified.met) {
      return { valid: false, message: 'You must verify your phone number before booking.' };
    }

    if (!requirements.idVerified.met) {
      return { valid: false, message: 'You must verify your identity before booking.' };
    }

    if (!requirements.photoVerified.met) {
      return { valid: false, message: 'You must upload a profile photo before booking.' };
    }

    if (!requirements.profileComplete.met) {
      return { valid: false, message: 'Please complete your profile before booking.' };
    }

    if (!companion) {
      return { valid: false, message: 'Wingman details are unavailable.' };
    }

    if (!companion.isAvailable) {
      return { valid: false, message: 'This wingman is currently unavailable for booking.' };
    }

    if (!companion.hourlyRate || companion.hourlyRate <= 0) {
      return { valid: false, message: 'This wingman does not have a valid hourly rate yet.' };
    }

    if (!locationName.trim()) {
      return { valid: false, message: 'Please enter a meeting location.' };
    }

    const selectedDateValue = dates[selectedDate];
    if (!selectedDateValue) {
      return { valid: false, message: 'Please select a valid booking date.' };
    }

    if (!toSqlTime(selectedTime)) {
      return { valid: false, message: 'Please select a valid start time.' };
    }

    return { valid: true };
  }, [checkBookingRequirements, companion, locationName, dates, selectedDate, selectedTime]);

  const handleBookPress = async () => {
    const validation = validateBeforeBooking();
    const companionIdForVerification = companion?.id;

    if (!validation.valid || !companion) {
      await haptics.warning();

      const needsEmailOrIdVerification =
        !bookingRequirements.emailVerified.met || !bookingRequirements.idVerified.met;
      const needsPhoneVerification = !bookingRequirements.phoneVerified.met;
      const needsProfilePhoto = !bookingRequirements.photoVerified.met;

      if (needsEmailOrIdVerification || needsPhoneVerification || needsProfilePhoto) {
        Alert.alert(
          'Complete Verification to Book',
          validation.message || verificationWarningMessage || 'Complete verification to place your booking.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: needsPhoneVerification
                ? 'Verify Phone'
                : (needsEmailOrIdVerification ? 'Complete Verification' : 'Add Profile Photo'),
              onPress: () => {
                if (needsPhoneVerification) {
                  navigation.navigate('VerifyPhone', { source: 'booking' });
                  return;
                }

                if (needsEmailOrIdVerification) {
                  if (!companionIdForVerification) {
                    return;
                  }

                  navigation.navigate('Verification', {
                    source: 'booking_final_step',
                    companionId: companionIdForVerification,
                  });
                  return;
                }

                Alert.alert(
                  'Add Profile Photo',
                  'Please upload a profile photo from your Profile tab before completing this booking.'
                );
              },
            },
          ]
        );
      } else {
        Alert.alert('Cannot Complete Booking', validation.message || 'Please review your booking details.');
      }
      return;
    }

    const selectedDateValue = dates[selectedDate];
    const startTime = toSqlTime(selectedTime);

    if (!selectedDateValue || !startTime) {
      await haptics.warning();
      Alert.alert('Cannot Complete Booking', 'Please select a valid date and time.');
      return;
    }

    setIsProcessing(true);

    try {
      const { booking, error } = await createBooking({
        companion_id: companion.id,
        date: selectedDateValue.full,
        start_time: startTime,
        duration_hours: selectedDuration,
        hourly_rate: companion.hourlyRate,
        location_name: locationName.trim(),
        location_address: locationAddress.trim() || undefined,
        activity_type: selectedActivity,
        notes: notes.trim() || undefined,
      });

      if (error || !booking?.id) {
        console.error('Error creating booking:', error);
        await haptics.error();
        Alert.alert('Booking Failed', error?.message || 'Unable to create booking. Please try again.');
        return;
      }

      await haptics.success();
      navigation.replace('BookingConfirmation', { bookingId: booking.id });
    } catch (error) {
      console.error('Unexpected booking creation error:', error);
      await haptics.error();
      Alert.alert('Booking Failed', 'Unable to create booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  if (isLoadingCompanion) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.stateText}>Loading wingman details...</Text>
      </View>
    );
  }

  if (loadError || !companion) {
    return (
      <View style={styles.stateScreen}>
        <EmptyState
          icon="alert-circle-outline"
          title="Booking Unavailable"
          message={loadError || 'Unable to load wingman details.'}
          actionLabel="Try Again"
          onAction={loadCompanion}
          secondaryActionLabel="Back"
          onSecondaryAction={handleBackPress}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Wingman</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.companionPreview}>
          <Avatar
            source={companion.avatarUrl}
            name={companion.displayName}
            size="medium"
            showVerified
            verificationLevel={companion.verificationLevel}
          />
          <View style={styles.companionInfo}>
            <Text style={styles.companionName}>{companion.displayName}</Text>
            <Text style={styles.companionMeta}>
              ${companion.hourlyRate.toFixed(2)}/hr
              {companion.reviewCount > 0 ? ` • ${companion.rating.toFixed(1)} (${companion.reviewCount})` : ''}
            </Text>
            <Text style={styles.companionResponse}>{companion.responseTime}</Text>
          </View>
          <Badge
            label={companion.isAvailable ? 'Available' : 'Unavailable'}
            variant={companion.isAvailable ? 'success' : 'error'}
            size="small"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesContainer}
          >
            {dates.map((date, index) => (
              <TouchableOpacity
                key={date.full}
                style={[
                  styles.dateCard,
                  selectedDate === index && styles.dateCardSelected,
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setSelectedDate(index);
                }}
              >
                <Text style={[styles.dateDay, selectedDate === index && styles.dateTextSelected]}>
                  {date.day}
                </Text>
                <Text style={[styles.dateNumber, selectedDate === index && styles.dateTextSelected]}>
                  {date.date}
                </Text>
                <Text style={[styles.dateMonth, selectedDate === index && styles.dateTextSelected]}>
                  {date.month}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.timeSlotsGrid}>
            {timeSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeSlot,
                  selectedTime === time && styles.timeSlotSelected,
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setSelectedTime(time);
                }}
              >
                <Text style={[
                  styles.timeText,
                  selectedTime === time && styles.timeTextSelected,
                ]}>
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.durationsGrid}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={duration.hours}
                style={[
                  styles.durationCard,
                  selectedDuration === duration.hours && styles.durationCardSelected,
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setSelectedDuration(duration.hours);
                }}
              >
                <Text style={[
                  styles.durationText,
                  selectedDuration === duration.hours && styles.durationTextSelected,
                ]}>
                  {duration.label}
                </Text>
                <Text style={[
                  styles.durationPrice,
                  selectedDuration === duration.hours && styles.durationPriceSelected,
                ]}>
                  ${(companion.hourlyRate * duration.hours).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Type</Text>
          <View style={styles.activitiesGrid}>
            {activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={[
                  styles.activityCard,
                  selectedActivity === activity.id && styles.activityCardSelected,
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setSelectedActivity(activity.id);
                }}
              >
                <Ionicons
                  name={activity.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={24}
                  color={selectedActivity === activity.id ? colors.text.primary : colors.text.tertiary}
                />
                <Text style={[
                  styles.activityText,
                  selectedActivity === activity.id && styles.activityTextSelected,
                ]}>
                  {activity.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting Location</Text>
          <Input
            label="Location Name"
            placeholder="Venue, restaurant, or meeting point"
            value={locationName}
            onChangeText={setLocationName}
            leftIcon="location-outline"
          />
          <Input
            label="Address (Optional)"
            placeholder="Street address for directions"
            value={locationAddress}
            onChangeText={setLocationAddress}
            leftIcon="map-outline"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <Input
            placeholder="Any special requests or details..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        <View style={styles.safetyReminder}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary.blue} />
          <Text style={styles.safetyText}>
            Keep payment and communication in-app for support and protection. Everyone on Wingman is ID and photo verified before booking.
          </Text>
        </View>

        {(!idVerified || !emailVerified || !phoneVerified || !photoVerified) && (
          <View style={styles.verificationWarning}>
            <Ionicons name="warning" size={20} color={colors.status.warning} />
            <View style={styles.verificationWarningContent}>
              <Text style={styles.verificationWarningTitle}>Verification Required</Text>
              <Text style={styles.verificationWarningText}>
                {verificationWarningMessage}
              </Text>
            </View>
          </View>
        )}

        {!companion.isAvailable && (
          <View style={styles.verificationWarning}>
            <Ionicons name="time" size={20} color={colors.status.warning} />
            <View style={styles.verificationWarningContent}>
              <Text style={styles.verificationWarningTitle}>Wingman Unavailable</Text>
              <Text style={styles.verificationWarningText}>
                This wingman is currently unavailable. Try booking another wingman or check back later.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Card style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>${hourlyRate.toFixed(2)} × {selectedDuration} hours</Text>
            <Text style={styles.pricingValue}>${totalPrice.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Service fee (10%)</Text>
            <Text style={styles.pricingValue}>${serviceFee.toFixed(2)}</Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${grandTotal.toFixed(2)}</Text>
          </View>
        </Card>

        <Button
          title={companion.isAvailable ? 'Confirm Booking' : 'Wingman Unavailable'}
          onPress={handleBookPress}
          variant="primary"
          size="large"
          fullWidth
          loading={isProcessing}
          disabled={
            isProcessing ||
            !locationName.trim() ||
            !companion.isAvailable ||
            companion.hourlyRate <= 0
          }
        />
      </LinearGradient>
    </View>
  );
};

/**
 * BookingScreen - Wrapped with RequirementsGate to enforce all booking requirements.
 */
export const BookingScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="book_companion"
      modalTitle="Complete Requirements to Book"
    >
      <BookingScreenContent />
    </RequirementsGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.xl,
  },
  stateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
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
  scrollView: {
    flex: 1,
  },
  companionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  companionInfo: {
    flex: 1,
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  companionMeta: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    marginTop: 2,
  },
  companionResponse: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.screenPadding,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  datesContainer: {
    gap: spacing.sm,
  },
  dateCard: {
    width: 72,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    marginRight: spacing.sm,
  },
  dateCardSelected: {
    backgroundColor: colors.primary.blue,
  },
  dateDay: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  dateNumber: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  dateMonth: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  dateTextSelected: {
    color: colors.text.primary,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.md,
    minWidth: 88,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: colors.primary.blue,
  },
  timeText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  timeTextSelected: {
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  durationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  durationCard: {
    width: '31%',
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
  },
  durationCardSelected: {
    backgroundColor: colors.primary.blue,
  },
  durationText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  durationTextSelected: {
    color: colors.text.primary,
  },
  durationPrice: {
    ...typography.presets.h4,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  durationPriceSelected: {
    color: colors.text.primary,
  },
  activitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  activityCard: {
    width: '23%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    gap: spacing.xs,
  },
  activityCardSelected: {
    backgroundColor: colors.primary.blue,
  },
  activityText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  activityTextSelected: {
    color: colors.text.primary,
  },
  safetyReminder: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.screenPadding,
    gap: spacing.sm,
  },
  safetyText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    flex: 1,
    lineHeight: 18,
  },
  verificationWarning: {
    flexDirection: 'row',
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.status.warningLight,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.status.warning,
  },
  verificationWarningContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  verificationWarningTitle: {
    ...typography.presets.label,
    color: colors.status.warning,
    marginBottom: spacing.xs,
  },
  verificationWarningText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  verifyButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.status.warning,
    borderRadius: spacing.radius.md,
  },
  verifyButtonText: {
    ...typography.presets.button,
    color: colors.text.inverse,
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  pricingCard: {
    marginBottom: spacing.md,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  pricingLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  pricingValue: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  pricingDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  totalValue: {
    ...typography.presets.h3,
    color: colors.primary.blue,
  },
});
