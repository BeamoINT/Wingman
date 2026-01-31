import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Avatar } from '../components';
import type { RootStackParamList, Conversation, Message, User } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock data
const mockConversations: Conversation[] = [
  {
    id: '1',
    participants: [
      {
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
    ],
    lastMessage: {
      id: 'm1',
      conversationId: '1',
      sender: {} as User,
      content: 'Looking forward to dinner tomorrow! 🍝',
      type: 'text',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 mins ago
    },
    unreadCount: 2,
    createdAt: '',
    updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    participants: [
      {
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
    ],
    lastMessage: {
      id: 'm2',
      conversationId: '2',
      sender: {} as User,
      content: 'Thanks for the great coffee chat! Let me know if you want to do it again.',
      type: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    unreadCount: 0,
    createdAt: '',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    participants: [
      {
        id: 'u3',
        firstName: 'Emma',
        lastName: 'Wilson',
        email: 'emma@example.com',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        isVerified: true,
        isBackgroundChecked: true,
        isPremium: true,
        createdAt: '2024-02-01',
      },
    ],
    lastMessage: {
      id: 'm3',
      conversationId: '3',
      sender: {} as User,
      content: 'The concert was amazing! Thank you for suggesting it.',
      type: 'text',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    },
    unreadCount: 0,
    createdAt: '',
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export const MessagesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const handleConversationPress = async (conversationId: string) => {
    await haptics.light();
    navigation.navigate('Chat', { conversationId });
  };

  const formatTime = (dateStr: string) => {
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
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {mockConversations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a conversation by booking a companion
            </Text>
          </View>
        ) : (
          mockConversations.map((conversation) => {
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
                    showOnlineStatus
                    isOnline={participant.id === 'u1'}
                  />
                </View>

                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={[styles.participantName, hasUnread && styles.unreadName]}>
                      {participant.firstName}
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
                      {conversation.lastMessage?.content}
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
          })
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
