import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, EmptyFeed, Header, InlineBanner, RequirementsGate, ScreenScaffold, SectionHeader } from '../../components';
import { useRequirements } from '../../context/RequirementsContext';
import { useTheme } from '../../context/ThemeContext';
import {
  createSocialFeedPost,
  fetchSocialFeedPosts,
  togglePostLike,
} from '../../services/api/friendsApi';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type { Post } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SocialFeedContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { friendsLimits } = useRequirements();

  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPost = friendsLimits.canPost;

  const loadPosts = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      const { posts: loadedPosts, error: postsError } = await fetchSocialFeedPosts();
      if (postsError) {
        console.error('Error loading feed posts:', postsError);
        setError('Unable to load the social feed right now.');
        setPosts([]);
        return;
      }

      setPosts(loadedPosts);
    } catch (loadError) {
      console.error('Error in loadPosts:', loadError);
      setError('Something went wrong while loading the feed.');
      setPosts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleLikePress = async (postId: string) => {
    await haptics.light();

    const currentPost = posts.find((post) => post.id === postId);
    if (!currentPost) return;

    setPosts((previousPosts) => previousPosts.map((post) => (
      post.id === postId
        ? {
          ...post,
          isLikedByMe: !post.isLikedByMe,
          likesCount: Math.max(0, post.likesCount + (post.isLikedByMe ? -1 : 1)),
        }
        : post
    )));

    const { success, error: likeError } = await togglePostLike(postId, currentPost.isLikedByMe);
    if (!success || likeError) {
      console.error('Error toggling post like:', likeError);
      await loadPosts(true);
      return;
    }

    await loadPosts(true);
  };

  const handleCreatePost = async () => {
    if (!canPost) {
      navigation.navigate('Subscription');
      return;
    }

    if (!newPostText.trim()) return;

    setIsSubmittingPost(true);
    await haptics.medium();

    try {
      const { success, error: createError } = await createSocialFeedPost(newPostText.trim(), 'text');
      if (!success || createError) {
        console.error('Error creating social post:', createError);
        setError(createError?.message || 'Unable to create your post right now.');
        return;
      }

      setNewPostText('');
      setShowComposer(false);
      await loadPosts(true);
    } finally {
      setIsSubmittingPost(false);
    }
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
            {item.author.verificationLevel !== 'basic' ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.accent.primary} />
            ) : null}
          </View>
          <Text style={styles.postTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.postMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.postContent}>{item.content}</Text>

      {item.type === 'event_share' ? (
        <View style={styles.eventPreview}>
          <Ionicons name="calendar" size={16} color={colors.accent.primary} />
          <Text style={styles.eventPreviewText}>Event shared</Text>
        </View>
      ) : null}

      {item.type === 'achievement' ? (
        <View style={styles.achievementBadge}>
          <Ionicons name="trophy" size={16} color={colors.status.warning} />
          <Text style={styles.achievementText}>Achievement unlocked!</Text>
        </View>
      ) : null}

      <View style={styles.postStats}>
        <Text style={styles.statsText}>
          {item.likesCount} likes • {item.commentsCount} comments
        </Text>
      </View>

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionItem} onPress={() => handleLikePress(item.id)}>
          <Ionicons
            name={item.isLikedByMe ? 'heart' : 'heart-outline'}
            size={22}
            color={item.isLikedByMe ? colors.status.error : colors.text.tertiary}
          />
          <Text style={[styles.actionText, item.isLikedByMe && styles.actionTextActive]}>Like</Text>
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
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header
        title="Feed"
        showBack
        onBackPress={handleBackPress}
        rightIcon="create-outline"
        onRightPress={() => {
          if (canPost) {
            setShowComposer((value) => !value);
          } else {
            navigation.navigate('Subscription');
          }
        }}
        transparent
      />

      <View style={styles.innerContent}>
        <SectionHeader title="Social Feed" subtitle="Share updates with your friend network" />

        {showComposer && canPost ? (
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
                style={[
                  styles.postButton,
                  (!newPostText.trim() || isSubmittingPost) && styles.postButtonDisabled,
                ]}
                onPress={() => {
                  void handleCreatePost();
                }}
                disabled={!newPostText.trim() || isSubmittingPost}
              >
                <Text style={styles.postButtonText}>{isSubmittingPost ? 'Posting...' : 'Post'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!canPost ? (
          <InlineBanner
            title="Pro required to post"
            message="Upgrade to Pro to create posts, groups, and events."
            variant="warning"
          />
        ) : null}

        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.feedContent,
            posts.length === 0 && styles.emptyFeedContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                void loadPosts(true);
              }}
              tintColor={colors.accent.primary}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            isLoading
              ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.loadingText}>Loading feed...</Text>
                </View>
              )
              : (
                <EmptyFeed onFindFriends={() => navigation.navigate('FriendMatching')} />
              )
          }
        />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </ScreenScaffold>
  );
};

export const SocialFeedScreen: React.FC = () => {
  return (
    <RequirementsGate feature="friends_feed" modalTitle="Upgrade to View Feed">
      <SocialFeedContent />
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
  composer: {
    backgroundColor: colors.surface.level1,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
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
    backgroundColor: colors.accent.primary,
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
  feedContent: {
    paddingBottom: spacing.massive,
  },
  emptyFeedContent: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 400,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.status.errorLight,
  },
  errorText: {
    ...typography.presets.caption,
    color: colors.status.error,
    flex: 1,
  },
  postCard: {
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
    fontWeight: typography.weights.semibold,
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
    backgroundColor: colors.accent.soft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  eventPreviewText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
  },
  achievementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.status.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.radius.md,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  achievementText: {
    ...typography.presets.caption,
    color: colors.status.warning,
  },
  postStats: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
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
    color: colors.status.error,
  },
  separator: {
    height: spacing.md,
  },
});
