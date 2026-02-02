import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button, Card, Avatar, Badge, Input } from '../components';
import { RequirementsGate, useFeatureGate } from '../components/RequirementsGate';
import { useAuth } from '../context/AuthContext';
import { useRequirements } from '../context/RequirementsContext';
import { useVerification } from '../context/VerificationContext';
import type { RootStackParamList, CompanionSpecialty, LegalDocumentType } from '../types';

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

// Inner component that contains the actual booking UI
const BookingScreenContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { checkBookingRequirements, consents } = useRequirements();
  const { idVerified, emailVerified } = useVerification();

  const [selectedDate, setSelectedDate] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('7:00 PM');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedActivity, setSelectedActivity] = useState<CompanionSpecialty>('dining');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const hourlyRate = 45;
  const totalPrice = hourlyRate * selectedDuration;
  const serviceFee = Math.round(totalPrice * 0.1);
  const grandTotal = totalPrice + serviceFee;

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      full: date.toISOString().split('T')[0],
    };
  });

  // Final validation before booking
  const validateBeforeBooking = useCallback((): { valid: boolean; message?: string } => {
    // Check all requirements one more time
    const requirements = checkBookingRequirements();

    if (!requirements.isAuthenticated.met) {
      return { valid: false, message: 'You must be signed in to book a companion.' };
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
      return { valid: false, message: 'You must verify your email address.' };
    }

    if (!requirements.idVerified.met) {
      return { valid: false, message: 'You must verify your identity before booking.' };
    }

    if (!requirements.profileComplete.met) {
      return { valid: false, message: 'Please complete your profile before booking.' };
    }

    // Validate booking-specific fields
    if (!location.trim()) {
      return { valid: false, message: 'Please enter a meeting location.' };
    }

    return { valid: true };
  }, [checkBookingRequirements, location]);

  const handleBookPress = async () => {
    // Perform final validation
    const validation = validateBeforeBooking();

    if (!validation.valid) {
      await haptics.warning();
      Alert.alert(
        'Cannot Complete Booking',
        validation.message,
        [
          {
            text: 'OK',
            style: 'default',
          },
        ]
      );
      return;
    }

    setIsProcessing(true);

    try {
      await haptics.success();
      navigation.navigate('BookingConfirmation', { bookingId: '123' });
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to complete booking. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleRequirementPress = async (navigateTo: string) => {
    await haptics.light();
    setShowRequirementsModal(false);

    switch (navigateTo) {
      case 'Verification':
        navigation.navigate('Verification');
        break;
      case 'Subscription':
        navigation.navigate('Subscription');
        break;
      case 'LegalDocument':
        navigation.navigate('LegalDocument', { documentType: 'terms-of-service' as LegalDocumentType });
        break;
      default:
        break;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Companion</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Companion Preview */}
        <View style={styles.companionPreview}>
          <Avatar
            source="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"
            name="Sarah Johnson"
            size="medium"
            showVerified
            verificationLevel="premium"
          />
          <View style={styles.companionInfo}>
            <Text style={styles.companionName}>Sarah J.</Text>
            <Text style={styles.companionRate}>${hourlyRate}/hr</Text>
          </View>
          <Badge label="Premium" variant="premium" icon="star" size="small" />
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datesContainer}
          >
            {dates.map((date, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCard,
                  selectedDate === index && styles.dateCardSelected,
                ]}
                onPress={() => {
                  haptics.selection();
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

        {/* Time Selection */}
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
                onPress={() => {
                  haptics.selection();
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

        {/* Duration Selection */}
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
                onPress={() => {
                  haptics.selection();
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
                  ${hourlyRate * duration.hours}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Activity Type */}
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
                onPress={() => {
                  haptics.selection();
                  setSelectedActivity(activity.id);
                }}
              >
                <Ionicons
                  name={activity.icon as any}
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

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting Location</Text>
          <Input
            placeholder="Enter venue name or address"
            value={location}
            onChangeText={setLocation}
            leftIcon="location-outline"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <Input
            placeholder="Any special requests or details..."
            value={notes}
            onChangeText={setNotes}
            multiline
            containerStyle={{ marginBottom: 0 }}
          />
        </View>

        {/* Safety Reminder */}
        <View style={styles.safetyReminder}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary.blue} />
          <Text style={styles.safetyText}>
            Sarah is ID-verified. You can share your live location during the booking.
          </Text>
        </View>

        {/* Verification Status */}
        {(!idVerified || !emailVerified) && (
          <View style={styles.verificationWarning}>
            <Ionicons name="warning" size={20} color={colors.status.warning} />
            <View style={styles.verificationWarningContent}>
              <Text style={styles.verificationWarningTitle}>Verification Required</Text>
              <Text style={styles.verificationWarningText}>
                {!emailVerified && !idVerified
                  ? 'Complete email and ID verification to book'
                  : !emailVerified
                  ? 'Verify your email to book'
                  : 'Complete ID verification to book'}
              </Text>
              <TouchableOpacity
                style={styles.verifyButton}
                onPress={() => navigation.navigate('Verification')}
              >
                <Text style={styles.verifyButtonText}>Complete Verification</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Pricing Bar */}
      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <Card style={styles.pricingCard}>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>${hourlyRate} × {selectedDuration} hours</Text>
            <Text style={styles.pricingValue}>${totalPrice}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>Service fee</Text>
            <Text style={styles.pricingValue}>${serviceFee}</Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${grandTotal}</Text>
          </View>
        </Card>

        <Button
          title={isProcessing ? 'Processing...' : 'Confirm Booking'}
          onPress={handleBookPress}
          variant="primary"
          size="large"
          fullWidth
          disabled={isProcessing || !idVerified || !emailVerified || !location.trim()}
        />
      </LinearGradient>
    </View>
  );
};

/**
 * BookingScreen - Wrapped with RequirementsGate to enforce all booking requirements
 *
 * Requirements checked before allowing access:
 * - User is authenticated
 * - Age is confirmed (18+)
 * - Terms of Service accepted
 * - Privacy Policy accepted
 * - Email verified
 * - ID verified
 * - Within monthly booking limit
 * - Profile is complete
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
  },
  companionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  companionRate: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    marginTop: 2,
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
    width: 64,
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
