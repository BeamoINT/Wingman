import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Avatar } from '../components';
import { useAuth } from '../context/AuthContext';
import { fetchConversations } from '../services/api/messages';
import type { ConversationData } from '../services/api/messages';
import type { RootStackParamList, Conversation, User } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Transform API conversation data to our Conversation type
 */
function transformConversationData(data: ConversationData, currentUserId: string): Conversation {
  // Get the other participant (not the current user)
  const otherProfile = data.participant_1 === currentUserId
    ? data.participant_2_profile
    : data.participant_1_profile;

  const participant: User = {
    id: otherProfile?.id || '',
    firstName: otherProfile?.first_name || 'Unknown',
    lastName: otherProfile?.last_name || '',
    email: otherProfile?.email || '',
    avatar: otherProfile?.avatar_url,
    isVerified: otherProfile?.phone_verified || false,
    isPremium: otherProfile?.subscription_tier !== 'free',
    createdAt: otherProfile?.created_at || data.created_at,
  };

  return {
    id: data.id,
    participants: [participant],
    lastMessage: data.last_message_preview ? {
      id: 'preview',
      conversationId: data.id,
      sender: participant,
      content: data.last_message_preview,
      type: 'text',
      isRead: data.unread_count === 0,
      createdAt: data.last_message_at || data.created_at,
    } : undefined,
    unreadCount: data.unread_count || 0,
    createdAt: data.created_at,
    updatedAt: data.last_message_at || data.created_at,
  };
}

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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
        setError('Failed to load messages');
        console.error('Error loading conversations:', apiError);
      } else {
        const transformed = data.map(conv =>
          transformConversationData(conv, user?.id || '')
        );
        setConversations(transformed);
      }
    } catch (err) {
      setError('Something went wrong');
      console.error('Error in loadConversations:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handleConversationPress = async (conversationId: string) => {
    await haptics.light();
    navigation.navigate('Chat', { conversationId });
  };

  const handleRefresh = () => {
    loadConversations(true);
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery.trim()) return true;
    const participant = conversation.participants[0];
    const name = `${participant.firstName} ${participant.lastName}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadConversations()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (filteredConversations.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No conversations found' : 'No messages yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try a different search term'
              : 'Start a conversation by booking a companion'}
          </Text>
        </View>
      );
    }

    return filteredConversations.map((conversation) => {
      const participant = conversation.participants[0];
      const hasUnread = conversation.unreadCount > 0;

      return (
        <TouchableOpacity
          key={conversation.id}
          style={styles.conversationItem}
          onPress={() => handleConversationPress(conversation.id)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Avatar
              source={participant.avatar}
              name={participant.firstName}
              size="medium"
              showOnlineStatus={false}
            />
          </View>

          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={[styles.participantName, hasUnread && styles.unreadName]}>
                {participant.firstName} {participant.lastName}
              </Text>
              <Text style={[styles.timeText, hasUnread && styles.unreadTime]}>
                {formatTime(conversation.updatedAt)}
              </Text>
            </View>
            <View style={styles.messagePreview}>
              <Text
                style={[styles.messageText, hasUnread && styles.unreadMessage]}
                numberOfLines={1}
              >
                {conversation.lastMessage?.content || 'No messages yet'}
              </Text>
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Messages</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        }
      >
        {renderContent()}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  errorText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
  },
  retryText: {
    ...typography.presets.button,
    color: colors.text.primary,
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
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  avatarContainer: {
    marginRight: spacing.md,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  participantName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  unreadName: {
    color: colors.text.primary,
  },
  timeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  unreadTime: {
    color: colors.primary.blue,
  },
  messagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    flex: 1,
  },
  unreadMessage: {
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary.blue,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: spacing.sm,
  },
  unreadCount: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontWeight: typography.weights.bold,
    fontSize: 11,
  },
});
