import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { haptics } from '../../utils/haptics';
import { Avatar, EmptyFeed } from '../../components';
import { useRequirements } from '../../context/RequirementsContext';
import { RequirementsGate } from '../../components/RequirementsGate';
import type { RootStackParamList } from '../../types';
import type { Post, FriendProfile } from '../../types/friends';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Mock posts
const mockPosts: Post[] = [
  {
    id: '1',
    authorId: 'u1',
    author: {
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
    },
    type: 'text',
    content: 'Just had an amazing hike at Twin Peaks! The view was incredible. Anyone want to join next weekend?',
    likesCount: 12,
    commentsCount: 4,
    sharesCount: 2,
    isLikedByMe: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    authorId: 'u2',
    author: {
      id: '2',
      userId: 'u2',
      firstName: 'Jordan',
      lastName: 'M',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      age: 25,
      location: { city: 'San Francisco', state: 'CA', country: 'USA' },
      interests: [],
      languages: [],
      lookingFor: [],
      isOnline: false,
      lastActive: new Date().toISOString(),
      verificationLevel: 'premium',
      mutualFriendsCount: 0,
      createdAt: new Date().toISOString(),
    },
    type: 'event_share',
    content: 'Who is joining me at the food truck festival this Saturday? I heard there is an amazing ramen truck!',
    eventId: 'e1',
    likesCount: 23,
    commentsCount: 8,
    sharesCount: 5,
    isLikedByMe: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    authorId: 'u3',
    author: {
      id: '3',
      userId: 'u3',
      firstName: 'Sam',
      lastName: 'R',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      age: 31,
      location: { city: 'Oakland', state: 'CA', country: 'USA' },
      interests: [],
      languages: [],
      lookingFor: [],
      isOnline: true,
      lastActive: new Date().toISOString(),
      verificationLevel: 'verified',
      mutualFriendsCount: 0,
      createdAt: new Date().toISOString(),
    },
    type: 'achievement',
    content: 'Just finished my first marathon! Thanks to everyone in the Running Buddies group for the support!',
    likesCount: 45,
    commentsCount: 15,
    sharesCount: 3,
    isLikedByMe: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * SocialFeedScreen - Timeline of posts from friends
 * Subscription-gated: Viewing requires Plus, posting requires Premium
 */
const SocialFeedContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { friendsLimits, canUseFriendsFeature } = useRequirements();

  const [posts, setPosts] = useState<Post[]>(mockPosts);
  const [newPostText, setNewPostText] = useState('');
  const [showComposer, setShowComposer] = useState(false);

  const canPost = friendsLimits.canPost;
  const postCheck = canUseFriendsFeature('post');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleLikePress = async (postId: string) => {
    await haptics.light();
    setPosts(posts.map(post =>
      post.id === postId
        ? {
            ...post,
            isLikedByMe: !post.isLikedByMe,
            likesCount: post.isLikedByMe ? post.likesCount - 1 : post.likesCount + 1,
          }
        : post
    ));
  };

  const handleCreatePost = async () => {
    if (!canPost) {
      navigation.navigate('Subscription');
      return;
    }

    if (!newPostText.trim()) return;

    await haptics.medium();
    // In a real app, this would create a post via API
    setNewPostText('');
    setShowComposer(false);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Avatar
          source={item.author.avatar}
          name={`${item.author.firstName} ${item.author.lastName}`}
          size="small"
          showOnlineStatus
          isOnline={item.author.isOnline}
        />
        <View style={styles.postHeaderInfo}>
          <View style={styles.postAuthorRow}>
            <Text style={styles.postAuthorName}>
              {item.author.firstName} {item.author.lastName}
            </Text>
            {item.author.verificationLevel !== 'basic' && (
              <Ionicons name="checkmark-circle" size={14} color={colors.primary.blue} />
            )}
          </View>
          <Text style={styles.postTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.postMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.type === 'event_share' && (
        <View style={styles.eventPreview}>
          <Ionicons name="calendar" size={16} color={colors.primary.blue} />
          <Text style={styles.eventPreviewText}>Event shared</Text>
        </View>
      )}

      {item.type === 'achievement' && (
        <View style={styles.achievementBadge}>
          <Ionicons name="trophy" size={16} color={colors.primary.coral} />
          <Text style={styles.achievementText}>Achievement unlocked!</Text>
        </View>
      )}

      <View style={styles.postStats}>
        <Text style={styles.statsText}>
          {item.likesCount} likes • {item.commentsCount} comments
        </Text>
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => handleLikePress(item.id)}
        >
          <Ionicons
            name={item.isLikedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={item.isLikedByMe ? colors.primary.coral : colors.text.tertiary}
          />
          <Text style={[styles.actionText, item.isLikedByMe && styles.actionTextActive]}>
            Like
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="chatbubble-outline" size={22} color={colors.text.tertiary} />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem}>
          <Ionicons name="share-outline" size={22} color={colors.text.tertiary} />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed</Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => canPost ? setShowComposer(true) : navigation.navigate('Subscription')}
        >
          <Ionicons
            name="create-outline"
            size={24}
            color={canPost ? colors.primary.blue : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Post Composer */}
      {showComposer && canPost && (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.text.tertiary}
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            maxLength={500}
          />
          <View style={styles.composerActions}>
            <TouchableOpacity onPress={() => setShowComposer(false)}>
              <Text style={styles.composerCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postButton, !newPostText.trim() && styles.postButtonDisabled]}
              onPress={handleCreatePost}
              disabled={!newPostText.trim()}
            >
              <Text style={styles.postButtonText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Can't Post Banner */}
      {!canPost && (
        <TouchableOpacity
          style={styles.upgradePrompt}
          onPress={() => navigation.navigate('Subscription')}
        >
          <Ionicons name="lock-closed" size={16} color={colors.primary.coral} />
          <Text style={styles.upgradePromptText}>
            Upgrade to Premium to create posts
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
        </TouchableOpacity>
      )}

      {/* Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.feedContent,
          posts.length === 0 && styles.emptyFeedContent,
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyFeed
            onFindFriends={() => navigation.navigate('FriendMatching')}
          />
        }
      />
    </View>
  );
};

export const SocialFeedScreen: React.FC = () => {
  return (
    <RequirementsGate
      feature="friends_groups"
      modalTitle="Upgrade to View Feed"
    >
      <SocialFeedContent />
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
  headerRight: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    backgroundColor: colors.background.card,
    padding: spacing.md,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    borderRadius: spacing.radius.lg,
  },
  composerInput: {
    ...typography.presets.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  composerCancel: {
    ...typography.presets.body,
    color: colors.text.tertiary,
  },
  postButton: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.full,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background.card,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    borderRadius: spacing.radius.md,
  },
  upgradePromptText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  feedContent: {
    padding: spacing.screenPadding,
  },
  emptyFeedContent: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  postCard: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.md,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  postHeaderInfo: {
    flex: 1,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  postAuthorName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  postTime: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  postMenu: {
    padding: spacing.xs,
  },
  postContent: {
    ...typography.presets.body,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  eventPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  eventPreviewText: {
    ...typography.presets.caption,
    color: colors.primary.blue,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  achievementText: {
    ...typography.presets.caption,
    color: colors.primary.coral,
  },
  postStats: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  statsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  actionText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  actionTextActive: {
    color: colors.primary.coral,
  },
  separator: {
    height: spacing.md,
  },
});
