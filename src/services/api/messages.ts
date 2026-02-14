/**
 * Messages API Service
 * Handles messaging and conversation operations with Supabase
 */

import { supabase } from '../supabase';
import type { ProfileData } from './profiles';

export interface ConversationData {
  id: string;
  participant_1: string;
  participant_2: string;
  booking_id?: string;
  last_message_at?: string;
  last_message_preview?: string;
  created_at: string;
  participant_1_profile?: ProfileData;
  participant_2_profile?: ProfileData;
  unread_count?: number;
}

export interface MessageData {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: 'text' | 'image' | 'booking_request' | 'system';
  is_read: boolean;
  read_at?: string;
  created_at: string;
  sender?: ProfileData;
}

/**
 * Fetch all conversations for the current user
 */
export async function fetchConversations(): Promise<{ conversations: ConversationData[]; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { conversations: [], error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participant_1_profile:profiles!conversations_participant_1_fkey(*),
        participant_2_profile:profiles!conversations_participant_2_fkey(*)
      `)
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return { conversations: [], error };
    }

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      (data || []).map(async (conv) => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        return { ...conv, unread_count: count || 0 };
      })
    );

    return { conversations: conversationsWithUnread, error: null };
  } catch (err) {
    console.error('Error in fetchConversations:', err);
    return { conversations: [], error: err as Error };
  }
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(conversationId: string): Promise<{ messages: MessageData[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(*)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return { messages: [], error };
    }

    return { messages: data || [], error: null };
  } catch (err) {
    console.error('Error in fetchMessages:', err);
    return { messages: [], error: err as Error };
  }
}

/**
 * Send a message
 */
export async function sendMessage(conversationId: string, content: string, type: MessageData['type'] = 'text'): Promise<{ message: MessageData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { message: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        type,
      })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(*)
      `)
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return { message: null, error };
    }

    return { message: data, error: null };
  } catch (err) {
    console.error('Error in sendMessage:', err);
    return { message: null, error: err as Error };
  }
}

/**
 * Create or get a conversation between two users
 */
export async function getOrCreateConversation(otherUserId: string): Promise<{ conversation: ConversationData | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { conversation: null, error: new Error('Not authenticated') };
    }

    // Check if conversation already exists
    const { data: existing, error: findError } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`)
      .single();

    if (existing) {
      return { conversation: existing, error: null };
    }

    // Create new conversation
    const { data: newConv, error: createError } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: otherUserId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      return { conversation: null, error: createError };
    }

    return { conversation: newConv, error: null };
  } catch (err) {
    console.error('Error in getOrCreateConversation:', err);
    return { conversation: null, error: err as Error };
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(conversationId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in markMessagesAsRead:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: MessageData) => void
): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      async (payload) => {
        // Fetch the full message with sender info
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(*)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          onMessage(data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Get total unread message count
 */
export async function getUnreadCount(): Promise<{ count: number; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { count: 0, error: new Error('Not authenticated') };
    }

    // Get conversations for this user
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

    if (convError || !conversations) {
      return { count: 0, error: convError };
    }

    const conversationIds = conversations.map(c => c.id);

    if (conversationIds.length === 0) {
      return { count: 0, error: null };
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', conversationIds)
      .eq('is_read', false)
      .neq('sender_id', user.id);

    if (error) {
      console.error('Error getting unread count:', error);
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (err) {
    console.error('Error in getUnreadCount:', err);
    return { count: 0, error: err as Error };
  }
}
