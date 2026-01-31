import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import type { RootStackParamList, CompanionSpecialty } from '../types';

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

export const BookingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState<number>(0);
  const [selectedTime, setSelectedTime] = useState<string>('7:00 PM');
  const [selectedDuration, setSelectedDuration] = useState<number>(2);
  const [selectedActivity, setSelectedActivity] = useState<CompanionSpecialty>('dining');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

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

  const handleBookPress = async () => {
    await haptics.success();
    navigation.navigate('BookingConfirmation', { bookingId: '123' });
  };

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
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
            Sarah is background-checked and ID-verified. You can share your live location during the booking.
          </Text>
        </View>
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
          title="Confirm Booking"
          onPress={handleBookPress}
          variant="primary"
          size="large"
          fullWidth
        />
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
