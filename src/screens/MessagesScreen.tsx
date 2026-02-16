import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, InlineBanner } from '../components';
import { useAuth } from '../context/AuthContext';
import { useIsConnected } from '../context/NetworkContext';
import type { ConversationData } from '../services/api/messages';
import { fetchConversations } from '../services/api/messages';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Conversation, RootStackParamList, User } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function transformConversationData(data: ConversationData, currentUserId: string): Conversation {
  const kind = data.kind || 'direct';
  const isDirect = kind === 'direct';
  const isParticipantOneCurrent = data.participant_1 === currentUserId;
  const otherProfile = isParticipantOneCurrent
    ? data.participant_2_profile
    : data.participant_1_profile;
  const otherParticipantId = isParticipantOneCurrent
    ? data.participant_2
    : data.participant_1;

  const participant: User = isDirect
    ? {
      id: otherProfile?.id || otherParticipantId || '',
      firstName: otherProfile?.first_name || 'User',
      lastName: otherProfile?.last_name || '',
      email: otherProfile?.email || '',
      avatar: otherProfile?.avatar_url || undefined,
      isVerified: (
        !!otherProfile?.id_verified
        || otherProfile?.verification_level === 'verified'
        || otherProfile?.verification_level === 'premium'
      ),
      isPremium: (otherProfile?.subscription_tier || 'free') !== 'free',
      createdAt: otherProfile?.created_at || data.created_at,
    }
    : {
      id: data.id,
      firstName: data.title || (kind === 'group' ? 'Group Chat' : 'Event Chat'),
      lastName: '',
      email: '',
      avatar: data.avatar_url || undefined,
      isVerified: true,
      isPremium: false,
      createdAt: data.created_at,
    };

  return {
    id: data.id,
    kind,
    title: data.title,
    avatarUrl: data.avatar_url,
    memberCount: data.member_count,
    groupId: data.group_id,
    eventId: data.event_id,
    participants: [participant],
    lastMessage: data.last_message_preview
      ? {
        id: `${data.id}-preview`,
        conversationId: data.id,
        sender: participant,
        content: data.last_message_preview,
        type: 'text',
        isRead: toNumber(data.unread_count, 0) === 0,
        createdAt: data.last_message_at || data.created_at,
      }
      : undefined,
    unreadCount: Math.max(0, Math.round(toNumber(data.unread_count, 0))),
    createdAt: data.created_at,
    updatedAt: data.last_message_at || data.created_at,
  };
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isConnected = useIsConnected();

  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const { conversations: data, error: apiError } = await fetchConversations();

      if (apiError) {
        setError(apiError.message || 'Failed to load messages');
        console.error('Error loading conversations:', apiError);
        setConversations([]);
      } else {
        const transformed = data.map((conversation) =>
          transformConversationData(conversation, user?.id || '')
        );
        setConversations(transformed);
      }
    } catch (err) {
      setError('Something went wrong while loading messages.');
      console.error('Error in loadConversations:', err);
      setConversations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const participant = conversation.participants[0];
      const displayName = (conversation.kind === 'direct'
        ? `${participant?.firstName || ''} ${participant?.lastName || ''}`.trim()
        : conversation.title || participant?.firstName || ''
      ).toLowerCase();
      const lastMessage = (conversation.lastMessage?.content || '').toLowerCase();

      return displayName.includes(query) || lastMessage.includes(query);
    });
  }, [conversations, searchQuery]);

  const handleConversationPress = useCallback(async (conversationId: string) => {
    await haptics.light();
    navigation.navigate('Chat', { conversationId });
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    loadConversations(true);
  }, [loadConversations]);

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const participant = item.participants[0];
    const hasUnread = item.unreadCount > 0;
    const contextLabel = item.kind === 'group' ? 'Group' : item.kind === 'event' ? 'Event' : null;
    const displayName = item.kind === 'direct'
      ? `${participant?.firstName || 'User'} ${participant?.lastName || ''}`.trim()
      : item.title || participant?.firstName || 'Chat';

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => handleConversationPress(item.id)}
        activeOpacity={0.75}
      >
        <Avatar
          source={participant?.avatar || item.avatarUrl}
          name={displayName}
          size="medium"
          showVerified={item.kind === 'direct'}
          verificationLevel={participant?.isPremium ? 'premium' : participant?.isVerified ? 'verified' : 'basic'}
        />

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <View style={styles.nameRow}>
              <Text style={[styles.participantName, hasUnread && styles.unreadName]} numberOfLines={1}>
                {displayName}
              </Text>
              {contextLabel ? (
                <View style={styles.contextBadge}>
                  <Text style={styles.contextBadgeText}>{contextLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.timeText, hasUnread && styles.unreadTime]}>
              {formatRelativeTime(item.updatedAt)}
            </Text>
          </View>

          <View style={styles.messageRow}>
            <Text
              style={[styles.messagePreview, hasUnread && styles.unreadMessage]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'No messages yet'}
            </Text>

            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyOrError = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn’t Load Messages"
            message={error}
            actionLabel="Try Again"
            onAction={() => loadConversations()}
          />
        </View>
      );
    }

    return (
      <View style={styles.centerState}>
        <EmptyState
          icon={searchQuery.trim() ? 'search-outline' : 'chatbubbles-outline'}
          title={searchQuery.trim() ? 'No Conversations Found' : 'No Messages Yet'}
          message={searchQuery.trim()
            ? 'Try a different name or message search.'
            : 'Conversations will appear here after you message a wingman.'}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Messages</Text>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations"
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!searchQuery.trim() && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.trustNote}>
          <Ionicons name="lock-closed" size={14} color={colors.status.success} />
          <Text style={styles.trustNoteText}>
            End-to-end encrypted: only you and the person you're messaging can read these chats.
            {' '}Wingman cannot read message content.
          </Text>
        </View>
        {!isConnected ? (
          <InlineBanner
            title="You're offline"
            message="Recent messages may be stale and new sends are paused until you reconnect."
            variant="warning"
          />
        ) : null}
      </View>

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        ListEmptyComponent={renderEmptyOrError}
        contentContainerStyle={[
          styles.listContent,
          filteredConversations.length === 0 && styles.emptyContent,
        ]}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        )}
        showsVerticalScrollIndicator={false}
      />
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
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  trustNote: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustNoteText: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 110,
  },
  emptyContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing.md,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  participantName: {
    ...typography.presets.h4,
    color: colors.text.primary,
    flex: 1,
  },
  contextBadge: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  contextBadgeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontSize: 10,
    fontWeight: '600',
  },
  unreadName: {
    fontWeight: typography.weights.semibold,
  },
  timeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  unreadTime: {
    color: colors.primary.blue,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  messagePreview: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    flex: 1,
  },
  unreadMessage: {
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
    fontSize: 11,
  },
});
