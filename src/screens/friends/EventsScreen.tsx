import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, Header, InlineBanner, PillTabs, RequirementsGate, ScreenScaffold, SectionHeader } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useRequirements } from '../../context/RequirementsContext';
import { useTheme } from '../../context/ThemeContext';
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

const EventsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
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
    void loadEvents();
  }, [loadEvents]);

  const canCreateEvents = friendsLimits.canCreateEvents;
  const myEvents = useMemo(
    () => events.filter((event) => event.rsvpStatus === 'going' || event.hostId === user?.id),
    [events, user?.id],
  );

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

  const formatEventTime = (dateStr: string) => (
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  );

  const renderEvent = ({ item }: { item: FriendEvent }) => (
    <TouchableOpacity style={styles.eventCard} activeOpacity={0.9}>
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.eventCover} resizeMode="cover" />
      ) : (
        <View style={[styles.eventCover, styles.eventCoverFallback]}>
          <Ionicons name="calendar-outline" size={26} color={colors.text.tertiary} />
        </View>
      )}

      <View style={styles.dateOverlay}>
        <Text style={styles.dateDay}>{new Date(item.dateTime).getDate()}</Text>
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
              color={colors.accent.primary}
            />
          </View>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
        </View>

        <View style={styles.eventMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.metaText}>{formatEventDate(item.dateTime)} at {formatEventTime(item.dateTime)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.location.name}</Text>
          </View>
        </View>

        <View style={styles.eventFooter}>
          <View style={styles.hostInfo}>
            <Avatar source={item.host.avatar} name={`${item.host.firstName} ${item.host.lastName}`} size="small" />
            <Text style={styles.hostName}>{item.host.firstName} {item.host.lastName}</Text>
          </View>

          <View style={styles.attendeeInfo}>
            <Ionicons name="people" size={14} color={colors.text.tertiary} />
            <Text style={styles.attendeeText}>
              {item.currentAttendees}{item.maxAttendees ? `/${item.maxAttendees}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.rsvpButtons}>
          <TouchableOpacity
            style={[styles.rsvpButton, item.rsvpStatus === 'going' && styles.rsvpButtonActive]}
            onPress={() => {
              void handleRSVP(item.id, 'going');
            }}
            disabled={updatingEventId === item.id}
          >
            <Ionicons
              name={item.rsvpStatus === 'going' ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={16}
              color={item.rsvpStatus === 'going' ? colors.status.success : colors.text.tertiary}
            />
            <Text style={[styles.rsvpButtonText, item.rsvpStatus === 'going' && styles.rsvpButtonTextActive]}>
              Going
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rsvpButton, item.rsvpStatus === 'interested' && styles.rsvpButtonInterested]}
            onPress={() => {
              void handleRSVP(item.id, 'interested');
            }}
            disabled={updatingEventId === item.id}
          >
            <Ionicons
              name={item.rsvpStatus === 'interested' ? 'star' : 'star-outline'}
              size={16}
              color={item.rsvpStatus === 'interested' ? colors.status.warning : colors.text.tertiary}
            />
            <Text style={[styles.rsvpButtonText, item.rsvpStatus === 'interested' && styles.rsvpButtonTextInterested]}>
              Interested
            </Text>
          </TouchableOpacity>

          {(item.rsvpStatus === 'going' || item.rsvpStatus === 'interested' || item.hostId === user?.id) ? (
            <TouchableOpacity style={styles.chatButton} onPress={() => {
              void handleOpenEventChat(item.id);
            }}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.accent.primary} />
              <Text style={styles.chatButtonText}>Open Chat</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header
        title="Events"
        showBack
        onBackPress={handleBackPress}
        rightIcon="add-circle-outline"
        onRightPress={handleCreateEvent}
        transparent
      />

      <View style={styles.innerContent}>
        <SectionHeader
          title="Friend Events"
          subtitle="RSVP, chat, and coordinate with your social circle"
        />

        {!canCreateEvents ? (
          <InlineBanner
            title="Upgrade to Pro"
            message="Create and host your own events with Wingman Pro."
            variant="warning"
          />
        ) : null}

        <PillTabs
          items={[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'my-events', label: 'My Events', count: myEvents.length },
          ]}
          activeId={activeTab}
          onChange={(value) => setActiveTab(value as 'upcoming' | 'my-events')}
        />

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
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.emptyTitle}>Loading events...</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name={error ? 'alert-circle-outline' : 'calendar-outline'}
                  size={48}
                  color={error ? colors.status.error : colors.text.tertiary}
                />
                <Text style={styles.emptyTitle}>{error ? 'Unable to Load Events' : 'No Events'}</Text>
                <Text style={styles.emptySubtitle}>
                  {error
                    ? error
                    : activeTab === 'my-events'
                      ? 'Events you are going to will appear here'
                      : 'Check back later for new events in your area'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={() => {
                  void loadEvents();
                }}>
                  <Text style={styles.retryButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </View>
    </ScreenScaffold>
  );
};

export const EventsScreen: React.FC = () => {
  return (
    <RequirementsGate feature="friends_feed" modalTitle="Upgrade to View Events">
      <EventsContent />
    </RequirementsGate>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.level0,
  },
  innerContent: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.massive,
  },
  eventCard: {
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  eventCover: {
    width: '100%',
    height: 140,
  },
  eventCoverFallback: {
    backgroundColor: colors.surface.level2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateOverlay: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.surface.level0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
    backgroundColor: colors.accent.soft,
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
    backgroundColor: colors.surface.level2,
  },
  rsvpButtonActive: {
    backgroundColor: colors.status.successLight,
  },
  rsvpButtonInterested: {
    backgroundColor: colors.status.warningLight,
  },
  rsvpButtonText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontWeight: typography.weights.semibold,
  },
  rsvpButtonTextActive: {
    color: colors.status.success,
  },
  rsvpButtonTextInterested: {
    color: colors.status.warning,
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
    backgroundColor: colors.accent.soft,
  },
  chatButtonText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
    fontWeight: typography.weights.semibold,
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
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
