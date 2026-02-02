/**
 * Types for the "Find New Friends" Feature
 *
 * This feature is subscription-gated:
 * - FREE: Browse only, no matching/posting
 * - PLUS: 5 matches/month, 3 groups
 * - PREMIUM: Unlimited matches/groups, can post
 * - ELITE: All Premium + create events + priority matching
 */

// ===========================================
// Friend Profile Types
// ===========================================

export interface FriendProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  age: number;
  location: {
    city: string;
    state?: string;
    country: string;
  };
  interests: string[];
  languages: string[];
  lookingFor: FriendshipGoal[];
  isOnline: boolean;
  lastActive: string;
  verificationLevel: 'basic' | 'verified' | 'premium';
  mutualFriendsCount: number;
  createdAt: string;
}

export type FriendshipGoal =
  | 'casual-hangouts'
  | 'workout-buddy'
  | 'coffee-chats'
  | 'outdoor-activities'
  | 'concerts-events'
  | 'travel-companion'
  | 'study-buddy'
  | 'professional-networking'
  | 'hobby-partner'
  | 'emotional-support';

// ===========================================
// Friend Match Types
// ===========================================

export type MatchAction = 'like' | 'pass' | 'super_like';

export interface FriendMatch {
  id: string;
  userId1: string;
  userId2: string;
  user1Profile: FriendProfile;
  user2Profile: FriendProfile;
  matchedAt: string;
  conversationId?: string;
  status: 'matched' | 'chatting' | 'met_up' | 'friends';
}

export interface MatchSwipe {
  id: string;
  fromUserId: string;
  toUserId: string;
  action: MatchAction;
  createdAt: string;
}

// ===========================================
// Social Feed Types
// ===========================================

export type PostType = 'text' | 'image' | 'event_share' | 'group_share' | 'achievement';

export interface Post {
  id: string;
  authorId: string;
  author: FriendProfile;
  type: PostType;
  content: string;
  imageUrl?: string;
  eventId?: string;
  groupId?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLikedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  author: FriendProfile;
  content: string;
  likesCount: number;
  isLikedByMe: boolean;
  createdAt: string;
}

// ===========================================
// Group Types
// ===========================================

export type GroupCategory =
  | 'sports-fitness'
  | 'music-concerts'
  | 'food-dining'
  | 'outdoor-adventure'
  | 'arts-culture'
  | 'gaming'
  | 'book-club'
  | 'professional'
  | 'travel'
  | 'pets'
  | 'wellness'
  | 'language-exchange'
  | 'photography'
  | 'tech';

export interface Group {
  id: string;
  name: string;
  description: string;
  category: GroupCategory;
  coverImage?: string;
  memberCount: number;
  isPublic: boolean;
  location?: {
    city: string;
    state?: string;
    country: string;
  };
  rules: string[];
  admins: string[];
  isMember: boolean;
  isPendingApproval: boolean;
  createdAt: string;
  lastActivityAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  profile: FriendProfile;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: string;
}

export interface GroupPost extends Post {
  groupId: string;
  isPinned: boolean;
}

// ===========================================
// Event Types
// ===========================================

export type EventCategory =
  | 'meetup'
  | 'activity'
  | 'dinner'
  | 'sports'
  | 'concert'
  | 'movie'
  | 'game-night'
  | 'outdoor'
  | 'workshop'
  | 'party';

export interface FriendEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  hostId: string;
  host: FriendProfile;
  coverImage?: string;
  location: {
    name: string;
    address: string;
    city: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dateTime: string;
  endDateTime?: string;
  maxAttendees?: number;
  currentAttendees: number;
  price?: number;
  isPublic: boolean;
  groupId?: string;
  rsvpStatus?: 'going' | 'interested' | 'not_going';
  attendees: FriendProfile[];
  createdAt: string;
}

export interface EventRSVP {
  id: string;
  eventId: string;
  userId: string;
  status: 'going' | 'interested' | 'not_going';
  createdAt: string;
}

// ===========================================
// Friendship Status Types
// ===========================================

export type FriendshipStatus =
  | 'none'
  | 'pending_sent'
  | 'pending_received'
  | 'friends'
  | 'blocked';

export interface Friendship {
  id: string;
  userId1: string;
  userId2: string;
  status: FriendshipStatus;
  initiatedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ===========================================
// Notification Types (Friends-specific)
// ===========================================

export type FriendsNotificationType =
  | 'new_match'
  | 'match_message'
  | 'group_invite'
  | 'event_invite'
  | 'event_reminder'
  | 'post_like'
  | 'post_comment'
  | 'friend_request'
  | 'friend_accepted';

export interface FriendsNotification {
  id: string;
  userId: string;
  type: FriendsNotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
