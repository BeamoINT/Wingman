import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
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
import type { RootStackParamList, Message } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock messages
const mockMessages: Message[] = [
  {
    id: '1',
    conversationId: '1',
    sender: { id: 'u1', firstName: 'Sarah', lastName: 'J', email: '', isVerified: true, isBackgroundChecked: true, isPremium: true, createdAt: '' },
    content: 'Hey! I saw you booked me for dinner on Friday. Looking forward to it! 🎉',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
  {
    id: '2',
    conversationId: '1',
    sender: { id: 'me', firstName: 'Me', lastName: '', email: '', isVerified: true, isBackgroundChecked: false, isPremium: false, createdAt: '' },
    content: 'Hi Sarah! Yes, I\'m excited too. I was thinking we could try that new Italian place downtown?',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: '3',
    conversationId: '1',
    sender: { id: 'u1', firstName: 'Sarah', lastName: 'J', email: '', isVerified: true, isBackgroundChecked: true, isPremium: true, createdAt: '' },
    content: 'Oh I love Italian food! That sounds perfect. Do they take reservations?',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
  {
    id: '4',
    conversationId: '1',
    sender: { id: 'me', firstName: 'Me', lastName: '', email: '', isVerified: true, isBackgroundChecked: false, isPremium: false, createdAt: '' },
    content: 'Yes! I already made a reservation for 7pm. Is that time good for you?',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '5',
    conversationId: '1',
    sender: { id: 'u1', firstName: 'Sarah', lastName: 'J', email: '', isVerified: true, isBackgroundChecked: true, isPremium: true, createdAt: '' },
    content: '7pm works great! See you then 😊',
    type: 'text',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

export const ChatScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [inputText, setInputText] = useState('');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    await haptics.light();

    const newMessage: Message = {
      id: Date.now().toString(),
      conversationId: '1',
      sender: { id: 'me', firstName: 'Me', lastName: '', email: '', isVerified: true, isBackgroundChecked: false, isPremium: false, createdAt: '' },
      content: inputText.trim(),
      type: 'text',
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages([...messages, newMessage]);
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender.id === 'me';
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender.id !== item.sender.id);

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={styles.avatarSpace}>
            {showAvatar && (
              <Avatar
                source="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
                name={item.sender.firstName}
                size="small"
              />
            )}
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerProfile} onPress={() => haptics.light()}>
          <Avatar
            source="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100"
            name="Sarah Johnson"
            size="small"
            showOnlineStatus
            isOnline={true}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>Sarah J.</Text>
            <Text style={styles.headerStatus}>Online</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => haptics.light()}>
            <Ionicons name="call-outline" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => haptics.light()}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Safety Tip */}
      <View style={styles.safetyTip}>
        <Ionicons name="shield-checkmark" size={14} color={colors.primary.blue} />
        <Text style={styles.safetyTipText}>
          Sarah is verified and background-checked
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <TouchableOpacity style={styles.attachButton} onPress={() => haptics.light()}>
          <Ionicons name="add-circle-outline" size={26} color={colors.text.tertiary} />
        </TouchableOpacity>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={colors.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity style={styles.emojiButton} onPress={() => haptics.light()}>
            <Ionicons name="happy-outline" size={22} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.sendButton, inputText.trim() && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() ? colors.text.primary : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  },
  headerInfo: {
    marginLeft: spacing.sm,
  },
  headerName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  headerStatus: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyTip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  safetyTipText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
  },
  messagesList: {
    padding: spacing.screenPadding,
    gap: spacing.sm,
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
    maxWidth: '75%',
    padding: spacing.md,
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
    color: 'rgba(255, 255, 255, 0.7)',
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
  attachButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
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
  emojiButton: {
    padding: spacing.sm,
    marginRight: -spacing.sm,
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
