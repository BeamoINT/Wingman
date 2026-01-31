import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Button, Card, Avatar } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const BookingConfirmationScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const checkScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    haptics.celebration();

    checkScale.value = withSequence(
      withSpring(1.2, { damping: 8 }),
      withSpring(1, { damping: 12 })
    );

    contentOpacity.value = withDelay(400, withSpring(1));
  }, []);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleViewBooking = async () => {
    await haptics.light();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleMessageCompanion = async () => {
    await haptics.light();
    navigation.navigate('Chat', { conversationId: '1' });
  };

  return (
    <LinearGradient
      colors={[colors.background.primary, colors.background.secondary]}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        {/* Success Animation */}
        <Animated.View style={[styles.successIcon, checkAnimatedStyle]}>
          <LinearGradient
            colors={colors.gradients.primary}
            style={styles.iconGradient}
          >
            <Ionicons name="checkmark" size={48} color={colors.text.primary} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.textContent, contentAnimatedStyle]}>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            Sarah has been notified and will confirm shortly
          </Text>

          {/* Booking Details Card */}
          <Card variant="outlined" style={styles.detailsCard}>
            <View style={styles.companionRow}>
              <Avatar
                source="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400"
                name="Sarah Johnson"
                size="medium"
                showOnlineStatus
                isOnline={true}
              />
              <View style={styles.companionInfo}>
                <Text style={styles.companionName}>Sarah J.</Text>
                <Text style={styles.companionStatus}>Usually responds within 15 min</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color={colors.text.tertiary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Date & Time</Text>
                <Text style={styles.detailValue}>Friday, Mar 15 • 7:00 PM</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color={colors.text.tertiary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>2 hours</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="restaurant-outline" size={20} color={colors.text.tertiary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Activity</Text>
                <Text style={styles.detailValue}>Dining</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color={colors.text.tertiary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>The French Laundry</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>$99</Text>
            </View>
          </Card>

          {/* Safety Tip */}
          <View style={styles.safetyTip}>
            <Ionicons name="shield-checkmark" size={20} color={colors.primary.blue} />
            <Text style={styles.safetyText}>
              Share your live location with trusted contacts during the booking for added safety.
            </Text>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View style={[styles.buttons, contentAnimatedStyle]}>
          <Button
            title="Message Sarah"
            onPress={handleMessageCompanion}
            variant="outline"
            size="large"
            fullWidth
            icon={<Ionicons name="chatbubble-outline" size={18} color={colors.primary.blue} />}
          />
          <Button
            title="View My Bookings"
            onPress={handleViewBooking}
            variant="primary"
            size="large"
            fullWidth
          />
        </Animated.View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    marginBottom: spacing.xxl,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  textContent: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  detailsCard: {
    width: '100%',
    marginBottom: spacing.lg,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  companionInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  companionName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  companionStatus: {
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
    marginBottom: spacing.md,
    gap: spacing.md,
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  totalValue: {
    ...typography.presets.h2,
    color: colors.primary.blue,
  },
  safetyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
  },
  safetyText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
  buttons: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
});
