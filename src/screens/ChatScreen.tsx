import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
    Image, Linking, Platform, RefreshControl, StyleSheet, Text, TextInput,
    TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyChat, EmptyState, InlineBanner, MeetupLocationCard, RequirementsGate } from '../components';
import { friendsFeatureFlags } from '../config/featureFlags';
import { supportsNativeMediaCompression } from '../config/runtime';
import { useAuth } from '../context/AuthContext';
import { useIsConnected } from '../context/NetworkContext';
import { getMeetupPlaceDetails, searchMeetupPlaces } from '../services/api/locationApi';
import { blockUser } from '../services/api/blocksApi';
import type { ConversationData, MessageData } from '../services/api/messages';
import {
    fetchConversationById,
    fetchMessages,
    markMessagesAsRead,
    resolveMessageAttachmentUri,
    sendImageMessageV2,
    sendMessage,
    sendVideoMessageV2,
    subscribeToMessages
} from '../services/api/messages';
import {
  listMeetupProposals,
  proposeMeetupLocation,
  respondToMeetupProposal,
  subscribeToMeetupProposals,
} from '../services/api/meetupApi';
import { MediaPickerError, pickImageForMessaging, pickVideoForMessaging } from '../services/media/picker';
import { trackEvent } from '../services/monitoring/events';
import type { PlacePrediction } from '../types/location';
import type {
    Conversation,
    MeetupLocationProposal,
    MeetupResponseAction,
    Message,
    RootStackParamList,
    User,
} from '../types';
import { haptics } from '../utils/haptics';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
      firstName: otherProfile?.first_name || 'Wingman',
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
      isVerified: (
        !!senderProfile.id_verified
        || senderProfile.verification_level === 'verified'
        || senderProfile.verification_level === 'premium'
      ),
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
    messageKind: (data.message_kind || data.type || 'text')
      .replace(/_/g, '-') as Message['messageKind'],
    type: data.type === 'booking_request' ? 'booking-request' : data.type,
    attachments: data.attachments?.map((attachment) => ({
      id: attachment.id,
      mediaKind: attachment.media_kind,
      bucket: attachment.bucket,
      objectPath: attachment.object_path,
      thumbnailObjectPath: attachment.thumbnail_object_path,
      mediaKeyBase64: attachment.media_key_base64,
      mediaNonceBase64: attachment.media_nonce_base64,
      thumbnailKeyBase64: attachment.thumbnail_key_base64,
      thumbnailNonceBase64: attachment.thumbnail_nonce_base64,
      ciphertextSizeBytes: attachment.ciphertext_size_bytes,
      originalSizeBytes: attachment.original_size_bytes,
      durationMs: attachment.duration_ms,
      width: attachment.width,
      height: attachment.height,
      sha256: attachment.sha256,
      decryptedUri: attachment.decrypted_uri,
    })),
    senderDeviceId: data.sender_device_id,
    encryptionVersion: data.ciphertext_version || data.encryption_version,
    replyToMessageId: data.reply_to_message_id,
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

type ChatTimelineItem =
  | {
    kind: 'message';
    key: string;
    createdAt: string;
    message: Message;
  }
  | {
    kind: 'meetup';
    key: string;
    createdAt: string;
    proposal: MeetupLocationProposal;
  };

const MEETUP_SEARCH_DEBOUNCE_MS = 220;

/**
 * Inner content component for the Chat screen
 */
const ChatScreenContent: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<Props['route']>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isConnected = useIsConnected();

  const flatListRef = useRef<FlatList<ChatTimelineItem>>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSendingMedia, setIsSendingMedia] = useState(false);
  const [mediaProgressText, setMediaProgressText] = useState<string | null>(null);
  const [resolvingAttachmentPath, setResolvingAttachmentPath] = useState<string | null>(null);
  const [meetupProposals, setMeetupProposals] = useState<MeetupLocationProposal[]>([]);
  const [isMeetupLoading, setIsMeetupLoading] = useState(false);
  const [isMeetupSubmitting, setIsMeetupSubmitting] = useState(false);
  const [showMeetupComposer, setShowMeetupComposer] = useState(false);
  const [meetupQuery, setMeetupQuery] = useState('');
  const [meetupPredictions, setMeetupPredictions] = useState<PlacePrediction[]>([]);
  const [isSearchingMeetup, setIsSearchingMeetup] = useState(false);
  const [meetupComposerError, setMeetupComposerError] = useState<string | null>(null);
  const [meetupNote, setMeetupNote] = useState('');
  const [selectedMeetupPlace, setSelectedMeetupPlace] = useState<{
    placeId: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [counterFromProposal, setCounterFromProposal] = useState<MeetupLocationProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBlockingParticipant, setIsBlockingParticipant] = useState(false);

  const conversationId = route.params.conversationId;
  const meetupEnabled = friendsFeatureFlags.meetupNegotiationEnabled;

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
    setIsMeetupLoading(true);
    setError(null);

    try {
      const meetupPromise = meetupEnabled
        ? listMeetupProposals({ conversationId })
        : Promise.resolve({ proposals: [], error: null });

      const [conversationResult, messagesResult, meetupResult] = await Promise.all([
        fetchConversationById(conversationId),
        fetchMessages(conversationId),
        meetupPromise,
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

      if (!meetupEnabled || meetupResult.error) {
        setMeetupProposals([]);
      } else {
        setMeetupProposals(meetupResult.proposals);
      }

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
      setIsMeetupLoading(false);
    }
  }, [conversationId, meetupEnabled, scrollToBottom, user?.id]);

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

  useEffect(() => {
    if (!meetupEnabled) {
      setMeetupProposals([]);
      return () => {};
    }

    const unsubscribe = subscribeToMeetupProposals(conversationId, () => {
      void listMeetupProposals({ conversationId }).then((result) => {
        if (!result.error) {
          setMeetupProposals(result.proposals);
          scrollToBottom(false);
        }
      });
    });

    return unsubscribe;
  }, [conversationId, meetupEnabled, scrollToBottom]);

  const handleBackPress = useCallback(async () => {
    await haptics.light();
    navigation.goBack();
  }, [navigation]);

  const handleBlockParticipant = useCallback(() => {
    if ((conversation?.kind || 'direct') !== 'direct' || !otherParticipant?.id || isBlockingParticipant) {
      return;
    }

    const participantDisplayName = `${otherParticipant.firstName || 'this'} ${otherParticipant.lastName || 'user'}`.trim();
    Alert.alert(
      'Block User',
      `Block ${participantDisplayName}? This chat and all other shared surfaces will become unavailable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsBlockingParticipant(true);
              await haptics.warning();

              const { success, error: blockError } = await blockUser(otherParticipant.id);
              setIsBlockingParticipant(false);

              if (!success || blockError) {
                Alert.alert('Unable to Block', 'Unable to complete this action right now.');
                return;
              }

              navigation.goBack();
            })();
          },
        },
      ],
    );
  }, [conversation?.kind, isBlockingParticipant, navigation, otherParticipant?.firstName, otherParticipant?.id, otherParticipant?.lastName]);

  const handleRefresh = useCallback(() => {
    loadChatData(true);
  }, [loadChatData]);

  useEffect(() => {
    const query = meetupQuery.trim();
    if (!showMeetupComposer || query.length < 2) {
      setMeetupPredictions([]);
      setIsSearchingMeetup(false);
      return;
    }

    if (selectedMeetupPlace && query === selectedMeetupPlace.name) {
      setMeetupPredictions([]);
      setIsSearchingMeetup(false);
      return;
    }

    setIsSearchingMeetup(true);
    const timeout = setTimeout(async () => {
      const { predictions, error: searchError } = await searchMeetupPlaces(query);
      if (searchError) {
        setMeetupComposerError(searchError);
        setMeetupPredictions([]);
      } else {
        setMeetupPredictions(predictions);
      }
      setIsSearchingMeetup(false);
    }, MEETUP_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [meetupQuery, selectedMeetupPlace, showMeetupComposer]);

  const resetMeetupComposer = useCallback(() => {
    setMeetupQuery('');
    setMeetupPredictions([]);
    setMeetupComposerError(null);
    setSelectedMeetupPlace(null);
    setMeetupNote('');
    setCounterFromProposal(null);
    setShowMeetupComposer(false);
  }, []);

  const handleSelectMeetupPrediction = useCallback(async (prediction: PlacePrediction) => {
    await haptics.selection();
    setIsMeetupSubmitting(true);
    const { details, error: detailsError } = await getMeetupPlaceDetails(prediction.placeId);
    setIsMeetupSubmitting(false);

    if (detailsError || !details) {
      setMeetupComposerError(detailsError || 'Unable to load location details.');
      return;
    }

    const placeName = details.name || prediction.mainText || prediction.description;
    setSelectedMeetupPlace({
      placeId: details.placeId,
      name: placeName,
      address: details.formattedAddress || prediction.description,
      latitude: details.coordinates?.latitude,
      longitude: details.coordinates?.longitude,
    });
    setMeetupQuery(placeName);
    setMeetupPredictions([]);
    setMeetupComposerError(null);
  }, []);

  const handleOpenMeetupComposer = useCallback(async (proposal?: MeetupLocationProposal) => {
    await haptics.light();
    if (proposal) {
      setCounterFromProposal(proposal);
      setMeetupQuery('');
      setSelectedMeetupPlace(null);
      setMeetupPredictions([]);
      setMeetupComposerError(null);
      setMeetupNote('');
    } else {
      setCounterFromProposal(null);
    }
    setShowMeetupComposer(true);
  }, []);

  const handleSubmitMeetupProposal = useCallback(async () => {
    if (!selectedMeetupPlace?.name) {
      setMeetupComposerError('Select a meetup location before sending.');
      return;
    }

    setIsMeetupSubmitting(true);
    const { proposal, error: proposeError } = await proposeMeetupLocation({
      conversationId,
      bookingId: counterFromProposal?.bookingId,
      placeId: selectedMeetupPlace.placeId,
      placeName: selectedMeetupPlace.name,
      placeAddress: selectedMeetupPlace.address,
      latitude: selectedMeetupPlace.latitude,
      longitude: selectedMeetupPlace.longitude,
      note: meetupNote.trim() || undefined,
      supersedesProposalId: counterFromProposal?.id,
    });
    setIsMeetupSubmitting(false);

    if (proposeError || !proposal) {
      setMeetupComposerError(proposeError?.message || 'Unable to send meetup proposal right now.');
      return;
    }

    trackEvent('meetup_proposal_sent', { hasBookingId: !!proposal.bookingId });
    setMeetupProposals((previous) => {
      const withoutExisting = previous.filter((entry) => entry.id !== proposal.id);
      return [...withoutExisting, proposal].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
    resetMeetupComposer();
    scrollToBottom();
  }, [conversationId, counterFromProposal?.bookingId, counterFromProposal?.id, meetupNote, resetMeetupComposer, scrollToBottom, selectedMeetupPlace]);

  const handleRespondToMeetup = useCallback(async (
    proposal: MeetupLocationProposal,
    action: MeetupResponseAction,
  ) => {
    setIsMeetupSubmitting(true);
    const { success, error: responseError } = await respondToMeetupProposal({
      proposalId: proposal.id,
      action,
    });
    setIsMeetupSubmitting(false);

    if (!success || responseError) {
      Alert.alert('Meetup update failed', responseError?.message || 'Unable to update meetup proposal right now.');
      return;
    }

    if (action === 'accept') trackEvent('meetup_proposal_accepted');
    if (action === 'decline') trackEvent('meetup_proposal_declined');
    if (action === 'counter') trackEvent('meetup_proposal_countered');

    const latest = await listMeetupProposals({ conversationId });
    if (!latest.error) {
      setMeetupProposals(latest.proposals);
      scrollToBottom(false);
    }
  }, [conversationId, scrollToBottom]);

  const handleOpenMeetupInMaps = useCallback(async (proposal: MeetupLocationProposal) => {
    const query = proposal.placeAddress || proposal.placeName;
    if (!query.trim()) {
      return;
    }

    try {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
      await Linking.openURL(mapsUrl);
      trackEvent('meetup_open_maps');
    } catch {
      Alert.alert('Unable to open maps', 'Please try again in a moment.');
    }
  }, []);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content || isSending || isSendingMedia) return;

    setIsSending(true);
    setInputText('');

    try {
      await haptics.light();

      const { message, error: sendError } = await sendMessage(conversationId, content, 'text');
      if (sendError || !message) {
        console.error('Error sending message:', sendError);
        setInputText(content);
        Alert.alert('Message Failed', 'Unable to send message right now.');
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
  }, [conversationId, inputText, isSending, isSendingMedia, otherParticipant, scrollToBottom, user?.id]);

  const handleSendImage = useCallback(async () => {
    if (isSending || isSendingMedia) {
      return;
    }

    try {
      await haptics.light();
      const selected = await pickImageForMessaging();
      setIsSendingMedia(true);
      setMediaProgressText('Compressing and encrypting image...');

      const result = await sendImageMessageV2({
        conversationId,
        localUri: selected.uri,
        caption: inputText.trim() || undefined,
        width: selected.width,
        height: selected.height,
      });

      if (result.error || !result.message) {
        Alert.alert('Image Failed', 'Unable to send image right now.');
        return;
      }

      setInputText('');
      const transformed = transformMessageData(
        result.message,
        user?.id || '',
        otherParticipant || undefined,
      );

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === transformed.id)) {
          return prev;
        }
        return sortMessagesByTime([...prev, transformed]);
      });

      scrollToBottom();
    } catch (error) {
      if (error instanceof MediaPickerError && error.code === 'cancelled') {
        return;
      }
      Alert.alert('Image Failed', error instanceof Error ? error.message : 'Unable to send image right now.');
    } finally {
      setIsSendingMedia(false);
      setMediaProgressText(null);
    }
  }, [conversationId, inputText, isSending, isSendingMedia, otherParticipant, scrollToBottom, user?.id]);

  const handleSendVideo = useCallback(async () => {
    if (isSending || isSendingMedia) {
      return;
    }

    if (!supportsNativeMediaCompression) {
      Alert.alert(
        'Development Build Required',
        'Video messaging needs a development or production build. Expo Go does not support compressed video messaging.',
      );
      return;
    }

    try {
      await haptics.light();
      const selected = await pickVideoForMessaging();
      setIsSendingMedia(true);
      setMediaProgressText('Compressing, encrypting, and uploading video...');

      const result = await sendVideoMessageV2({
        conversationId,
        localUri: selected.uri,
        caption: inputText.trim() || undefined,
        durationMs: selected.durationMs,
        width: selected.width,
        height: selected.height,
      });

      if (result.error || !result.message) {
        Alert.alert('Video Failed', 'Unable to send video right now.');
        return;
      }

      setInputText('');
      const transformed = transformMessageData(
        result.message,
        user?.id || '',
        otherParticipant || undefined,
      );

      setMessages((prev) => {
        if (prev.some((existing) => existing.id === transformed.id)) {
          return prev;
        }
        return sortMessagesByTime([...prev, transformed]);
      });

      scrollToBottom();
    } catch (error) {
      if (error instanceof MediaPickerError && error.code === 'cancelled') {
        return;
      }
      Alert.alert('Video Failed', error instanceof Error ? error.message : 'Unable to send video right now.');
    } finally {
      setIsSendingMedia(false);
      setMediaProgressText(null);
    }
  }, [conversationId, inputText, isSending, isSendingMedia, otherParticipant, scrollToBottom, user?.id]);

  const handleOpenAttachment = useCallback(async (messageId: string, attachmentIndex: number) => {
    const targetMessage = messages.find((message) => message.id === messageId);
    const attachment = targetMessage?.attachments?.[attachmentIndex];
    if (!attachment) {
      return;
    }

    if (attachment.decryptedUri) {
      if (attachment.mediaKind === 'video') {
        await Linking.openURL(attachment.decryptedUri);
      }
      return;
    }

    setResolvingAttachmentPath(attachment.objectPath);
    try {
      const decryptedUri = await resolveMessageAttachmentUri({
        media_kind: attachment.mediaKind,
        bucket: attachment.bucket,
        object_path: attachment.objectPath,
        thumbnail_object_path: attachment.thumbnailObjectPath,
        ciphertext_size_bytes: attachment.ciphertextSizeBytes,
        original_size_bytes: attachment.originalSizeBytes,
        duration_ms: attachment.durationMs,
        width: attachment.width,
        height: attachment.height,
        sha256: attachment.sha256,
        media_key_base64: attachment.mediaKeyBase64,
        media_nonce_base64: attachment.mediaNonceBase64,
      });

      setMessages((previous) => previous.map((message) => {
        if (message.id !== messageId || !message.attachments) {
          return message;
        }

        const updatedAttachments = [...message.attachments];
        updatedAttachments[attachmentIndex] = {
          ...updatedAttachments[attachmentIndex],
          decryptedUri,
        };

        return {
          ...message,
          attachments: updatedAttachments,
        };
      }));

      if (attachment.mediaKind === 'video') {
        await Linking.openURL(decryptedUri);
      }
    } catch (error) {
      Alert.alert('Media Unavailable', error instanceof Error ? error.message : 'Unable to open this media right now.');
    } finally {
      setResolvingAttachmentPath(null);
    }
  }, [messages]);

  const renderMessageBubble = (item: Message) => {
    const isMe = item.sender.id === (user?.id || '');
    const showSenderName = !isMe && conversation?.kind !== 'direct';

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={styles.avatarSpace}>
            <Avatar
              source={item.sender.avatar}
              name={`${item.sender.firstName} ${item.sender.lastName}`.trim()}
              size="small"
            />
          </View>
        )}

        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          {showSenderName ? (
            <Text style={styles.senderNameText}>
              {`${item.sender.firstName || 'User'} ${item.sender.lastName || ''}`.trim()}
            </Text>
          ) : null}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.content}</Text>

          {(item.attachments || []).map((attachment, attachmentIndex) => {
            const isResolving = resolvingAttachmentPath === attachment.objectPath;
            const isImage = attachment.mediaKind === 'image';
            const hasImagePreview = isImage && !!attachment.decryptedUri;

            return (
              <TouchableOpacity
                key={`${item.id}:${attachment.objectPath}:${attachmentIndex}`}
                style={styles.attachmentCard}
                onPress={() => handleOpenAttachment(item.id, attachmentIndex)}
                activeOpacity={0.85}
              >
                {hasImagePreview ? (
                  <Image
                    source={{ uri: attachment.decryptedUri }}
                    style={styles.attachmentImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.attachmentPlaceholder}>
                    <Ionicons
                      name={attachment.mediaKind === 'video' ? 'videocam' : 'image'}
                      size={20}
                      color={isMe ? colors.text.primary : colors.text.secondary}
                    />
                    <Text style={[styles.attachmentLabel, isMe && styles.attachmentLabelMe]}>
                      {isResolving
                        ? 'Decrypting...'
                        : attachment.mediaKind === 'video'
                          ? 'Tap to decrypt video'
                          : 'Tap to decrypt image'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  const timelineItems = useMemo<ChatTimelineItem[]>(() => {
    const messageItems = messages.map((message) => ({
      kind: 'message' as const,
      key: `message:${message.id}`,
      createdAt: message.createdAt,
      message,
    }));

    const meetupItems = meetupEnabled ? meetupProposals.map((proposal) => ({
      kind: 'meetup' as const,
      key: `meetup:${proposal.id}`,
      createdAt: proposal.createdAt,
      proposal,
    })) : [];

    return [...messageItems, ...meetupItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [meetupEnabled, messages, meetupProposals]);

  const renderTimelineItem = ({ item }: { item: ChatTimelineItem }) => {
    if (item.kind === 'message') {
      return renderMessageBubble(item.message);
    }

    const proposal = item.proposal;
    const isCurrentUserProposer = proposal.proposerUserId === (user?.id || '');

    return (
      <View style={[styles.meetupRow, isCurrentUserProposer && styles.meetupRowMe]}>
        <View style={styles.meetupCardWrap}>
          <MeetupLocationCard
            proposal={proposal}
            isCurrentUserProposer={isCurrentUserProposer}
            isBusy={isMeetupSubmitting}
            onOpenMaps={() => {
              void handleOpenMeetupInMaps(proposal);
            }}
            onAccept={() => {
              void handleRespondToMeetup(proposal, 'accept');
            }}
            onDecline={() => {
              void handleRespondToMeetup(proposal, 'decline');
            }}
            onSuggestAlternative={() => {
              void handleOpenMeetupComposer(proposal);
            }}
          />
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

  const conversationKind = conversation.kind || 'direct';
  const participantName = conversationKind === 'direct'
    ? `${otherParticipant?.firstName || 'Wingman'} ${otherParticipant?.lastName || ''}`.trim()
    : conversation.title || (conversationKind === 'group' ? 'Group Chat' : 'Event Chat');
  const headerStatus = conversationKind === 'direct'
    ? (otherParticipant?.isVerified ? 'ID & photo verified' : 'In-app conversation')
    : `${conversation.memberCount || 0} members - ${conversationKind === 'group' ? 'Group' : 'Event'} chat`;
  const isComposerBusy = isSending || isSendingMedia || isMeetupSubmitting;

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
            source={otherParticipant?.avatar || conversation.avatarUrl}
            name={participantName}
            size="small"
            showVerified={conversationKind === 'direct'}
            verificationLevel={otherParticipant?.isPremium ? 'premium' : otherParticipant?.isVerified ? 'verified' : 'basic'}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{participantName || 'Wingman'}</Text>
            <Text style={styles.headerStatus}>{headerStatus}</Text>
          </View>
        </View>

        {conversationKind === 'direct' ? (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleBlockParticipant}
            disabled={isBlockingParticipant}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.text.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.safetyTip}>
        <Ionicons name="lock-closed" size={14} color={colors.primary.blue} />
        <Text style={styles.safetyTipText}>
          End-to-end encrypted: only authorized chat members can read these messages.
          {' '}Wingman cannot access message content.
        </Text>
      </View>
      {!isConnected ? (
        <View style={styles.offlineBannerWrap}>
          <InlineBanner
            title="You're offline"
            message="Message sends and media decrypt will resume automatically when your connection returns."
            variant="warning"
          />
        </View>
      ) : null}

      <FlatList
        ref={flatListRef}
        data={timelineItems}
        keyExtractor={(item) => item.key}
        renderItem={renderTimelineItem}
        contentContainerStyle={[
          styles.messagesList,
          timelineItems.length === 0 && styles.emptyMessagesList,
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
          if (timelineItems.length > 0) {
            scrollToBottom(false);
          }
        }}
        showsVerticalScrollIndicator={false}
      />

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        {meetupEnabled && showMeetupComposer ? (
          <View style={styles.meetupComposer}>
            <View style={styles.meetupComposerHeader}>
              <Text style={styles.meetupComposerTitle}>
                {counterFromProposal ? 'Suggest alternative meetup' : 'Propose meetup location'}
              </Text>
              <TouchableOpacity
                style={styles.meetupComposerClose}
                onPress={resetMeetupComposer}
                disabled={isMeetupSubmitting}
              >
                <Ionicons name="close" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.meetupComposerInput}
              placeholder="Search a place"
              placeholderTextColor={colors.text.tertiary}
              value={meetupQuery}
              onChangeText={(value) => {
                setMeetupQuery(value);
                setSelectedMeetupPlace(null);
              }}
              editable={!isMeetupSubmitting}
            />

            {isSearchingMeetup ? (
              <View style={styles.meetupComposerLoading}>
                <ActivityIndicator size="small" color={colors.accent.primary} />
                <Text style={styles.meetupComposerHint}>Searching places...</Text>
              </View>
            ) : null}

            {meetupPredictions.length > 0 ? (
              <View style={styles.meetupPredictionList}>
                {meetupPredictions.slice(0, 4).map((prediction) => (
                  <TouchableOpacity
                    key={prediction.placeId}
                    style={styles.meetupPredictionRow}
                    onPress={() => {
                      void handleSelectMeetupPrediction(prediction);
                    }}
                    disabled={isMeetupSubmitting}
                  >
                    <Ionicons name="location-outline" size={15} color={colors.text.tertiary} />
                    <View style={styles.meetupPredictionTextWrap}>
                      <Text style={styles.meetupPredictionTitle}>{prediction.mainText}</Text>
                      <Text style={styles.meetupPredictionSubtitle}>{prediction.description}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {selectedMeetupPlace ? (
              <Text style={styles.meetupComposerHint}>
                Selected: {selectedMeetupPlace.name}
                {selectedMeetupPlace.address ? ` - ${selectedMeetupPlace.address}` : ''}
              </Text>
            ) : null}

            <TextInput
              style={styles.meetupComposerInput}
              placeholder="Optional note"
              placeholderTextColor={colors.text.tertiary}
              value={meetupNote}
              onChangeText={setMeetupNote}
              editable={!isMeetupSubmitting}
              maxLength={240}
            />

            {meetupComposerError ? (
              <Text style={styles.meetupComposerError}>{meetupComposerError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.meetupComposerSubmit, isMeetupSubmitting && styles.meetupComposerSubmitDisabled]}
              onPress={() => {
                void handleSubmitMeetupProposal();
              }}
              disabled={isMeetupSubmitting}
            >
              {isMeetupSubmitting ? (
                <ActivityIndicator size="small" color={colors.text.onAccent} />
              ) : (
                <>
                  <Ionicons name="send" size={14} color={colors.text.onAccent} />
                  <Text style={styles.meetupComposerSubmitText}>
                    {counterFromProposal ? 'Send Alternative' : 'Send Proposal'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          {meetupEnabled ? (
            <TouchableOpacity
              style={styles.composeActionButton}
              onPress={() => {
                void handleOpenMeetupComposer();
              }}
              disabled={isComposerBusy}
            >
              <Ionicons name="location-outline" size={20} color={isComposerBusy ? colors.text.tertiary : colors.text.primary} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.composeActionButton}
            onPress={handleSendImage}
            disabled={isComposerBusy}
          >
            <Ionicons name="image" size={20} color={isComposerBusy ? colors.text.tertiary : colors.text.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.composeActionButton}
            onPress={handleSendVideo}
            disabled={isComposerBusy || !supportsNativeMediaCompression}
          >
            <Ionicons
              name="videocam"
              size={20}
              color={(isComposerBusy || !supportsNativeMediaCompression) ? colors.text.tertiary : colors.text.primary}
            />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor={colors.text.tertiary}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={2000}
              editable={!isComposerBusy}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() && !isComposerBusy && styles.sendButtonActive,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isComposerBusy}
          >
            {isComposerBusy ? (
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

        {mediaProgressText ? (
          <Text style={styles.mediaProgressText}>{mediaProgressText}</Text>
        ) : null}
        {meetupEnabled && isMeetupLoading ? (
          <Text style={styles.mediaProgressText}>Syncing meetup proposals...</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};

/**
 * ChatScreen - Wrapped with RequirementsGate to enforce messaging requirements.
 */
export const ChatScreen: React.FC = () => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  return (
    <RequirementsGate
      feature="send_message"
      modalTitle="Complete Requirements to Message"
    >
      <ChatScreenContent />
    </RequirementsGate>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
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
  headerActionButton: {
    width: 36,
    height: 36,
    borderRadius: spacing.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  safetyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.blueSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  safetyTipText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
  },
  offlineBannerWrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
  },
  messagesList: {
    padding: spacing.screenPadding,
    gap: spacing.sm,
  },
  meetupRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.xs,
  },
  meetupRowMe: {
    justifyContent: 'flex-end',
  },
  meetupCardWrap: {
    maxWidth: '86%',
    flex: 1,
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
  senderNameText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.xs / 2,
    fontWeight: typography.weights.semibold,
  },
  attachmentCard: {
    marginTop: spacing.xs,
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  attachmentImage: {
    width: 220,
    height: 150,
    backgroundColor: colors.background.tertiary,
  },
  attachmentPlaceholder: {
    width: 220,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.background.tertiary,
  },
  attachmentLabel: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  attachmentLabelMe: {
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
    color: colors.text.secondary,
  },
  inputContainer: {
    gap: spacing.xs,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.primary,
  },
  meetupComposer: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.surface.level1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  meetupComposerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meetupComposerTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
  meetupComposerClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.level2,
  },
  meetupComposerInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.surface.level0,
    paddingHorizontal: spacing.sm,
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
  meetupComposerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  meetupComposerHint: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  meetupComposerError: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
  meetupComposerSubmit: {
    minHeight: 36,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  meetupComposerSubmitDisabled: {
    opacity: 0.7,
  },
  meetupComposerSubmitText: {
    ...typography.presets.caption,
    color: colors.text.onAccent,
  },
  meetupPredictionList: {
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
  },
  meetupPredictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    backgroundColor: colors.surface.level0,
  },
  meetupPredictionTextWrap: {
    flex: 1,
    gap: spacing.xxs,
  },
  meetupPredictionTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
  },
  meetupPredictionSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composeActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
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
  mediaProgressText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
    paddingLeft: 4,
  },
});
