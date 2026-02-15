import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
    Platform, RefreshControl, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyChat, EmptyState, RequirementsGate } from '../components';
import { useAuth } from '../context/AuthContext';
import type { ConversationData, MessageData } from '../services/api/messages';
import {
    fetchConversationById,
    fetchMessages, markMessagesAsRead, sendMessage, subscribeToMessages
} from '../services/api/messages';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Conversation, Message, RootStackParamList, User } from '../types';
import { haptics } from '../utils/haptics';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function transformConversationData(data: ConversationData, currentUserId: string): Conversation {
  const isParticipantOneCurrent = data.participant_1 === currentUserId;
  const otherProfile = isParticipantOneCurrent
    ? data.participant_2_profile
    : data.participant_1_profile;
  const otherParticipantId = isParticipantOneCurrent
    ? data.participant_2
    : data.participant_1;

  const participant: User = {
    id: otherProfile?.id || otherParticipantId || '',
    firstName: otherProfile?.first_name || 'Wingman',
    lastName: otherProfile?.last_name || '',
    email: otherProfile?.email || '',
    avatar: otherProfile?.avatar_url || undefined,
    isVerified: !!otherProfile?.phone_verified,
    isPremium: (otherProfile?.subscription_tier || 'free') !== 'free',
    createdAt: otherProfile?.created_at || data.created_at,
  };

  return {
    id: data.id,
    participants: [participant],
    lastMessage: data.last_message_preview
      ? {
        id: `${data.id}-preview`,
        conversationId: data.id,
        sender: participant,
        content: data.last_message_preview,
        type: 'text',
        isRead: (data.unread_count || 0) === 0,
        createdAt: data.last_message_at || data.created_at,
      }
      : undefined,
    unreadCount: data.unread_count || 0,
    createdAt: data.created_at,
    updatedAt: data.last_message_at || data.created_at,
  };
}

function transformMessageData(
  data: MessageData,
  currentUserId: string,
  fallbackParticipant?: User
): Message {
  const senderProfile = data.sender;
  const isCurrentUser = data.sender_id === currentUserId;

  let sender: User;

  if (isCurrentUser) {
    sender = {
      id: currentUserId,
      firstName: 'You',
      lastName: '',
      email: '',
      isVerified: true,
      isPremium: false,
      createdAt: data.created_at,
    };
  } else if (senderProfile?.id) {
    sender = {
      id: senderProfile.id,
      firstName: senderProfile.first_name || 'Wingman',
      lastName: senderProfile.last_name || '',
      email: senderProfile.email || '',
      avatar: senderProfile.avatar_url || undefined,
      isVerified: !!senderProfile.phone_verified,
      isPremium: (senderProfile.subscription_tier || 'free') !== 'free',
      createdAt: senderProfile.created_at,
    };
  } else if (fallbackParticipant) {
    sender = fallbackParticipant;
  } else {
    sender = {
      id: data.sender_id || 'unknown',
      firstName: 'User',
      lastName: '',
      email: '',
      isVerified: false,
      isPremium: false,
      createdAt: data.created_at,
    };
  }

  return {
    id: data.id,
    conversationId: data.conversation_id,
    sender,
    content: data.content,
    type: data.type === 'booking_request' ? 'booking-request' : data.type,
    isRead: data.is_read,
    createdAt: data.created_at,
  };
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function sortMessagesByTime(messages: Message[]): Message[] {
  return [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

/**
 * Inner content component for the Chat screen
 */
const ChatScreenContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const flatListRef = useRef<FlatList<Message>>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationId = route.params.conversationId;

  const otherParticipant = useMemo(() => {
    if (!conversation) return null;
    return conversation.participants[0] || null;
  }, [conversation]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 60);
  }, []);

  const loadChatData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [conversationResult, messagesResult] = await Promise.all([
        fetchConversationById(conversationId),
        fetchMessages(conversationId),
      ]);

      if (conversationResult.error || !conversationResult.conversation) {
        setError(conversationResult.error?.message || 'Conversation not found.');
        setConversation(null);
        setMessages([]);
        return;
      }

      const transformedConversation = transformConversationData(
        conversationResult.conversation,
        user?.id || ''
      );
      setConversation(transformedConversation);

      if (messagesResult.error) {
        setError(messagesResult.error.message || 'Unable to load messages.');
        setMessages([]);
        return;
      }

      const transformedMessages = messagesResult.messages.map((message) =>
        transformMessageData(message, user?.id || '', transformedConversation.participants[0])
      );
      setMessages(sortMessagesByTime(transformedMessages));

      await markMessagesAsRead(conversationId);
      scrollToBottom(false);
    } catch (err) {
      setError('Something went wrong while loading this chat.');
      console.error('Error loading chat:', err);
      setConversation(null);
      setMessages([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [conversationId, scrollToBottom, user?.id]);

  useEffect(() => {
    loadChatData();
  }, [loadChatData]);

  useFocusEffect(
    useCallback(() => {
      void markMessagesAsRead(conversationId);
    }, [conversationId])
  );

  useEffect(() => {
    const unsubscribe = subscribeToMessages(conversationId, async (incomingMessage) => {
      const transformed = transformMessageData(
        incomingMessage,
        user?.id || '',
        otherParticipant || undefined
      );

      setMessages((prev) => {
        if (prev.some((message) => message.id === transformed.id)) {
          return prev;
        }
        return sortMessagesByTime([...prev, transformed]);
      });

      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lastMessage: transformed,
          updatedAt: transformed.createdAt,
        };
      });

      if (incomingMessage.sender_id !== (user?.id || '')) {
        await markMessagesAsRead(conversationId);
      }

      scrollToBottom();
    });

    return unsubscribe;
  }, [conversationId, otherParticipant, scrollToBottom, user?.id]);

  const handleBackPress = useCallback(async () => {
    await haptics.light();
    navigation.goBack();
  }, [navigation]);

  const handleRefresh = useCallback(() => {
    loadChatData(true);
  }, [loadChatData]);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setInputText('');

    try {
      await haptics.light();

      const { message, error: sendError } = await sendMessage(conversationId, content, 'text');
      if (sendError || !message) {
        console.error('Error sending message:', sendError);
        setInputText(content);
        Alert.alert('Message Failed', sendError?.message || 'Unable to send message right now.');
        return;
      }

      const transformed = transformMessageData(
        message,
        user?.id || '',
        otherParticipant || undefined
      );

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === transformed.id)) {
          return prev;
        }
        return sortMessagesByTime([...prev, transformed]);
      });

      setConversation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          lastMessage: transformed,
          updatedAt: transformed.createdAt,
        };
      });

      scrollToBottom();
    } finally {
      setIsSending(false);
    }
  }, [conversationId, inputText, isSending, otherParticipant, scrollToBottom, user?.id]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender.id === (user?.id || '');
    const previous = index > 0 ? messages[index - 1] : null;
    const showAvatar = !isMe && (!previous || previous.sender.id !== item.sender.id);

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={styles.avatarSpace}>
            {showAvatar && (
              <Avatar
                source={item.sender.avatar}
                name={`${item.sender.firstName} ${item.sender.lastName}`.trim()}
                size="small"
              />
            )}
          </View>
        )}

        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.stateText}>Loading conversation...</Text>
      </View>
    );
  }

  if (error || !conversation) {
    return (
      <View style={styles.stateScreen}>
        <EmptyState
          icon="alert-circle-outline"
          title="Conversation Unavailable"
          message={error || 'Unable to load this conversation.'}
          actionLabel="Try Again"
          onAction={() => loadChatData()}
          secondaryActionLabel="Back"
          onSecondaryAction={handleBackPress}
        />
      </View>
    );
  }

  const participantName = `${otherParticipant?.firstName || 'Wingman'} ${otherParticipant?.lastName || ''}`.trim();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <Avatar
            source={otherParticipant?.avatar}
            name={participantName}
            size="small"
            showVerified
            verificationLevel={otherParticipant?.isPremium ? 'premium' : otherParticipant?.isVerified ? 'verified' : 'basic'}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{participantName || 'Wingman'}</Text>
            <Text style={styles.headerStatus}>
              {otherParticipant?.isVerified ? 'Verified profile' : 'In-app conversation'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.safetyTip}>
        <Ionicons name="shield-checkmark" size={14} color={colors.primary.blue} />
        <Text style={styles.safetyTipText}>Keep communication in-app for trust and support coverage.</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[
          styles.messagesList,
          messages.length === 0 && styles.emptyMessagesList,
        ]}
        ListEmptyComponent={<EmptyChat companionName={otherParticipant?.firstName || 'Wingman'} />}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        )}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            scrollToBottom(false);
          }
        }}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!isSending}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            inputText.trim() && !isSending && styles.sendButtonActive,
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.text.primary} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? colors.text.primary : colors.text.tertiary}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

/**
 * ChatScreen - Wrapped with RequirementsGate to enforce messaging requirements.
 */
export const ChatScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="send_message"
      modalTitle="Complete Requirements to Message"
    >
      <ChatScreenContent />
    </RequirementsGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  stateScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background.primary,
  },
  stateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginLeft: -spacing.sm,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    gap: spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  headerStatus: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  safetyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  safetyTipText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
  },
  messagesList: {
    padding: spacing.screenPadding,
    gap: spacing.sm,
  },
  emptyMessagesList: {
    flex: 1,
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  avatarSpace: {
    width: 36,
    marginRight: spacing.sm,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.lg,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary.blue,
    borderBottomRightRadius: spacing.radius.xs,
  },
  messageBubbleOther: {
    backgroundColor: colors.background.card,
    borderBottomLeftRadius: spacing.radius.xs,
  },
  messageText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  messageTextMe: {
    color: colors.text.primary,
  },
  messageTime: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    alignSelf: 'flex-end',
    fontSize: 10,
  },
  messageTimeMe: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
    gap: spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.xl,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    maxHeight: 120,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary.blue,
  },
});
