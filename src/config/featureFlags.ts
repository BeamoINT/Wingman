import Constants from 'expo-constants';

export interface MessagingFeatureFlags {
  messagesV2Enabled: boolean;
  messagesMediaEnabled: boolean;
  groupEventChatEnabled: boolean;
  encryptedReportEnabled: boolean;
}

export interface FriendsFeatureFlags {
  friendsProModelEnabled: boolean;
  friendsRankedListEnabled: boolean;
  friendsConnectionRequestsEnabled: boolean;
  friendsMatchingV4Enabled: boolean;
  friendsGlobalMetroEnabled: boolean;
  friendsMapboxPickerEnabled: boolean;
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }

  return fallback;
}

function resolveFlag(name: string, fallback: boolean): boolean {
  const extra = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  const extraValue = extra[name];
  const envValue = process.env[`EXPO_PUBLIC_${name.toUpperCase()}`];
  return parseBool(extraValue, parseBool(envValue, fallback));
}

export const messagingFeatureFlags: MessagingFeatureFlags = {
  messagesV2Enabled: resolveFlag('messages_v2_enabled', true),
  messagesMediaEnabled: resolveFlag('messages_media_enabled', true),
  groupEventChatEnabled: resolveFlag('group_event_chat_enabled', true),
  encryptedReportEnabled: resolveFlag('encrypted_report_enabled', true),
};

export const friendsFeatureFlags: FriendsFeatureFlags = {
  friendsProModelEnabled: resolveFlag('friends_pro_model_enabled', true),
  friendsRankedListEnabled: resolveFlag('friends_ranked_list_enabled', true),
  friendsConnectionRequestsEnabled: resolveFlag('friends_connection_requests_enabled', true),
  friendsMatchingV4Enabled: resolveFlag('friends_matching_v4_enabled', true),
  friendsGlobalMetroEnabled: resolveFlag('friends_global_metro_enabled', true),
  friendsMapboxPickerEnabled: resolveFlag('friends_mapbox_picker_enabled', true),
};
