import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button, Card, Avatar, Badge, Input } from '../components';
import type { RootStackParamList, Companion } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SelectedCompanion {
  companion: Companion;
  role: 'primary' | 'support';
}

const mockAvailableCompanions: Companion[] = [
  {
    id: '1',
    user: { id: 'u1', firstName: 'Sarah', lastName: 'J', email: '', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.9, reviewCount: 127, hourlyRate: 45, specialties: ['social-events', 'dining'], languages: ['English'], availability: [], isOnline: true, responseTime: '', completedBookings: 89, badges: [], gallery: [], about: '', interests: [], verificationLevel: 'premium',
  },
  {
    id: '2',
    user: { id: 'u2', firstName: 'Michael', lastName: 'C', email: '', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', isVerified: true,  isPremium: false, createdAt: '' },
    rating: 4.7, reviewCount: 64, hourlyRate: 35, specialties: ['social-events', 'sports'], languages: ['English'], availability: [], isOnline: true, responseTime: '', completedBookings: 42, badges: [], gallery: [], about: '', interests: [], verificationLevel: 'verified',
  },
  {
    id: '3',
    user: { id: 'u3', firstName: 'Emma', lastName: 'W', email: '', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.8, reviewCount: 89, hourlyRate: 40, specialties: ['social-events', 'concerts'], languages: ['English'], availability: [], isOnline: false, responseTime: '', completedBookings: 56, badges: [], gallery: [], about: '', interests: [], verificationLevel: 'premium',
  },
];

const groupSizes = [
  { count: 2, label: '2 people', companions: 1 },
  { count: 4, label: '4 people', companions: 2 },
  { count: 6, label: '6 people', companions: 3 },
  { count: 8, label: '8+ people', companions: 4 },
];

export const GroupBookingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [groupSize, setGroupSize] = useState(4);
  const [selectedCompanions, setSelectedCompanions] = useState<SelectedCompanion[]>([]);
  const [eventName, setEventName] = useState('');
  const [splitPayment, setSplitPayment] = useState(false);

  const recommendedCompanions = Math.ceil(groupSize / 2);
  const hourlyRate = selectedCompanions.reduce((sum, sc) => sum + sc.companion.hourlyRate, 0);
  const duration = 3;
  const totalPrice = hourlyRate * duration;
  const pricePerPerson = splitPayment ? Math.ceil(totalPrice / groupSize) : totalPrice;

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleSelectCompanion = async (companion: Companion) => {
    await haptics.medium();
    const isSelected = selectedCompanions.find(sc => sc.companion.id === companion.id);

    if (isSelected) {
      setSelectedCompanions(selectedCompanions.filter(sc => sc.companion.id !== companion.id));
    } else if (selectedCompanions.length < recommendedCompanions) {
      setSelectedCompanions([
        ...selectedCompanions,
        { companion, role: selectedCompanions.length === 0 ? 'primary' : 'support' }
      ]);
    }
  };

  const handleContinue = async () => {
    await haptics.success();
    // Navigate to booking confirmation
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Group Size Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Size</Text>
          <Text style={styles.sectionSubtitle}>How many people will be attending?</Text>

          <View style={styles.groupSizesGrid}>
            {groupSizes.map((size) => (
              <TouchableOpacity
                key={size.count}
                style={[
                  styles.groupSizeCard,
                  groupSize === size.count && styles.groupSizeCardActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setGroupSize(size.count);
                  setSelectedCompanions([]);
                }}
              >
                <View style={styles.groupSizeIcon}>
                  {[...Array(Math.min(size.count, 4))].map((_, i) => (
                    <Ionicons
                      key={i}
                      name="person"
                      size={16}
                      color={groupSize === size.count ? colors.text.primary : colors.text.tertiary}
                      style={{ marginLeft: i > 0 ? -6 : 0 }}
                    />
                  ))}
                </View>
                <Text style={[
                  styles.groupSizeLabel,
                  groupSize === size.count && styles.groupSizeLabelActive,
                ]}>
                  {size.label}
                </Text>
                <Text style={[
                  styles.groupSizeCompanions,
                  groupSize === size.count && styles.groupSizeCompanionsActive,
                ]}>
                  {size.companions} companion{size.companions > 1 ? 's' : ''} recommended
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Event Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>
          <Input
            placeholder="e.g., Birthday Dinner, Team Outing"
            value={eventName}
            onChangeText={setEventName}
            leftIcon="calendar-outline"
            label="Event Name"
          />
        </View>

        {/* Select Companions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Select Companions</Text>
            <Badge
              label={`${selectedCompanions.length}/${recommendedCompanions}`}
              variant={selectedCompanions.length === recommendedCompanions ? 'success' : 'info'}
              size="small"
            />
          </View>
          <Text style={styles.sectionSubtitle}>
            Choose {recommendedCompanions} companion{recommendedCompanions > 1 ? 's' : ''} for your group
          </Text>

          <View style={styles.companionsGrid}>
            {mockAvailableCompanions.map((companion) => {
              const isSelected = selectedCompanions.find(sc => sc.companion.id === companion.id);
              const selectionIndex = selectedCompanions.findIndex(sc => sc.companion.id === companion.id);

              return (
                <TouchableOpacity
                  key={companion.id}
                  style={[
                    styles.companionCard,
                    isSelected && styles.companionCardSelected,
                  ]}
                  onPress={() => handleSelectCompanion(companion)}
                  disabled={!isSelected && selectedCompanions.length >= recommendedCompanions}
                >
                  <View style={styles.companionImageContainer}>
                    <Image
                      source={{ uri: companion.user.avatar }}
                      style={styles.companionImage}
                    />
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>{selectionIndex + 1}</Text>
                      </View>
                    )}
                    {companion.isOnline && <View style={styles.onlineDot} />}
                  </View>
                  <Text style={styles.companionName}>{companion.user.firstName}</Text>
                  <View style={styles.companionRating}>
                    <Ionicons name="star" size={12} color={colors.primary.gold} />
                    <Text style={styles.companionRatingText}>{companion.rating}</Text>
                  </View>
                  <Text style={styles.companionRate}>${companion.hourlyRate}/hr</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Payment Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Options</Text>

          <Card variant="outlined" style={styles.paymentCard}>
            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => {
                haptics.selection();
                setSplitPayment(false);
              }}
            >
              <View style={[styles.radio, !splitPayment && styles.radioSelected]}>
                {!splitPayment && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentLabel}>Pay Full Amount</Text>
                <Text style={styles.paymentDescription}>You cover the entire booking</Text>
              </View>
              <Text style={styles.paymentAmount}>${totalPrice}</Text>
            </TouchableOpacity>

            <View style={styles.paymentDivider} />

            <TouchableOpacity
              style={styles.paymentOption}
              onPress={() => {
                haptics.selection();
                setSplitPayment(true);
              }}
            >
              <View style={[styles.radio, splitPayment && styles.radioSelected]}>
                {splitPayment && <View style={styles.radioInner} />}
              </View>
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentLabel}>Split Payment</Text>
                <Text style={styles.paymentDescription}>Each person pays their share</Text>
              </View>
              <View style={styles.splitAmount}>
                <Text style={styles.paymentAmount}>${pricePerPerson}</Text>
                <Text style={styles.perPersonText}>per person</Text>
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Group Benefits */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.benefitsCard}>
            <View style={styles.benefitRow}>
              <Ionicons name="people" size={20} color={colors.primary.blue} />
              <Text style={styles.benefitText}>10% group discount applied</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="shield-checkmark" size={20} color={colors.status.success} />
              <Text style={styles.benefitText}>Extra safety with multiple companions</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="chatbubbles" size={20} color={colors.verification.trusted} />
              <Text style={styles.benefitText}>Group chat for coordination</Text>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View style={styles.bottomPricing}>
          <Text style={styles.bottomPriceLabel}>
            {splitPayment ? 'Your share' : 'Total'}
          </Text>
          <Text style={styles.bottomPrice}>
            ${splitPayment ? pricePerPerson : totalPrice}
          </Text>
          <Text style={styles.bottomDuration}>for {duration} hours</Text>
        </View>
        <Button
          title="Continue"
          onPress={handleContinue}
          variant="primary"
          size="large"
          disabled={selectedCompanions.length === 0}
          style={styles.continueButton}
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
  section: {
    padding: spacing.screenPadding,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  groupSizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupSizeCard: {
    width: '48%',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  groupSizeCardActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  groupSizeIcon: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  groupSizeLabel: {
    ...typography.presets.h4,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  groupSizeLabelActive: {
    color: colors.text.primary,
  },
  groupSizeCompanions: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  groupSizeCompanionsActive: {
    color: colors.primary.blue,
  },
  companionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  companionCard: {
    width: '30%',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  companionCardSelected: {
    borderColor: colors.primary.blue,
  },
  companionImageContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  companionImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background.tertiary,
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
    fontSize: 11,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  companionName: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  companionRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  companionRatingText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  companionRate: {
    ...typography.presets.caption,
    color: colors.primary.blue,
    marginTop: 4,
  },
  paymentCard: {
    padding: 0,
    overflow: 'hidden',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.lg + 28,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioSelected: {
    borderColor: colors.primary.blue,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.blue,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  paymentDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  paymentAmount: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  splitAmount: {
    alignItems: 'flex-end',
  },
  perPersonText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  benefitsCard: {
    gap: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  benefitText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  bottomPricing: {},
  bottomPriceLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  bottomPrice: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  bottomDuration: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  continueButton: {
    minWidth: 140,
  },
});
