import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components';
import { PillTabs } from '../../components';
import { RequirementsGate } from '../../components/RequirementsGate';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useRequirements } from '../../context/RequirementsContext';
import { fetchFriendEvents, setEventRsvp } from '../../services/api/friendsApi';
import { getOrCreateEventConversation } from '../../services/api/messages';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type { FriendEvent } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
 * Subscription-gated: Pro required
 */
const EventsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { user } = useAuth();
  const { friendsLimits, canUseFriendsFeature } = useRequirements();

  const [events, setEvents] = useState<FriendEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'my-events'>('upcoming');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { events: loadedEvents, error: eventsError } = await fetchFriendEvents();
      if (eventsError) {
        console.error('Error loading events:', eventsError);
        setError('Unable to load events right now.');
        setEvents([]);
        return;
      }

      setEvents(loadedEvents);
    } catch (loadError) {
      console.error('Error in loadEvents:', loadError);
      setError('Something went wrong while loading events.');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const canCreateEvents = friendsLimits.canCreateEvents;
  const myEvents = useMemo(() => (
    events.filter((event) => event.rsvpStatus === 'going' || event.hostId === user?.id)
  ), [events, user?.id]);

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
    setUpdatingEventId(eventId);
    await haptics.light();
    setEvents((previousEvents) => previousEvents.map((event) => (
      event.id === eventId
        ? { ...event, rsvpStatus: status }
        : event
    )));

    try {
      const { success, error: rsvpError } = await setEventRsvp(eventId, status);
      if (!success || rsvpError) {
        console.error('Error updating RSVP:', rsvpError);
        setError(rsvpError?.message || 'Unable to update RSVP right now.');
        await loadEvents();
        return;
      }

      await loadEvents();
    } finally {
      setUpdatingEventId(null);
    }
  };

  const handleOpenEventChat = async (eventId: string) => {
    await haptics.light();
    const { conversation, error: conversationError } = await getOrCreateEventConversation(eventId);
    if (conversationError || !conversation?.id) {
      setError(conversationError?.message || 'Unable to open event chat right now.');
      return;
    }

    navigation.navigate('Chat', { conversationId: conversation.id });
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
      {item.coverImage ? (
        <Image
          source={{ uri: item.coverImage }}
          style={styles.eventCover}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.eventCover, styles.eventCoverFallback]}>
          <Ionicons name="calendar-outline" size={26} color={colors.text.tertiary} />
        </View>
      )}

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
            disabled={updatingEventId === item.id}
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
            disabled={updatingEventId === item.id}
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

          {(item.rsvpStatus === 'going' || item.rsvpStatus === 'interested' || item.hostId === user?.id) ? (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => handleOpenEventChat(item.id)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary.blue} />
              <Text style={styles.chatButtonText}>Open Chat</Text>
            </TouchableOpacity>
          ) : null}
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

      {/* Create Event Banner (for non-Pro users) */}
      {!canCreateEvents && (
        <TouchableOpacity
          style={styles.upgradeBanner}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Ionicons name="calendar" size={20} color={colors.primary.coral} />
          <Text style={styles.upgradeBannerText}>
            Upgrade to Pro to create your own events
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      <View style={styles.tabs}>
        <PillTabs
          items={[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'my-events', label: 'My Events', count: myEvents.length },
          ]}
          activeId={activeTab}
          onChange={(value) => setActiveTab(value as 'upcoming' | 'my-events')}
        />
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
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary.blue} />
              <Text style={styles.emptyTitle}>Loading events...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name={error ? 'alert-circle-outline' : 'calendar-outline'}
                size={48}
                color={error ? colors.status.error : colors.text.tertiary}
              />
              <Text style={styles.emptyTitle}>
                {error ? 'Unable to Load Events' : 'No Events'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? error
                  : activeTab === 'my-events'
                    ? 'Events you are going to will appear here'
                    : 'Check back later for new events in your area'}
              </Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadEvents()}>
                <Text style={styles.retryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
};

export const EventsScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="friends_feed"
      modalTitle="Upgrade to View Events"
    >
      <EventsContent />
    </RequirementsGate>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
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
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xs,
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
  eventCoverFallback: {
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.primary.blueSoft,
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
    flexWrap: 'wrap',
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
    backgroundColor: colors.status.successLight,
  },
  rsvpButtonInterested: {
    backgroundColor: colors.status.errorLight,
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
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 110,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.primary.blueSoft,
  },
  chatButtonText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
    fontWeight: '600',
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
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
