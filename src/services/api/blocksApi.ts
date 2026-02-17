import { supabase } from '../supabase';

type RawRecord = Record<string, unknown>;

type QueryError = {
  code?: string | null;
  message?: string | null;
};

export interface BlockedUserData {
  blocked_user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  blocked_at: string;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeBlockedUser(row: RawRecord): BlockedUserData {
  return {
    blocked_user_id: toStringValue(row.blocked_user_id),
    first_name: toStringValue(row.first_name, 'User'),
    last_name: toStringValue(row.last_name),
    avatar_url: toOptionalString(row.avatar_url),
    blocked_at: toStringValue(row.blocked_at, new Date().toISOString()),
  };
}

function toFriendlyError(error: unknown, fallback: string): Error {
  const queryError = error as QueryError | null | undefined;
  const message = toStringValue(queryError?.message, '').trim();
  return new Error(message || fallback);
}

async function getCurrentUserId(): Promise<{ userId: string | null; error: Error | null }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { userId: null, error: toFriendlyError(error, 'Authentication failed') };
  }

  if (!user?.id) {
    return { userId: null, error: new Error('Not authenticated') };
  }

  return { userId: user.id, error: null };
}

export function isBlockInteractionError(error: unknown): boolean {
  const typedError = error as QueryError | Error | null | undefined;
  const message = toStringValue((typedError as QueryError)?.message || (typedError as Error)?.message, '').toLowerCase();

  return (
    message.includes('conversation unavailable')
    || message.includes('blocked')
    || message.includes('access denied')
    || message.includes('row-level security')
  );
}

export async function blockUser(
  targetUserId: string,
  reason?: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!targetUserId) {
      return { success: false, error: new Error('Invalid target user') };
    }

    const { error } = await supabase.rpc('block_user_v1', {
      p_target_user_id: targetUserId,
      p_reason: reason ?? null,
    });

    if (error) {
      return {
        success: false,
        error: toFriendlyError(error, 'Unable to complete this action right now.'),
      };
    }

    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error
        : new Error('Unable to complete this action right now.'),
    };
  }
}

export async function unblockUser(
  targetUserId: string,
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!targetUserId) {
      return { success: false, error: new Error('Invalid target user') };
    }

    const { data, error } = await supabase.rpc('unblock_user_v1', {
      p_target_user_id: targetUserId,
    });

    if (error) {
      return {
        success: false,
        error: toFriendlyError(error, 'Unable to unblock this user right now.'),
      };
    }

    return {
      success: data === true || data === null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error
        ? error
        : new Error('Unable to unblock this user right now.'),
    };
  }
}

export async function fetchBlockedUsers(
  limit = 100,
  offset = 0,
): Promise<{ blockedUsers: BlockedUserData[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc('list_blocked_users_v1', {
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      return {
        blockedUsers: [],
        error: toFriendlyError(error, 'Unable to load blocked users right now.'),
      };
    }

    const rows = Array.isArray(data) ? data : [];
    return {
      blockedUsers: rows
        .filter((row): row is RawRecord => !!row && typeof row === 'object')
        .map((row) => normalizeBlockedUser(row)),
      error: null,
    };
  } catch (error) {
    return {
      blockedUsers: [],
      error: error instanceof Error
        ? error
        : new Error('Unable to load blocked users right now.'),
    };
  }
}

export async function hasBlockedUser(
  targetUserId: string,
): Promise<{ blocked: boolean; error: Error | null }> {
  try {
    const { userId, error: authError } = await getCurrentUserId();
    if (authError || !userId) {
      return { blocked: false, error: authError || new Error('Not authenticated') };
    }

    if (!targetUserId || targetUserId === userId) {
      return { blocked: false, error: null };
    }

    const { data, error } = await supabase
      .from('friend_blocks')
      .select('id')
      .eq('blocker_id', userId)
      .eq('blocked_id', targetUserId)
      .maybeSingle();

    if (error) {
      return {
        blocked: false,
        error: toFriendlyError(error, 'Unable to check block status right now.'),
      };
    }

    return { blocked: !!data, error: null };
  } catch (error) {
    return {
      blocked: false,
      error: error instanceof Error
        ? error
        : new Error('Unable to check block status right now.'),
    };
  }
}
