import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Avatar, Card, Badge } from '../components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Story {
  id: string;
  user: {
    name: string;
    avatar: string;
    isVerified: boolean;
  };
  isViewed: boolean;
  timestamp: string;
}

interface FeedPost {
  id: string;
  type: 'experience' | 'achievement' | 'event' | 'tip';
  user: {
    name: string;
    avatar: string;
    isVerified: boolean;
  };
  content: string;
  image?: string;
  activity?: string;
  location?: string;
  likes: number;
  comments: number;
  timestamp: string;
  isLiked: boolean;
}

const mockStories: Story[] = [
  { id: '1', user: { name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', isVerified: true }, isViewed: false, timestamp: '2h' },
  { id: '2', user: { name: 'Michael', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', isVerified: true }, isViewed: false, timestamp: '4h' },
  { id: '3', user: { name: 'Emma', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200', isVerified: true }, isViewed: true, timestamp: '6h' },
  { id: '4', user: { name: 'James', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', isVerified: false }, isViewed: true, timestamp: '8h' },
  { id: '5', user: { name: 'Olivia', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', isVerified: true }, isViewed: true, timestamp: '12h' },
];

const mockPosts: FeedPost[] = [
  {
    id: '1',
    type: 'experience',
    user: { name: 'Sarah J.', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', isVerified: true },
    content: 'Had an amazing dinner at The French Laundry with Alex! The truffle pasta was incredible. Love meeting new people through Wingman!',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600',
    activity: 'Dining',
    location: 'San Francisco, CA',
    likes: 124,
    comments: 18,
    timestamp: '2 hours ago',
    isLiked: false,
  },
  {
    id: '2',
    type: 'achievement',
    user: { name: 'Michael C.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', isVerified: true },
    content: 'Just earned my Super Host badge! 50+ successful bookings and counting. Thank you to everyone who trusted me as their companion!',
    likes: 89,
    comments: 23,
    timestamp: '5 hours ago',
    isLiked: true,
  },
  {
    id: '3',
    type: 'event',
    user: { name: 'Wingman Events', avatar: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200', isVerified: true },
    content: 'Join us this Saturday for our Premium Members Mixer! Meet fellow Wingman users, enjoy appetizers, and make new connections in a safe, fun environment.',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600',
    location: 'Downtown Event Center',
    likes: 256,
    comments: 42,
    timestamp: '8 hours ago',
    isLiked: false,
  },
  {
    id: '4',
    type: 'tip',
    user: { name: 'Emma W.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200', isVerified: true },
    content: 'Pro tip: Always meet at public places for your first booking and share your location with a trusted friend. Safety first!',
    likes: 312,
    comments: 15,
    timestamp: '1 day ago',
    isLiked: true,
  },
];

export const ActivityFeedScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState(mockPosts);

  const handleLike = async (postId: string) => {
    await haptics.light();
    setPosts(posts.map(post =>
      post.id === postId
        ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
        : post
    ));
  };

  const handleStoryPress = async (storyId: string) => {
    await haptics.light();
    // Open story viewer
  };

  const getPostTypeIcon = (type: FeedPost['type']) => {
    switch (type) {
      case 'experience': return 'heart';
      case 'achievement': return 'trophy';
      case 'event': return 'calendar';
      case 'tip': return 'bulb';
    }
  };

  const getPostTypeColor = (type: FeedPost['type']) => {
    switch (type) {
      case 'experience': return colors.status.error;
      case 'achievement': return colors.primary.gold;
      case 'event': return colors.primary.blue;
      case 'tip': return colors.status.success;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerTitle}>Activity</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContainer}
        >
          {/* Add Story Button */}
          <TouchableOpacity style={styles.addStoryButton} onPress={() => haptics.medium()}>
            <LinearGradient
              colors={colors.gradients.primary}
              style={styles.addStoryGradient}
            >
              <Ionicons name="add" size={28} color={colors.text.primary} />
            </LinearGradient>
            <Text style={styles.storyName}>Add Story</Text>
          </TouchableOpacity>

          {/* User Stories */}
          {mockStories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.storyItem}
              onPress={() => handleStoryPress(story.id)}
            >
              <LinearGradient
                colors={story.isViewed ? [colors.text.tertiary, colors.text.muted] : colors.gradients.premium}
                style={styles.storyRing}
              >
                <Image source={{ uri: story.user.avatar }} style={styles.storyAvatar} />
              </LinearGradient>
              <Text style={styles.storyName} numberOfLines={1}>{story.user.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Posts */}
        <View style={styles.postsContainer}>
          {posts.map((post) => (
            <Card key={post.id} variant="outlined" style={styles.postCard}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <Avatar
                  source={post.user.avatar}
                  name={post.user.name}
                  size="small"
                  showVerified={post.user.isVerified}
                  verificationLevel={post.user.isVerified ? 'verified' : 'basic'}
                />
                <View style={styles.postUserInfo}>
                  <View style={styles.postUserRow}>
                    <Text style={styles.postUserName}>{post.user.name}</Text>
                    <View style={[styles.postTypeBadge, { backgroundColor: `${getPostTypeColor(post.type)}20` }]}>
                      <Ionicons name={getPostTypeIcon(post.type)} size={12} color={getPostTypeColor(post.type)} />
                    </View>
                  </View>
                  <Text style={styles.postTimestamp}>{post.timestamp}</Text>
                </View>
                <TouchableOpacity onPress={() => haptics.light()}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>

              {/* Post Content */}
              <Text style={styles.postContent}>{post.content}</Text>

              {/* Post Image */}
              {post.image && (
                <Image source={{ uri: post.image }} style={styles.postImage} />
              )}

              {/* Post Meta */}
              {(post.activity || post.location) && (
                <View style={styles.postMeta}>
                  {post.activity && (
                    <View style={styles.postMetaItem}>
                      <Ionicons name="restaurant" size={14} color={colors.text.tertiary} />
                      <Text style={styles.postMetaText}>{post.activity}</Text>
                    </View>
                  )}
                  {post.location && (
                    <View style={styles.postMetaItem}>
                      <Ionicons name="location" size={14} color={colors.text.tertiary} />
                      <Text style={styles.postMetaText}>{post.location}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.postAction}
                  onPress={() => handleLike(post.id)}
                >
                  <Ionicons
                    name={post.isLiked ? 'heart' : 'heart-outline'}
                    size={22}
                    color={post.isLiked ? colors.status.error : colors.text.secondary}
                  />
                  <Text style={[styles.postActionText, post.isLiked && styles.postActionTextActive]}>
                    {post.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.postAction} onPress={() => haptics.light()}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text.secondary} />
                  <Text style={styles.postActionText}>{post.comments}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.postAction} onPress={() => haptics.light()}>
                  <Ionicons name="share-outline" size={22} color={colors.text.secondary} />
                </TouchableOpacity>

                <View style={styles.postActionSpacer} />

                <TouchableOpacity style={styles.postAction} onPress={() => haptics.light()}>
                  <Ionicons name="bookmark-outline" size={22} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 100 }]}
        onPress={() => haptics.medium()}
      >
        <LinearGradient
          colors={colors.gradients.primary}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color={colors.text.primary} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  storiesContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  addStoryButton: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  addStoryGradient: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyItem: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  storyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  storyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: colors.background.primary,
  },
  storyName: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    maxWidth: 72,
    textAlign: 'center',
  },
  postsContainer: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.md,
  },
  postCard: {
    padding: spacing.lg,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  postUserInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  postUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  postUserName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  postTypeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTimestamp: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  postContent: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: spacing.radius.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.background.tertiary,
  },
  postMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  postMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  postMetaText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: spacing.lg,
  },
  postActionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  postActionTextActive: {
    color: colors.status.error,
  },
  postActionSpacer: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    right: spacing.screenPadding,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
