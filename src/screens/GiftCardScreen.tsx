import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
import { Card, Button, Input } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface GiftAmount {
  value: number;
  label: string;
  description?: string;
  popular?: boolean;
}

interface GiftDesign {
  id: string;
  name: string;
  gradient: readonly string[];
  icon: string;
}

const giftAmounts: GiftAmount[] = [
  { value: 25, label: '$25', description: '~30 min hangout' },
  { value: 50, label: '$50', description: '~1 hour hangout', popular: true },
  { value: 100, label: '$100', description: '~2 hours or dinner' },
  { value: 200, label: '$200', description: 'Premium experience' },
  { value: 0, label: 'Custom', description: 'Enter any amount' },
];

const giftDesigns: GiftDesign[] = [
  { id: 'classic', name: 'Classic', gradient: colors.gradients.premium, icon: 'gift' },
  { id: 'celebration', name: 'Celebration', gradient: ['#FF6B6B', '#FFE66D'], icon: 'sparkles' },
  { id: 'friendship', name: 'Friendship', gradient: [colors.primary.blue, '#5DE0E6'], icon: 'heart' },
  { id: 'night-out', name: 'Night Out', gradient: ['#667eea', '#764ba2'], icon: 'moon' },
];

const occasions = [
  'Birthday', 'Thank You', 'Just Because', 'Congratulations',
  'Holidays', 'Get Well Soon', 'New to Town', 'Self Care'
];

export const GiftCardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [selectedAmount, setSelectedAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedDesign, setSelectedDesign] = useState('classic');
  const [selectedOccasion, setSelectedOccasion] = useState('Just Because');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [deliveryDate, setDeliveryDate] = useState<'now' | 'scheduled'>('now');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handlePurchase = async () => {
    await haptics.success();
    // Process purchase
  };

  const finalAmount = selectedAmount === 0 ? parseInt(customAmount) || 0 : selectedAmount;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gift Card</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview Card */}
        <View style={styles.previewSection}>
          <LinearGradient
            colors={[...(giftDesigns.find(d => d.id === selectedDesign)?.gradient || colors.gradients.premium)] as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.giftCardPreview}
          >
            <View style={styles.cardLogo}>
              <Ionicons name="airplane" size={24} color="rgba(0,0,0,0.6)" />
              <Text style={styles.cardLogoText}>Wingman</Text>
            </View>
            <View style={styles.cardAmount}>
              <Text style={styles.cardAmountValue}>${finalAmount || '—'}</Text>
              <Text style={styles.cardOccasion}>{selectedOccasion}</Text>
            </View>
            {recipientName && (
              <Text style={styles.cardRecipient}>For: {recipientName}</Text>
            )}
          </LinearGradient>
        </View>

        {/* Amount Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Amount</Text>
          <View style={styles.amountsGrid}>
            {giftAmounts.map((amount) => (
              <TouchableOpacity
                key={amount.value}
                style={[
                  styles.amountCard,
                  selectedAmount === amount.value && styles.amountCardActive,
                  amount.popular && styles.amountCardPopular,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedAmount(amount.value);
                  if (amount.value !== 0) setCustomAmount('');
                }}
              >
                {amount.popular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
                <Text style={[
                  styles.amountLabel,
                  selectedAmount === amount.value && styles.amountLabelActive,
                ]}>
                  {amount.label}
                </Text>
                {amount.description && (
                  <Text style={styles.amountDescription}>{amount.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {selectedAmount === 0 && (
            <View style={styles.customAmountContainer}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.customAmountInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={setCustomAmount}
              />
            </View>
          )}
        </View>

        {/* Design Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Design</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {giftDesigns.map((design) => (
              <TouchableOpacity
                key={design.id}
                style={[
                  styles.designCard,
                  selectedDesign === design.id && styles.designCardActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedDesign(design.id);
                }}
              >
                <LinearGradient
                  colors={[...design.gradient] as [string, string, ...string[]]}
                  style={styles.designPreview}
                >
                  <Ionicons name={design.icon as any} size={20} color="rgba(0,0,0,0.5)" />
                </LinearGradient>
                <Text style={[
                  styles.designName,
                  selectedDesign === design.id && styles.designNameActive,
                ]}>
                  {design.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Occasion Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Occasion</Text>
          <View style={styles.occasionsGrid}>
            {occasions.map((occasion) => (
              <TouchableOpacity
                key={occasion}
                style={[
                  styles.occasionChip,
                  selectedOccasion === occasion && styles.occasionChipActive,
                ]}
                onPress={() => {
                  haptics.selection();
                  setSelectedOccasion(occasion);
                }}
              >
                <Text style={[
                  styles.occasionText,
                  selectedOccasion === occasion && styles.occasionTextActive,
                ]}>
                  {occasion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recipient Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recipient</Text>
          <Card variant="outlined" style={styles.recipientCard}>
            <Input
              label="Recipient's Name"
              placeholder="Enter name"
              value={recipientName}
              onChangeText={setRecipientName}
              leftIcon="person-outline"
              containerStyle={styles.inputContainer}
            />
            <Input
              label="Recipient's Email"
              placeholder="Enter email"
              value={recipientEmail}
              onChangeText={setRecipientEmail}
              leftIcon="mail-outline"
              keyboardType="email-address"
              containerStyle={styles.inputContainer}
            />
          </Card>
        </View>

        {/* Personal Message */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Message (Optional)</Text>
          <TextInput
            style={styles.messageInput}
            placeholder="Write a heartfelt message..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            maxLength={200}
          />
          <Text style={styles.charCount}>{message.length}/200</Text>
        </View>

        {/* Delivery Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          <View style={styles.deliveryOptions}>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryDate === 'now' && styles.deliveryOptionActive]}
              onPress={() => {
                haptics.selection();
                setDeliveryDate('now');
              }}
            >
              <Ionicons
                name="flash"
                size={20}
                color={deliveryDate === 'now' ? colors.primary.blue : colors.text.tertiary}
              />
              <Text style={[
                styles.deliveryText,
                deliveryDate === 'now' && styles.deliveryTextActive,
              ]}>
                Send Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deliveryOption, deliveryDate === 'scheduled' && styles.deliveryOptionActive]}
              onPress={() => {
                haptics.selection();
                setDeliveryDate('scheduled');
              }}
            >
              <Ionicons
                name="calendar"
                size={20}
                color={deliveryDate === 'scheduled' ? colors.primary.blue : colors.text.tertiary}
              />
              <Text style={[
                styles.deliveryText,
                deliveryDate === 'scheduled' && styles.deliveryTextActive,
              ]}>
                Schedule
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <Card variant="gradient" style={styles.infoCard}>
          <Ionicons name="information-circle" size={20} color={colors.primary.blue} />
          <Text style={styles.infoText}>
            Gift cards never expire and can be used for any booking. Recipients can also apply it toward a subscription.
          </Text>
        </Card>
      </ScrollView>

      {/* Bottom Bar */}
      <LinearGradient
        colors={['transparent', colors.background.primary]}
        style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>${finalAmount || 0}</Text>
        </View>
        <Button
          title="Purchase Gift Card"
          onPress={handlePurchase}
          variant="gold"
          size="large"
          icon="gift"
          disabled={finalAmount < 10 || !recipientEmail}
          style={styles.purchaseButton}
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
  previewSection: {
    padding: spacing.screenPadding,
    alignItems: 'center',
  },
  giftCardPreview: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  cardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLogoText: {
    ...typography.presets.h4,
    color: 'rgba(0,0,0,0.6)',
  },
  cardAmount: {
    alignItems: 'flex-end',
  },
  cardAmountValue: {
    ...typography.presets.h1,
    fontSize: 48,
    color: colors.primary.darkBlack,
  },
  cardOccasion: {
    ...typography.presets.body,
    color: 'rgba(0,0,0,0.5)',
  },
  cardRecipient: {
    ...typography.presets.body,
    color: 'rgba(0,0,0,0.5)',
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amountCard: {
    width: '31%',
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  amountCardActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  amountCardPopular: {
    borderColor: colors.primary.gold,
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: colors.primary.gold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius.sm,
  },
  popularText: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  amountLabel: {
    ...typography.presets.h4,
    color: colors.text.secondary,
  },
  amountLabelActive: {
    color: colors.text.primary,
  },
  amountDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.lg,
  },
  dollarSign: {
    ...typography.presets.h3,
    color: colors.text.secondary,
  },
  customAmountInput: {
    flex: 1,
    padding: spacing.lg,
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  designCard: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  designCardActive: {},
  designPreview: {
    width: 80,
    height: 50,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  designName: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  designNameActive: {
    color: colors.primary.blue,
  },
  occasionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  occasionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.round,
  },
  occasionChipActive: {
    backgroundColor: colors.primary.blue,
  },
  occasionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  occasionTextActive: {
    color: colors.text.primary,
  },
  recipientCard: {
    padding: spacing.md,
  },
  inputContainer: {
    marginBottom: 0,
  },
  messageInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    color: colors.text.primary,
    ...typography.presets.body,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  deliveryOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deliveryOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deliveryOptionActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  deliveryText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  deliveryTextActive: {
    color: colors.text.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.screenPadding,
  },
  infoText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  totalContainer: {
    marginRight: spacing.lg,
  },
  totalLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  totalAmount: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  purchaseButton: {
    flex: 1,
  },
});
