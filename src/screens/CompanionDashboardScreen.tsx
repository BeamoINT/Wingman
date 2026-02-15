import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card } from '../components';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TimeRange = 'week' | 'month' | 'year';

interface Booking {
  id: string;
  user: { name: string; avatar: string };
  date: string;
  time: string;
  duration: number;
  amount: number;
  status: 'upcoming' | 'completed' | 'pending';
  activity: string;
}

const mockBookings: Booking[] = [
  { id: '1', user: { name: 'Alex T.', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200' }, date: 'Today', time: '7:00 PM', duration: 2, amount: 90, status: 'upcoming', activity: 'Dining' },
  { id: '2', user: { name: 'Jordan M.', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' }, date: 'Tomorrow', time: '3:00 PM', duration: 3, amount: 135, status: 'pending', activity: 'Coffee' },
  { id: '3', user: { name: 'Casey R.', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200' }, date: 'Mar 18', time: '8:00 PM', duration: 4, amount: 180, status: 'upcoming', activity: 'Concert' },
];

const earningsData = {
  week: { total: 540, bookings: 8, hours: 18 },
  month: { total: 2340, bookings: 32, hours: 72 },
  year: { total: 28500, bookings: 420, hours: 890 },
};

export const CompanionDashboardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [isOnline, setIsOnline] = useState(true);

  const currentData = earningsData[timeRange];

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const toggleOnlineStatus = async () => {
    await haptics.medium();
    setIsOnline(!isOnline);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wingman Dashboard</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="settings-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Toggle */}
        <View style={styles.section}>
          <Card
            variant="gradient"
            style={styles.statusCard}
            onPress={toggleOnlineStatus}
          >
            <View style={styles.statusContent}>
              <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>
                  {isOnline ? 'You\'re Online' : 'You\'re Offline'}
                </Text>
                <Text style={styles.statusDescription}>
                  {isOnline
                    ? 'Receiving booking requests'
                    : 'Tap to go online and receive requests'}
                </Text>
              </View>
              <View style={[styles.statusToggle, isOnline && styles.statusToggleActive]}>
                <View style={[styles.toggleKnob, isOnline && styles.toggleKnobActive]} />
              </View>
            </View>
          </Card>
        </View>

        {/* Earnings Overview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Earnings</Text>
            <View style={styles.timeRangeSelector}>
              {(['week', 'month', 'year'] as TimeRange[]).map((range) => (
                <TouchableOpacity
                  key={range}
                  style={[
                    styles.timeRangeButton,
                    timeRange === range && styles.timeRangeButtonActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setTimeRange(range);
                  }}
                >
                  <Text style={[
                    styles.timeRangeText,
                    timeRange === range && styles.timeRangeTextActive,
                  ]}>
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.earningsCard}
          >
            <Text style={styles.earningsLabel}>Total Earnings</Text>
            <Text style={styles.earningsAmount}>${currentData.total.toLocaleString()}</Text>

            <View style={styles.earningsStats}>
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>{currentData.bookings}</Text>
                <Text style={styles.earningStatLabel}>Bookings</Text>
              </View>
              <View style={styles.earningsStatDivider} />
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>{currentData.hours}</Text>
                <Text style={styles.earningStatLabel}>Hours</Text>
              </View>
              <View style={styles.earningsStatDivider} />
              <View style={styles.earningStat}>
                <Text style={styles.earningStatValue}>
                  ${Math.round(currentData.total / currentData.hours)}
                </Text>
                <Text style={styles.earningStatLabel}>Avg/Hour</Text>
              </View>
            </View>
          </LinearGradient>

          <TouchableOpacity style={styles.withdrawButton} onPress={() => haptics.medium()}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary.blue} />
            <Text style={styles.withdrawText}>Withdraw Earnings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(255, 215, 0, 0.15)' }]}>
                <Ionicons name="star" size={20} color={colors.primary.gold} />
              </View>
              <Text style={styles.statValue}>4.9</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(78, 205, 196, 0.15)' }]}>
                <Ionicons name="flash" size={20} color={colors.primary.blue} />
              </View>
              <Text style={styles.statValue}>15m</Text>
              <Text style={styles.statLabel}>Avg Response</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
              </View>
              <Text style={styles.statValue}>98%</Text>
              <Text style={styles.statLabel}>Completion</Text>
            </Card>
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
                <Ionicons name="repeat" size={20} color={colors.verification.trusted} />
              </View>
              <Text style={styles.statValue}>42%</Text>
              <Text style={styles.statLabel}>Repeat Clients</Text>
            </Card>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
            <TouchableOpacity onPress={() => haptics.light()}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          {mockBookings.map((booking) => (
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

              <View style={styles.bookingDetails}>
                <View style={styles.bookingDetail}>
                  <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.date}</Text>
                </View>
                <View style={styles.bookingDetail}>
                  <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.time}</Text>
                </View>
                <View style={styles.bookingDetail}>
                  <Ionicons name="hourglass-outline" size={14} color={colors.text.tertiary} />
                  <Text style={styles.bookingDetailText}>{booking.duration}h</Text>
                </View>
              </View>

              <View style={styles.bookingFooter}>
                <Text style={styles.bookingAmount}>${booking.amount}</Text>
                {booking.status === 'pending' ? (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity style={styles.declineButton} onPress={() => haptics.light()}>
                      <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptButton} onPress={() => haptics.success()}>
                      <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.messageButton} onPress={() => haptics.light()}>
                    <Ionicons name="chatbubble-outline" size={16} color={colors.primary.blue} />
                    <Text style={styles.messageText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>

        {/* Tips */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.tipsCard}>
            <Ionicons name="bulb-outline" size={24} color={colors.primary.gold} />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Boost Your Earnings</Text>
              <Text style={styles.tipsText}>
                Complete your video introduction to get 40% more booking requests!
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </Card>
        </View>
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
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  seeAllText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  statusCard: {
    padding: spacing.lg,
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.text.tertiary,
    marginRight: spacing.md,
  },
  statusDotOnline: {
    backgroundColor: colors.status.success,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  statusDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background.tertiary,
    padding: 3,
  },
  statusToggleActive: {
    backgroundColor: colors.status.success,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text.primary,
  },
  toggleKnobActive: {
    marginLeft: 20,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.sm,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.background.card,
  },
  timeRangeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  timeRangeTextActive: {
    color: colors.text.primary,
  },
  earningsCard: {
    padding: spacing.xl,
    borderRadius: spacing.radius.xl,
    marginBottom: spacing.md,
  },
  earningsLabel: {
    ...typography.presets.bodySmall,
    color: colors.primary.darkBlack,
    opacity: 0.8,
  },
  earningsAmount: {
    ...typography.presets.hero,
    color: colors.primary.darkBlack,
    marginVertical: spacing.sm,
  },
  earningsStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  earningStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningStatValue: {
    ...typography.presets.h3,
    color: colors.primary.darkBlack,
  },
  earningStatLabel: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    opacity: 0.8,
    marginTop: 2,
  },
  earningsStatDivider: {
    width: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.card,
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    gap: spacing.sm,
  },
  withdrawText: {
    ...typography.presets.button,
    color: colors.primary.blue,
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  bookingCard: {
    marginBottom: spacing.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  bookingName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  bookingActivity: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  bookingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  bookingDetailText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  bookingAmount: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  declineButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.errorLight,
    borderRadius: spacing.radius.md,
  },
  declineText: {
    ...typography.presets.buttonSmall,
    color: colors.status.error,
  },
  acceptButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.status.success,
    borderRadius: spacing.radius.md,
  },
  acceptText: {
    ...typography.presets.buttonSmall,
    color: colors.text.primary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messageText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.blue,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tipsContent: {
    flex: 1,
  },
  tipsTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  tipsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
