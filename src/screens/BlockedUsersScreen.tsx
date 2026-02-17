import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  EmptyState,
  Header,
  ScreenScaffold,
} from '../components';
import { useTheme } from '../context/ThemeContext';
import type { BlockedUserData } from '../services/api/blocksApi';
import { fetchBlockedUsers, unblockUser } from '../services/api/blocksApi';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatBlockedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Blocked recently';
  }

  return `Blocked ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

export const BlockedUsersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles(createStyles);

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const { blockedUsers: rows, error: blockedError } = await fetchBlockedUsers();
      if (blockedError) {
        setError(blockedError.message || 'Unable to load blocked users right now.');
        setBlockedUsers([]);
        return;
      }

      setBlockedUsers(rows);
    } catch (loadError) {
      console.error('Error loading blocked users:', loadError);
      setError('Unable to load blocked users right now.');
      setBlockedUsers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadBlockedUsers();
    }, [loadBlockedUsers]),
  );

  const handleBackPress = useCallback(async () => {
    await haptics.light();
    navigation.goBack();
  }, [navigation]);

  const handleUnblock = useCallback((item: BlockedUserData) => {
    const name = `${item.first_name} ${item.last_name}`.trim() || 'this user';

    Alert.alert(
      'Unblock User',
      `Unblock ${name}? They may become visible to you again in Discover, chats, and other surfaces.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyUserId(item.blocked_user_id);
              await haptics.selection();

              const { success, error: unblockError } = await unblockUser(item.blocked_user_id);
              if (!success || unblockError) {
                setError(unblockError?.message || 'Unable to unblock this user right now.');
                setBusyUserId(null);
                return;
              }

              setBlockedUsers((previous) => previous.filter((entry) => entry.blocked_user_id !== item.blocked_user_id));
              setBusyUserId(null);
            })();
          },
        },
      ],
    );
  }, []);

  const renderBlockedUser = ({ item }: { item: BlockedUserData }) => {
    const name = `${item.first_name} ${item.last_name}`.trim() || 'User';
    const isBusy = busyUserId === item.blocked_user_id;

    return (
      <View style={styles.userRow}>
        <View style={styles.userLeft}>
          <Avatar source={item.avatar_url} name={name} size="medium" />
          <View style={styles.userMeta}>
            <Text style={styles.userName}>{name}</Text>
            <Text style={styles.userSubtitle}>{formatBlockedDate(item.blocked_at)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.unblockButton, isBusy && styles.unblockButtonDisabled]}
          onPress={() => handleUnblock(item)}
          disabled={isBusy}
        >
          <Ionicons name="refresh" size={14} color={colors.text.primary} />
          <Text style={styles.unblockButtonText}>{isBusy ? 'Updating...' : 'Unblock'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <ScreenScaffold>
        <Header title="Blocked Users" showBack onBackPress={handleBackPress} />
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={colors.accent.primary} />
          <Text style={styles.stateText}>Loading blocked users...</Text>
        </View>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <Header title="Blocked Users" showBack onBackPress={handleBackPress} />

      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.blocked_user_id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            tintColor={colors.accent.primary}
            onRefresh={() => {
              void loadBlockedUsers(true);
            }}
          />
        )}
        ListEmptyComponent={(
          <View style={styles.stateWrap}>
            <EmptyState
              icon={error ? 'alert-circle-outline' : 'ban-outline'}
              title={error ? 'Unable to load blocked users' : 'No blocked users'}
              message={error || 'Users you block will appear here so you can manage them later.'}
              actionLabel="Refresh"
              onAction={() => {
                void loadBlockedUsers(true);
              }}
            />
          </View>
        )}
      />
    </ScreenScaffold>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.massive,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  separator: {
    height: spacing.sm,
  },
  userRow: {
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  userMeta: {
    gap: spacing.xxs,
    flex: 1,
  },
  userName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  userSubtitle: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.full,
  },
  unblockButtonDisabled: {
    opacity: 0.7,
  },
  unblockButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  stateWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  stateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
});
