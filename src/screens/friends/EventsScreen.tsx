import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    FlatList,
    Image, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components';
import { RequirementsGate } from '../../components/RequirementsGate';
import { useRequirements } from '../../context/RequirementsContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { RootStackParamList } from '../../types';
import type { FriendEvent, FriendProfile } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock host profile
const mockHost: FriendProfile = {
  id: '1',
  userId: 'u1',
  firstName: 'Alex',
  lastName: 'K',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
  age: 28,
  location: { city: 'San Francisco', state: 'CA', country: 'USA' },
  interests: [],
  languages: [],
  lookingFor: [],
  isOnline: true,
  lastActive: new Date().toISOString(),
  verificationLevel: 'verified',
  mutualFriendsCount: 0,
  createdAt: new Date().toISOString(),
};

// Mock events
const mockEvents: FriendEvent[] = [
  {
    id: '1',
    title: 'Saturday Morning Hike',
    description: 'Join us for a scenic hike at Lands End. All fitness levels welcome! We will meet at the parking lot and start at 9 AM sharp.',
    category: 'outdoor',
    hostId: 'u1',
    host: mockHost,
    coverImage: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600',
    location: {
      name: 'Lands End Lookout',
      address: '680 Point Lobos Ave',
      city: 'San Francisco',
    },
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    maxAttendees: 15,
    currentAttendees: 8,
    isPublic: true,
    rsvpStatus: 'going',
    attendees: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Food Truck Festival Meetup',
    description: 'Let us explore the Off the Grid food truck festival together! Plenty of great food options.',
    category: 'dinner',
    hostId: 'u2',
    host: { ...mockHost, id: '2', firstName: 'Jordan', lastName: 'M' },
    coverImage: 'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=600',
    location: {
      name: 'Fort Mason Center',
      address: '2 Marina Blvd',
      city: 'San Francisco',
    },
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    currentAttendees: 12,
    isPublic: true,
    rsvpStatus: 'interested',
    attendees: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Board Game Night',
    description: 'Monthly board game night at the Folsom Street Foundry. Bring your favorite games or try new ones!',
    category: 'game-night',
    hostId: 'u3',
    host: { ...mockHost, id: '3', firstName: 'Sam', lastName: 'R' },
    coverImage: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=600',
    location: {
      name: 'Folsom Street Foundry',
      address: '1425 Folsom St',
      city: 'San Francisco',
    },
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    maxAttendees: 20,
    currentAttendees: 14,
    isPublic: true,
    attendees: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Jazz Night at The Saloon',
    description: 'Live jazz at San Francisco oldest bar. Great music and good vibes!',
    category: 'concert',
    hostId: 'u1',
    host: mockHost,
    coverImage: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=600',
    location: {
      name: 'The Saloon',
      address: '1232 Grant Ave',
      city: 'San Francisco',
    },
    dateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    currentAttendees: 6,
    price: 10,
    isPublic: true,
    attendees: [],
    createdAt: new Date().toISOString(),
  },
];

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  meetup: 'people-outline',
  activity: 'bicycle-outline',
  dinner: 'restaurant-outline',
  sports: 'basketball-outline',
  concert: 'musical-notes-outline',
  movie: 'film-outline',
  'game-night': 'game-controller-outline',
  outdoor: 'trail-sign-outline',
  workshop: 'school-outline',
  party: 'wine-outline',
};

/**
 * EventsScreen - Browse and create local events
 * Subscription-gated: Viewing requires Plus, creating requires Elite
 */
const EventsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { friendsLimits, canUseFriendsFeature } = useRequirements();

  const [events, setEvents] = useState<FriendEvent[]>(mockEvents);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'my-events'>('upcoming');

  const canCreateEvents = friendsLimits.canCreateEvents;
  const myEvents = events.filter(e => e.rsvpStatus === 'going' || e.hostId === 'me');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleCreateEvent = async () => {
    const createCheck = canUseFriendsFeature('create_event');
    if (!createCheck.met) {
      navigation.navigate('Subscription');
      return;
    }
    // In a real app, navigate to event creation screen
    await haptics.medium();
  };

  const handleRSVP = async (eventId: string, status: 'going' | 'interested' | 'not_going') => {
    await haptics.light();
    setEvents(events.map(event =>
      event.id === eventId
        ? {
            ...event,
            rsvpStatus: status,
            currentAttendees: status === 'going'
              ? event.currentAttendees + 1
              : status === 'not_going' && event.rsvpStatus === 'going'
              ? event.currentAttendees - 1
              : event.currentAttendees,
          }
        : event
    ));
  };

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatEventTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderEvent = ({ item }: { item: FriendEvent }) => (
    <TouchableOpacity style={styles.eventCard}>
      <Image
        source={{ uri: item.coverImage }}
        style={styles.eventCover}
        resizeMode="cover"
      />

      <View style={styles.dateOverlay}>
        <Text style={styles.dateDay}>
          {new Date(item.dateTime).getDate()}
        </Text>
        <Text style={styles.dateMonth}>
          {new Date(item.dateTime).toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>

      <View style={styles.eventInfo}>
        <View style={styles.eventHeader}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={categoryIcons[item.category] || 'calendar-outline'}
              size={12}
              color={colors.primary.blue}
            />
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
        </View>

        <View style={styles.eventMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.metaText}>
              {formatEventDate(item.dateTime)} at {formatEventTime(item.dateTime)}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location.name}
            </Text>
          </View>
        </View>

        <View style={styles.eventFooter}>
          <View style={styles.hostInfo}>
            <Avatar
              source={item.host.avatar}
              name={`${item.host.firstName} ${item.host.lastName}`}
              size="small"
            />
            <Text style={styles.hostName}>
              {item.host.firstName} {item.host.lastName}
            </Text>
          </View>

          <View style={styles.attendeeInfo}>
            <Ionicons name="people" size={14} color={colors.text.tertiary} />
            <Text style={styles.attendeeText}>
              {item.currentAttendees}
              {item.maxAttendees ? `/${item.maxAttendees}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.rsvpButtons}>
          <TouchableOpacity
            style={[
              styles.rsvpButton,
              item.rsvpStatus === 'going' && styles.rsvpButtonActive,
            ]}
            onPress={() => handleRSVP(item.id, 'going')}
          >
            <Ionicons
              name={item.rsvpStatus === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={16}
              color={item.rsvpStatus === 'going' ? colors.status.success : colors.text.tertiary}
            />
            <Text style={[
              styles.rsvpButtonText,
              item.rsvpStatus === 'going' && styles.rsvpButtonTextActive,
            ]}>
              Going
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rsvpButton,
              item.rsvpStatus === 'interested' && styles.rsvpButtonInterested,
            ]}
            onPress={() => handleRSVP(item.id, 'interested')}
          >
            <Ionicons
              name={item.rsvpStatus === 'interested' ? 'star' : 'star-outline'}
              size={16}
              color={item.rsvpStatus === 'interested' ? colors.primary.coral : colors.text.tertiary}
            />
            <Text style={[
              styles.rsvpButtonText,
              item.rsvpStatus === 'interested' && styles.rsvpButtonTextInterested,
            ]}>
              Interested
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateEvent}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={canCreateEvents ? colors.primary.blue : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Create Event Banner (for non-Elite users) */}
      {!canCreateEvents && (
        <TouchableOpacity
          style={styles.upgradeBanner}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Ionicons name="calendar" size={20} color={colors.primary.coral} />
          <Text style={styles.upgradeBannerText}>
            Upgrade to Elite to create your own events
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-events' && styles.tabActive]}
          onPress={() => setActiveTab('my-events')}
        >
          <Text style={[styles.tabText, activeTab === 'my-events' && styles.tabTextActive]}>
            My Events ({myEvents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Events List */}
      <FlatList
        data={activeTab === 'upcoming' ? events : myEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No Events</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'my-events'
                ? 'Events you are going to will appear here'
                : 'Check back later for new events in your area'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

export const EventsScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="friends_groups"
      modalTitle="Upgrade to View Events"
    >
      <EventsContent />
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
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  createButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    borderRadius: spacing.radius.md,
  },
  upgradeBannerText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: spacing.radius.full,
    backgroundColor: colors.background.card,
  },
  tabActive: {
    backgroundColor: colors.primary.blue,
  },
  tabText: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.screenPadding,
  },
  eventCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
  },
  eventCover: {
    width: '100%',
    height: 140,
  },
  dateOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
  },
  dateDay: {
    ...typography.presets.h4,
    color: colors.text.primary,
    lineHeight: 22,
  },
  dateMonth: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  eventInfo: {
    padding: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    flex: 1,
  },
  eventMeta: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  hostName: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attendeeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rsvpButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.background.tertiary,
  },
  rsvpButtonActive: {
    backgroundColor: 'rgba(72, 187, 120, 0.1)',
  },
  rsvpButtonInterested: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  rsvpButtonText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  rsvpButtonTextActive: {
    color: colors.status.success,
  },
  rsvpButtonTextInterested: {
    color: colors.primary.coral,
  },
  separator: {
    height: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.md,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
