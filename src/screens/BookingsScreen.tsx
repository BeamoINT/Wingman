import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Badge, Avatar } from '../components';
import type { RootStackParamList, Booking } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = 'upcoming' | 'past';

// Mock data
const mockBookings: Booking[] = [
  {
    id: '1',
    companion: {
      id: '1',
      user: {
        id: 'u1',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        isVerified: true,
        isBackgroundChecked: true,
        isPremium: true,
        createdAt: '2024-01-01',
      },
      rating: 4.9,
      reviewCount: 127,
      hourlyRate: 45,
      specialties: ['dining'],
      languages: [],
      availability: [],
      isOnline: true,
      responseTime: '',
      completedBookings: 89,
      badges: [],
      gallery: [],
      about: '',
      interests: [],
      verificationLevel: 'premium',
    },
    user: {} as any,
    status: 'confirmed',
    date: '2024-03-15',
    startTime: '19:00',
    endTime: '22:00',
    duration: 3,
    totalPrice: 135,
    location: {
      name: 'The French Laundry',
      address: '123 Main St',
      type: 'restaurant',
    },
    activityType: 'dining',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: '2',
    companion: {
      id: '2',
      user: {
        id: 'u2',
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'michael@example.com',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        isVerified: true,
        isBackgroundChecked: true,
        isPremium: false,
        createdAt: '2024-01-15',
      },
      rating: 4.7,
      reviewCount: 64,
      hourlyRate: 35,
      specialties: ['coffee-chat'],
      languages: [],
      availability: [],
      isOnline: false,
      responseTime: '',
      completedBookings: 42,
      badges: [],
      gallery: [],
      about: '',
      interests: [],
      verificationLevel: 'background',
    },
    user: {} as any,
    status: 'completed',
    date: '2024-03-10',
    startTime: '14:00',
    endTime: '16:00',
    duration: 2,
    totalPrice: 70,
    location: {
      name: 'Blue Bottle Coffee',
      address: '456 Oak Ave',
      type: 'cafe',
    },
    activityType: 'coffee-chat',
    createdAt: '',
    updatedAt: '',
  },
];

export const BookingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  const handleTabPress = async (tab: TabType) => {
    await haptics.selection();
    setActiveTab(tab);
  };

  const handleBookingPress = async (booking: Booking) => {
    await haptics.light();
    // Navigate to booking details
  };

  const upcomingBookings = mockBookings.filter(
    (b) => b.status === 'confirmed' || b.status === 'pending'
  );
  const pastBookings = mockBookings.filter(
    (b) => b.status === 'completed' || b.status === 'cancelled'
  );

  const currentBookings = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return colors.status.success;
      case 'pending':
        return colors.status.warning;
      case 'completed':
        return colors.primary.blue;
      case 'cancelled':
        return colors.status.error;
      default:
        return colors.text.tertiary;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
      >
        {currentBookings.length === 0 ? (
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
        ) : (
          currentBookings.map((booking) => (
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
                        label={booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        variant={
                          booking.status === 'confirmed' ? 'success' :
                          booking.status === 'pending' ? 'warning' :
                          booking.status === 'completed' ? 'info' : 'error'
                        }
                        size="small"
                      />
                    </View>
                  </View>
                  <Text style={styles.bookingPrice}>${booking.totalPrice}</Text>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={colors.text.tertiary} />
                    <Text style={styles.detailText}>{formatDate(booking.date)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={16} color={colors.text.tertiary} />
                    <Text style={styles.detailText}>
                      {formatTime(booking.startTime)} - {formatTime(booking.endTime)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={colors.text.tertiary} />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {booking.location.name}
                    </Text>
                  </View>
                </View>

                {booking.status === 'confirmed' && (
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
          ))
        )}
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
