/**
 * Friends API Service
 *
 * All Friends feature data is backed by Supabase tables.
 */

import type {
  EventCategory,
  FriendConnection,
  FriendConnectionStatus,
  FriendEvent,
  FriendProfile,
  FriendshipGoal,
  Group,
  GroupCategory,
  MatchAction,
  Post,
  PostType,
} from '../../types/friends';
import { friendsFeatureFlags } from '../../config/featureFlags';
import { resolveMetroArea } from './locationApi';
import { trackEvent } from '../monitoring/events';
import { supabase } from '../supabase';

type RawRecord = Record<string, unknown>;

type QueryError = {
  code?: string | null;
  message?: string | null;
};

const FALLBACK_COUNTRY = 'USA';
const PROFILE_PUBLIC_SELECT = [
  'id',
  'first_name',
  'last_name',
  'avatar_url',
  'bio',
  'date_of_birth',
  'verification_level',
  'id_verified',
  'created_at',
  'updated_at',
  'metro_area_id',
  'metro_area_name',
  'metro_city',
  'metro_state',
  'metro_country',
].join(',');

const LEGACY_PROFILE_SELECT = [
  'id',
  'first_name',
  'last_name',
  'avatar_url',
  'bio',
  'date_of_birth',
  'verification_level',
  'id_verified',
  'created_at',
  'updated_at',
].join(',');

const GROUP_CATEGORIES: GroupCategory[] = [
  'sports-fitness',
  'music-concerts',
  'food-dining',
  'outdoor-adventure',
  'arts-culture',
  'gaming',
  'book-club',
  'professional',
  'travel',
  'pets',
  'wellness',
  'language-exchange',
  'photography',
  'tech',
];

const EVENT_CATEGORIES: EventCategory[] = [
  'meetup',
  'activity',
  'dinner',
  'sports',
  'concert',
  'movie',
  'game-night',
  'outdoor',
  'workshop',
  'party',
];

const FRIEND_POST_TYPES: PostType[] = [
  'text',
  'image',
  'event_share',
  'group_share',
  'achievement',
];

const metroResolutionAttemptedForUser = new Set<string>();

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isRelationshipError(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const code = String(typedError?.code || '');
  const message = String(typedError?.message || '').toLowerCase();

  return code.startsWith('PGRST') && (
    message.includes('relationship')
    || message.includes('foreign key')
    || message.includes('schema cache')
  );
}

function isMissingProfilesPublicView(error: unknown): boolean {
  const typedError = error as QueryError | null | undefined;
  const message = String(typedError?.message || '').toLowerCase();
  return message.includes('profiles_public') || message.includes("relation 'profiles_public'");
}

function isMissingRpc(error: unknown, rpcName: string): boolean {
  const typedError = error as QueryError | null | undefined;
  const message = String(typedError?.message || '').toLowerCase();
  return message.includes(`function public.${rpcName}`) && message.includes('does not exist');
}

function calculateAge(dateOfBirth?: string): number {
  if (!dateOfBirth) return 18;
  const parsedDate = new Date(dateOfBirth);
  if (Number.isNaN(parsedDate.getTime())) return 18;

  const today = new Date();
  let age = today.getFullYear() - parsedDate.getFullYear();
  const monthDiff = today.getMonth() - parsedDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsedDate.getDate())) {
    age -= 1;
  }

  return Math.max(18, age);
}

function normalizeFriendshipGoals(value: unknown): FriendshipGoal[] {
  if (!Array.isArray(value)) return [];

  return value.filter((goal): goal is FriendshipGoal => (
    typeof goal === 'string'
  )) as FriendshipGoal[];
}

function normalizeTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeProfileVerificationLevel(profile: RawRecord): FriendProfile['verificationLevel'] {
  const level = toStringValue(profile.verification_level, 'basic');
  const idVerified = profile.id_verified === true;

  if (level === 'premium') return 'premium';
  if (level === 'verified' || idVerified) return 'verified';
  return 'basic';
}

function transformProfileToFriendProfile(profileData: unknown): FriendProfile {
  const profile = (profileData || {}) as RawRecord;
  const firstName = toStringValue(profile.first_name, 'User');
  const lastName = toStringValue(profile.last_name, '');
  const metroAreaId = toOptionalString(profile.metro_area_id);
  const metroAreaName = toOptionalString(profile.metro_area_name);
  const metroCity = toOptionalString(profile.metro_city);
  const metroState = toOptionalString(profile.metro_state);
  const metroCountry = toOptionalString(profile.metro_country);
  const fallbackCity = metroAreaName || toStringValue(profile.city, 'Unknown');

  return {
    id: toStringValue(profile.id),
    userId: toStringValue(profile.id),
    firstName,
    lastName,
    avatar: toOptionalString(profile.avatar_url),
    bio: toOptionalString(profile.bio),
    age: calculateAge(toOptionalString(profile.date_of_birth)),
    location: {
      city: fallbackCity,
      state: metroState || toOptionalString(profile.state),
      country: metroCountry || toStringValue(profile.country, FALLBACK_COUNTRY),
      metroAreaId,
      metroAreaName,
      metroCity,
      metroState,
      metroCountry,
    },
    interests: normalizeTextArray(profile.interests),
    languages: normalizeTextArray(profile.languages),
    lookingFor: normalizeFriendshipGoals(profile.looking_for),
    isOnline: false,
    lastActive: toStringValue(profile.updated_at, new Date().toISOString()),
    verificationLevel: normalizeProfileVerificationLevel(profile),
    mutualFriendsCount: 0,
    createdAt: toStringValue(profile.created_at, new Date().toISOString()),
  };
}

function transformRecommendationRowToFriendProfile(rowData: unknown): FriendProfile {
  const row = (rowData || {}) as RawRecord;

  const commonInterests = normalizeTextArray(row.shared_interests);
  const commonLanguages = normalizeTextArray(row.shared_languages);
  const commonGoals = normalizeTextArray(row.shared_goals);

  const metroAreaId = toOptionalString(row.metro_area_id);
  const metroAreaName = toOptionalString(row.metro_area_name);
  const metroCity = toOptionalString(row.metro_city);
  const metroState = toOptionalString(row.metro_state);
  const metroCountry = toOptionalString(row.metro_country);
  const locationLabel = toOptionalString(row.location_label);
  const distanceKm = toNumber(row.distance_km, Number.NaN);

  return {
    id: toStringValue(row.user_id),
    userId: toStringValue(row.user_id),
    firstName: toStringValue(row.first_name, 'User'),
    lastName: toStringValue(row.last_name),
    avatar: toOptionalString(row.avatar_url),
    bio: toOptionalString(row.about),
    age: 18,
    location: {
      city: locationLabel || metroAreaName || 'Unknown',
      state: metroState || undefined,
      country: metroCountry || FALLBACK_COUNTRY,
      metroAreaId,
      metroAreaName,
      metroCity,
      metroState,
      metroCountry,
    },
    interests: [],
    languages: [],
    lookingFor: [],
    isOnline: false,
    lastActive: new Date().toISOString(),
    verificationLevel: 'verified',
    mutualFriendsCount: 0,
    compatibilityScore: toNumber(row.compatibility_score, 0),
    scoringBreakdown: {
      metro: toNumber(row.score_metro, 0),
      interests: toNumber(row.score_interests, 0),
      goals: toNumber(row.score_goals, 0),
      languages: toNumber(row.score_languages, 0),
      recency: toNumber(row.score_recency, 0),
      graph: toNumber(row.score_graph, 0),
      fatiguePenalty: toNumber(row.score_fatigue, 0),
      distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
    },
    commonalities: {
      interests: commonInterests,
      languages: commonLanguages,
      goals: commonGoals,
    },
    createdAt: new Date().toISOString(),
  };
}

function normalizeGroupCategory(category: unknown): GroupCategory {
  const value = toStringValue(category);
  if (GROUP_CATEGORIES.includes(value as GroupCategory)) {
    return value as GroupCategory;
  }

  return 'professional';
}

function normalizeEventCategory(category: unknown): EventCategory {
  const value = toStringValue(category);
  if (EVENT_CATEGORIES.includes(value as EventCategory)) {
    return value as EventCategory;
  }

  return 'meetup';
}

function normalizePostType(type: unknown): PostType {
  const value = toStringValue(type, 'text');
  if (FRIEND_POST_TYPES.includes(value as PostType)) {
    return value as PostType;
  }

  return 'text';
}

function getProfileFromRelation(row: RawRecord, key: string): FriendProfile | null {
  const relation = row[key];
  const relationRecord = Array.isArray(relation) ? relation[0] : relation;

  if (!relationRecord || typeof relationRecord !== 'object') {
    return null;
  }

  return transformProfileToFriendProfile(relationRecord as RawRecord);
}

async function fetchProfilesByIds(userIds: string[]): Promise<Map<string, FriendProfile>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('profiles_public')
    .select(PROFILE_PUBLIC_SELECT)
    .in('id', userIds);

  if (error && isMissingProfilesPublicView(error)) {
    const legacy = await supabase
      .from('profiles')
      .select(LEGACY_PROFILE_SELECT)
      .in('id', userIds);

    if (!legacy.error) {
      const mapped = new Map<string, FriendProfile>();
      (legacy.data || []).forEach((entry) => {
        const profile = transformProfileToFriendProfile(entry as unknown as RawRecord);
        if (profile.id) {
          mapped.set(profile.id, profile);
        }
      });
      return mapped;
    }
  }

  if (error) {
    console.error('Error fetching profiles by IDs:', error);
    return new Map();
  }

  const mapped = new Map<string, FriendProfile>();
  (data || []).forEach((entry) => {
    const profile = transformProfileToFriendProfile(entry as unknown as RawRecord);
    if (profile.id) {
      mapped.set(profile.id, profile);
    }
  });

  return mapped;
}

async function ensureCurrentUserMetroResolved(userId: string): Promise<void> {
  if (!userId || metroResolutionAttemptedForUser.has(userId)) {
    return;
  }

  metroResolutionAttemptedForUser.add(userId);

  const { data, error } = await supabase
    .from('profiles')
    .select('city,state,country,metro_area_id,auto_metro_area_id,metro_resolved_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    trackEvent('location_policy_denied', { source: 'friends_metro_probe' });
    return;
  }

  const city = toStringValue((data as RawRecord | null)?.city);
  const country = toStringValue((data as RawRecord | null)?.country);
  const state = toOptionalString((data as RawRecord | null)?.state);
  const hasMetroArea = (
    Boolean(toOptionalString((data as RawRecord | null)?.metro_area_id))
    || Boolean(toOptionalString((data as RawRecord | null)?.auto_metro_area_id))
  );
  const hasResolvedAt = Boolean(toOptionalString((data as RawRecord | null)?.metro_resolved_at));

  if (hasMetroArea || hasResolvedAt || !city.trim() || !country.trim()) {
    return;
  }

  const resolution = await resolveMetroArea({ city, state, country });
  const payload: Record<string, unknown> = {
    metro_resolved_at: new Date().toISOString(),
  };

  if (resolution.metro) {
    payload.auto_metro_area_id = resolution.metro.metroAreaId;
    payload.metro_area_name = resolution.metro.metroAreaName;
    payload.metro_city = resolution.metro.metroCity;
    payload.metro_state = resolution.metro.metroState;
    payload.metro_country = resolution.metro.metroCountry;
  } else {
    payload.auto_metro_area_id = null;
    payload.metro_area_id = null;
    payload.metro_area_name = null;
    payload.metro_city = null;
    payload.metro_state = null;
    payload.metro_country = null;
  }

  let { error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (updateError) {
    const message = String(updateError.message || '').toLowerCase();
    if (message.includes('auto_metro_area_id')) {
      const legacyPayload = { ...payload };
      delete legacyPayload.auto_metro_area_id;
      const legacyResult = await supabase
        .from('profiles')
        .update(legacyPayload)
        .eq('id', userId);
      updateError = legacyResult.error;
    }
  }

  if (updateError) {
    trackEvent('metro_resolve_failed', { reason: updateError.code || 'profile_update_failed' });
  } else if (
    resolution.resolutionMode === 'metro_match_nearest'
    || resolution.resolutionMode === 'non_metro_city_nearest'
  ) {
    trackEvent('metro_nearest_resolution_used', { source: 'friends_bootstrap' });
  }
}

async function getAuthenticatedUserId(): Promise<{ userId: string | null; error: Error | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { userId: null, error: new Error(error.message || 'Authentication failed') };
  }

  if (!user?.id) {
    return { userId: null, error: new Error('Not authenticated') };
  }

  return { userId: user.id, error: null };
}

export async function fetchMatchingProfiles(limit = 30): Promise<{
  profiles: FriendProfile[];
  error: Error | null;
}> {
  // Legacy compatibility wrapper.
  return fetchRankedFriendProfiles(limit, 0);
}

export async function fetchRankedFriendProfiles(limit = 30, offset = 0): Promise<{
  profiles: FriendProfile[];
  error: Error | null;
}> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { profiles: [], error: authError || new Error('Not authenticated') };
    }

    await ensureCurrentUserMetroResolved(userId);

    const rpcName = (friendsFeatureFlags.friendsMatchingV4Enabled && friendsFeatureFlags.friendsGlobalMetroEnabled)
      ? 'get_friend_recommendations_v4'
      : 'get_friend_recommendations_v3';

    let rpcData: unknown;
    let rpcError: QueryError | null = null;

    const primaryCall = await supabase.rpc(rpcName, {
      p_limit: limit,
      p_offset: offset,
    });
    rpcData = primaryCall.data;
    rpcError = primaryCall.error;

    if (
      rpcError
      && rpcName === 'get_friend_recommendations_v4'
      && (isMissingRpc(rpcError, 'get_friend_recommendations_v4') || !friendsFeatureFlags.friendsRankedListEnabled)
    ) {
      const fallbackCall = await supabase.rpc('get_friend_recommendations_v3', {
        p_limit: limit,
        p_offset: offset,
      });
      rpcData = fallbackCall.data;
      rpcError = fallbackCall.error;
    }

    if (rpcError) {
      if (rpcName === 'get_friend_recommendations_v4') {
        trackEvent('friends_recommendations_v4_failed', { code: rpcError.code || 'unknown' });
      }
      trackEvent('location_data_blocked_read', { source: 'friend_recommendations' });
      return {
        profiles: [],
        error: new Error(rpcError.message || 'Failed to load recommendations'),
      };
    }

    const rows = Array.isArray(rpcData) ? rpcData : [];
    const profiles = rows
      .map((row) => transformRecommendationRowToFriendProfile(row as RawRecord))
      .filter((profile) => !!profile.id);

    if (profiles.length > 0 && rpcName === 'get_friend_recommendations_v4') {
      const impressionIds = profiles
        .map((profile) => profile.userId)
        .filter((id) => id && id !== userId);

      if (impressionIds.length > 0) {
        const { error: impressionError } = await supabase.rpc('record_friend_match_impressions_v1', {
          p_user_ids: impressionIds,
        });

        if (impressionError) {
          // Non-blocking telemetry path.
          trackEvent('friends_recommendations_v4_failed', { code: 'impression_write_failed' });
        }
      }
    }

    return { profiles, error: null };
  } catch (err) {
    console.error('Error in fetchRankedFriendProfiles:', err);
    return {
      profiles: [],
      error: err instanceof Error ? err : new Error('Failed to load matching profiles'),
    };
  }
}

export async function recordMatchSwipe(
  targetUserId: string,
  action: MatchAction
): Promise<{ success: boolean; error: Error | null }> {
  void targetUserId;
  void action;
  // Legacy no-op. Friend connections now use request/accept APIs.
  return { success: true, error: null };
}

function normalizeConnectionStatus(value: unknown): FriendConnectionStatus {
  const status = toStringValue(value, 'pending');
  switch (status) {
    case 'accepted':
    case 'declined':
    case 'canceled':
    case 'blocked':
      return status;
    case 'pending':
    default:
      return 'pending';
  }
}

export async function sendConnectionRequest(targetUserId: string): Promise<{
  success: boolean;
  connectionId: string | null;
  error: Error | null;
}> {
  if (!friendsFeatureFlags.friendsConnectionRequestsEnabled) {
    return {
      success: false,
      connectionId: null,
      error: new Error('Friend connection requests are currently disabled.'),
    };
  }

  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, connectionId: null, error: authError || new Error('Not authenticated') };
    }

    if (!targetUserId || targetUserId === userId) {
      return { success: false, connectionId: null, error: new Error('Invalid target user') };
    }

    const { data, error } = await supabase.rpc('send_connection_request_v1', {
      p_target_user_id: targetUserId,
    });

    if (error) {
      console.error('Error sending connection request:', error);
      return {
        success: false,
        connectionId: null,
        error: new Error(error.message || 'Failed to send connection request'),
      };
    }

    const connectionId = typeof data === 'string'
      ? data
      : Array.isArray(data)
        ? toStringValue((data[0] as RawRecord | undefined)?.send_connection_request_v1)
        : toStringValue((data as RawRecord | null)?.send_connection_request_v1);

    return { success: true, connectionId: connectionId || null, error: null };
  } catch (err) {
    console.error('Error in sendConnectionRequest:', err);
    return {
      success: false,
      connectionId: null,
      error: err instanceof Error ? err : new Error('Failed to send connection request'),
    };
  }
}

export async function respondToConnectionRequest(
  connectionId: string,
  decision: 'accepted' | 'declined' | 'canceled' | 'blocked'
): Promise<{ success: boolean; error: Error | null }> {
  if (!friendsFeatureFlags.friendsConnectionRequestsEnabled) {
    return { success: false, error: new Error('Friend connection requests are currently disabled.') };
  }

  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    const { error } = await supabase.rpc('respond_connection_request_v1', {
      p_connection_id: connectionId,
      p_decision: decision,
    });

    if (error) {
      console.error('Error responding to connection request:', error);
      return { success: false, error: new Error(error.message || 'Failed to update request') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in respondToConnectionRequest:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to update request'),
    };
  }
}

export async function fetchConnectionInbox(): Promise<{
  incoming: FriendConnection[];
  outgoing: FriendConnection[];
  accepted: FriendConnection[];
  error: Error | null;
}> {
  if (!friendsFeatureFlags.friendsConnectionRequestsEnabled) {
    return {
      incoming: [],
      outgoing: [],
      accepted: [],
      error: new Error('Friend connection requests are currently disabled.'),
    };
  }

  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return {
        incoming: [],
        outgoing: [],
        accepted: [],
        error: authError || new Error('Not authenticated'),
      };
    }

    const { data, error } = await supabase
      .from('friend_connections')
      .select('*')
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching connection inbox:', error);
      return {
        incoming: [],
        outgoing: [],
        accepted: [],
        error: new Error(error.message || 'Failed to load connection inbox'),
      };
    }

    const rows = (data || []) as RawRecord[];
    const profileIds = rows
      .map((row) => (
        toStringValue(row.requester_id) === userId
          ? toStringValue(row.recipient_id)
          : toStringValue(row.requester_id)
      ))
      .filter(Boolean);

    const profileMap = await fetchProfilesByIds(profileIds);

    const mapped = rows.map((row) => {
      const requesterId = toStringValue(row.requester_id);
      const recipientId = toStringValue(row.recipient_id);
      const otherUserId = requesterId === userId ? recipientId : requesterId;

      return {
        id: toStringValue(row.id),
        requesterId,
        recipientId,
        status: normalizeConnectionStatus(row.status),
        requestedAt: toStringValue(row.requested_at, new Date().toISOString()),
        respondedAt: toOptionalString(row.responded_at) ?? null,
        otherProfile: profileMap.get(otherUserId),
      } satisfies FriendConnection;
    });

    return {
      incoming: mapped.filter((connection) => (
        connection.status === 'pending' && connection.recipientId === userId
      )),
      outgoing: mapped.filter((connection) => (
        connection.status === 'pending' && connection.requesterId === userId
      )),
      accepted: mapped.filter((connection) => connection.status === 'accepted'),
      error: null,
    };
  } catch (err) {
    console.error('Error in fetchConnectionInbox:', err);
    return {
      incoming: [],
      outgoing: [],
      accepted: [],
      error: err instanceof Error ? err : new Error('Failed to load connection inbox'),
    };
  }
}

export async function fetchSocialFeedPosts(limit = 50): Promise<{
  posts: Post[];
  error: Error | null;
}> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { posts: [], error: authError || new Error('Not authenticated') };
    }

    let rows: RawRecord[] = [];

    const withRelation = await supabase
      .from('friend_posts')
      .select(`
        *,
        author:profiles!friend_posts_author_id_fkey(${PROFILE_PUBLIC_SELECT})
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (withRelation.error && isRelationshipError(withRelation.error)) {
      const fallback = await supabase
        .from('friend_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fallback.error) {
        console.error('Error loading social feed posts:', fallback.error);
        return { posts: [], error: new Error(fallback.error.message || 'Failed to load posts') };
      }

      rows = (fallback.data || []) as RawRecord[];
    } else if (withRelation.error) {
      console.error('Error loading social feed posts:', withRelation.error);
      return { posts: [], error: new Error(withRelation.error.message || 'Failed to load posts') };
    } else {
      rows = (withRelation.data || []) as unknown as RawRecord[];
    }

    const postIds = rows
      .map((row) => toStringValue(row.id))
      .filter(Boolean);

    const authorIds = rows
      .map((row) => toStringValue(row.author_id))
      .filter(Boolean);

    const [profilesById, likesResult, commentsResult, myLikesResult] = await Promise.all([
      fetchProfilesByIds(authorIds),
      postIds.length > 0
        ? supabase
          .from('post_likes')
          .select('post_id')
          .in('post_id', postIds)
        : Promise.resolve({ data: [], error: null } as const),
      postIds.length > 0
        ? supabase
          .from('post_comments')
          .select('post_id')
          .in('post_id', postIds)
        : Promise.resolve({ data: [], error: null } as const),
      postIds.length > 0
        ? supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', postIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (likesResult.error) {
      console.error('Error loading post likes:', likesResult.error);
    }

    if (commentsResult.error) {
      console.error('Error loading post comments:', commentsResult.error);
    }

    if (myLikesResult.error) {
      console.error('Error loading my post likes:', myLikesResult.error);
    }

    const likeCounts = new Map<string, number>();
    (likesResult.data || []).forEach((row) => {
      const postId = toStringValue((row as RawRecord).post_id);
      if (!postId) return;
      likeCounts.set(postId, (likeCounts.get(postId) || 0) + 1);
    });

    const commentCounts = new Map<string, number>();
    (commentsResult.data || []).forEach((row) => {
      const postId = toStringValue((row as RawRecord).post_id);
      if (!postId) return;
      commentCounts.set(postId, (commentCounts.get(postId) || 0) + 1);
    });

    const myLikedPostIds = new Set(
      (myLikesResult.data || []).map((row) => toStringValue((row as RawRecord).post_id)).filter(Boolean)
    );

    const posts = rows.map((row) => {
      const postId = toStringValue(row.id);
      const authorProfile = getProfileFromRelation(row, 'author')
        || profilesById.get(toStringValue(row.author_id))
        || transformProfileToFriendProfile({ id: toStringValue(row.author_id), first_name: 'User', last_name: '' });

      return {
        id: postId,
        authorId: toStringValue(row.author_id),
        author: authorProfile,
        type: normalizePostType(row.type),
        content: toStringValue(row.content),
        imageUrl: toOptionalString(row.image_url),
        likesCount: likeCounts.get(postId) || 0,
        commentsCount: commentCounts.get(postId) || 0,
        sharesCount: 0,
        isLikedByMe: myLikedPostIds.has(postId),
        createdAt: toStringValue(row.created_at, new Date().toISOString()),
        updatedAt: toStringValue(row.updated_at, toStringValue(row.created_at, new Date().toISOString())),
      } satisfies Post;
    });

    return { posts, error: null };
  } catch (err) {
    console.error('Error in fetchSocialFeedPosts:', err);
    return {
      posts: [],
      error: err instanceof Error ? err : new Error('Failed to load posts'),
    };
  }
}

export async function createSocialFeedPost(
  content: string,
  type: PostType = 'text',
  imageUrl?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return { success: false, error: new Error('Post content is required') };
    }

    const dbType = type === 'achievement' ? 'text' : type;

    const { error } = await supabase
      .from('friend_posts')
      .insert({
        author_id: userId,
        content: trimmedContent,
        type: dbType,
        image_url: imageUrl,
      });

    if (error) {
      console.error('Error creating social feed post:', error);
      return { success: false, error: new Error(error.message || 'Failed to create post') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in createSocialFeedPost:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to create post'),
    };
  }
}

export async function togglePostLike(
  postId: string,
  currentlyLiked: boolean
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    if (currentlyLiked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error removing post like:', error);
        return { success: false, error: new Error(error.message || 'Failed to update like') };
      }

      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('post_likes')
      .insert({
        post_id: postId,
        user_id: userId,
      });

    if (error && error.code !== '23505') {
      console.error('Error creating post like:', error);
      return { success: false, error: new Error(error.message || 'Failed to update like') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in togglePostLike:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to update like'),
    };
  }
}

export async function fetchFriendGroups(limit = 60): Promise<{
  groups: Group[];
  error: Error | null;
}> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { groups: [], error: authError || new Error('Not authenticated') };
    }

    const { data: groupsData, error: groupsError } = await supabase
      .from('friend_groups')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (groupsError) {
      console.error('Error loading friend groups:', groupsError);
      return { groups: [], error: new Error(groupsError.message || 'Failed to load groups') };
    }

    const groupsRows = (groupsData || []) as RawRecord[];
    const groupIds = groupsRows
      .map((row) => toStringValue(row.id))
      .filter(Boolean);

    const [allMembershipsResult, myMembershipsResult] = await Promise.all([
      groupIds.length > 0
        ? supabase
          .from('group_memberships')
          .select('group_id')
          .in('group_id', groupIds)
        : Promise.resolve({ data: [], error: null } as const),
      groupIds.length > 0
        ? supabase
          .from('group_memberships')
          .select('group_id')
          .eq('user_id', userId)
          .in('group_id', groupIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (allMembershipsResult.error) {
      console.error('Error loading group memberships:', allMembershipsResult.error);
    }

    if (myMembershipsResult.error) {
      console.error('Error loading my group memberships:', myMembershipsResult.error);
    }

    const memberCounts = new Map<string, number>();
    (allMembershipsResult.data || []).forEach((row) => {
      const groupId = toStringValue((row as RawRecord).group_id);
      if (!groupId) return;
      memberCounts.set(groupId, (memberCounts.get(groupId) || 0) + 1);
    });

    const myGroupIds = new Set(
      (myMembershipsResult.data || []).map((row) => toStringValue((row as RawRecord).group_id)).filter(Boolean)
    );

    const groups = groupsRows.map((row) => {
      const groupId = toStringValue(row.id);

      return {
        id: groupId,
        name: toStringValue(row.name, 'Untitled Group'),
        description: toStringValue(row.description, ''),
        category: normalizeGroupCategory(row.category),
        coverImage: toOptionalString(row.cover_image),
        memberCount: memberCounts.get(groupId) || toNumber(row.member_count, 0),
        isPublic: row.is_public !== false,
        rules: [],
        admins: [],
        isMember: myGroupIds.has(groupId),
        isPendingApproval: false,
        createdAt: toStringValue(row.created_at, new Date().toISOString()),
        lastActivityAt: toStringValue(row.updated_at, toStringValue(row.created_at, new Date().toISOString())),
      } satisfies Group;
    });

    return { groups, error: null };
  } catch (err) {
    console.error('Error in fetchFriendGroups:', err);
    return {
      groups: [],
      error: err instanceof Error ? err : new Error('Failed to load groups'),
    };
  }
}

export async function joinFriendGroup(groupId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('group_memberships')
      .insert({
        group_id: groupId,
        user_id: userId,
      });

    if (error && error.code !== '23505') {
      console.error('Error joining friend group:', error);
      return { success: false, error: new Error(error.message || 'Failed to join group') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in joinFriendGroup:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to join group'),
    };
  }
}

export async function leaveFriendGroup(groupId: string): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('group_memberships')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error leaving friend group:', error);
      return { success: false, error: new Error(error.message || 'Failed to leave group') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in leaveFriendGroup:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to leave group'),
    };
  }
}

export async function fetchFriendEvents(limit = 80): Promise<{
  events: FriendEvent[];
  error: Error | null;
}> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { events: [], error: authError || new Error('Not authenticated') };
    }

    let rows: RawRecord[] = [];

    const withRelation = await supabase
      .from('friend_events')
      .select(`
        *,
        host:profiles!friend_events_host_id_fkey(${PROFILE_PUBLIC_SELECT})
      `)
      .order('date_time', { ascending: true })
      .limit(limit);

    if (withRelation.error && isRelationshipError(withRelation.error)) {
      const fallback = await supabase
        .from('friend_events')
        .select('*')
        .order('date_time', { ascending: true })
        .limit(limit);

      if (fallback.error) {
        console.error('Error loading friend events:', fallback.error);
        return { events: [], error: new Error(fallback.error.message || 'Failed to load events') };
      }

      rows = (fallback.data || []) as RawRecord[];
    } else if (withRelation.error) {
      console.error('Error loading friend events:', withRelation.error);
      return { events: [], error: new Error(withRelation.error.message || 'Failed to load events') };
    } else {
      rows = (withRelation.data || []) as unknown as RawRecord[];
    }

    const eventIds = rows
      .map((row) => toStringValue(row.id))
      .filter(Boolean);

    const hostIds = rows
      .map((row) => toStringValue(row.host_id))
      .filter(Boolean);

    const [profilesById, allRsvpsResult, myRsvpsResult] = await Promise.all([
      fetchProfilesByIds(hostIds),
      eventIds.length > 0
        ? supabase
          .from('event_rsvps')
          .select('event_id,status')
          .in('event_id', eventIds)
        : Promise.resolve({ data: [], error: null } as const),
      eventIds.length > 0
        ? supabase
          .from('event_rsvps')
          .select('event_id,status')
          .eq('user_id', userId)
          .in('event_id', eventIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (allRsvpsResult.error) {
      console.error('Error loading event RSVPs:', allRsvpsResult.error);
    }

    if (myRsvpsResult.error) {
      console.error('Error loading my event RSVPs:', myRsvpsResult.error);
    }

    const attendeeCounts = new Map<string, number>();
    (allRsvpsResult.data || []).forEach((row) => {
      const record = row as RawRecord;
      const eventId = toStringValue(record.event_id);
      const status = toStringValue(record.status, 'going');

      if (!eventId || status !== 'going') return;
      attendeeCounts.set(eventId, (attendeeCounts.get(eventId) || 0) + 1);
    });

    const myRsvpByEvent = new Map<string, 'going' | 'interested' | 'not_going'>();
    (myRsvpsResult.data || []).forEach((row) => {
      const record = row as RawRecord;
      const eventId = toStringValue(record.event_id);
      const status = toStringValue(record.status, 'going');

      if (!eventId) return;
      if (status === 'going' || status === 'interested' || status === 'not_going') {
        myRsvpByEvent.set(eventId, status);
      }
    });

    const events = rows.map((row) => {
      const eventId = toStringValue(row.id);
      const host = getProfileFromRelation(row, 'host')
        || profilesById.get(toStringValue(row.host_id))
        || transformProfileToFriendProfile({ id: toStringValue(row.host_id), first_name: 'Host', last_name: '' });

      return {
        id: eventId,
        title: toStringValue(row.title, 'Untitled Event'),
        description: toStringValue(row.description, ''),
        category: normalizeEventCategory(row.category),
        hostId: toStringValue(row.host_id),
        host,
        coverImage: toOptionalString(row.cover_image),
        location: {
          name: toStringValue(row.location_name, 'Location TBD'),
          address: toStringValue(row.location_address, ''),
          city: toStringValue(row.location_city, 'Unknown'),
        },
        dateTime: toStringValue(row.date_time, new Date().toISOString()),
        endDateTime: toOptionalString(row.end_date_time),
        maxAttendees: toNumber(row.max_attendees, 0) || undefined,
        currentAttendees: attendeeCounts.get(eventId) || toNumber(row.current_attendees, 0),
        price: toNumber(row.price, 0) || undefined,
        isPublic: row.is_public !== false,
        groupId: toOptionalString(row.group_id),
        rsvpStatus: myRsvpByEvent.get(eventId),
        attendees: [],
        createdAt: toStringValue(row.created_at, new Date().toISOString()),
      } satisfies FriendEvent;
    });

    return { events, error: null };
  } catch (err) {
    console.error('Error in fetchFriendEvents:', err);
    return {
      events: [],
      error: err instanceof Error ? err : new Error('Failed to load events'),
    };
  }
}

export async function setEventRsvp(
  eventId: string,
  status: 'going' | 'interested' | 'not_going'
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getAuthenticatedUserId();
    if (authError || !userId) {
      return { success: false, error: authError || new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          status,
        },
        { onConflict: 'event_id,user_id' }
      );

    if (error) {
      console.error('Error setting event RSVP:', error);
      return { success: false, error: new Error(error.message || 'Failed to update RSVP') };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('Error in setEventRsvp:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to update RSVP'),
    };
  }
}
