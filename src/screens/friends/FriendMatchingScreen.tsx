import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Avatar, Header, InlineBanner, ScreenScaffold } from '../../components';
import { useAuth } from '../../context/AuthContext';
import { useRequirements } from '../../context/RequirementsContext';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchRankedFriendProfiles,
  sendConnectionRequest,
} from '../../services/api/friendsApi';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type { FriendProfile } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 20;

const FriendMatchingContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = tokens;
  const { user } = useAuth();
  const { canUseFriendsFeature } = useRequirements();

  const [profiles, setProfiles] = useState<FriendProfile[]>([]);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const isPro = user?.subscriptionTier === 'pro';

  const loadProfiles = useCallback(async (reset = false) => {
    const nextOffset = reset ? 0 : offset;

    if (reset) {
      setIsRefreshing(true);
      setHasMore(true);
    } else if (nextOffset === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    if (!reset) {
      setError(null);
    }

    try {
      const { profiles: loadedProfiles, error: profilesError } = await fetchRankedFriendProfiles(PAGE_SIZE, nextOffset);
      if (profilesError) {
        console.error('Error loading ranked friend profiles:', profilesError);
        setError(profilesError.message || 'Unable to load friend recommendations right now.');
        if (reset) {
          setProfiles([]);
        }
        return;
      }

      setProfiles((prev) => {
        if (reset) return loadedProfiles;
        const existing = new Set(prev.map((profile) => profile.id));
        const merged = [...prev];
        loadedProfiles.forEach((profile) => {
          if (!existing.has(profile.id)) {
            merged.push(profile);
          }
        });
        return merged;
      });
      setOffset(nextOffset + loadedProfiles.length);
      setHasMore(loadedProfiles.length === PAGE_SIZE);
    } catch (loadError) {
      console.error('Error in loadProfiles:', loadError);
      setError('Unable to load friend recommendations right now.');
      if (reset) {
        setProfiles([]);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [offset]);

  useEffect(() => {
    void loadProfiles(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleUpgradePress = async () => {
    await haptics.medium();
    navigation.navigate('Subscription');
  };

  const handleSendRequest = async (profile: FriendProfile) => {
    const access = canUseFriendsFeature('match');
    if (!access.met) {
      navigation.navigate('Subscription');
      return;
    }

    setBusyUserId(profile.userId);
    await haptics.light();
    const { success, error: requestError } = await sendConnectionRequest(profile.userId);

    if (!success || requestError) {
      setError(requestError?.message || 'Unable to send request right now.');
      setBusyUserId(null);
      return;
    }

    setProfiles((previousProfiles) => previousProfiles.filter((entry) => entry.userId !== profile.userId));
    setBusyUserId(null);
  };

  const renderCommonality = (icon: keyof typeof Ionicons.glyphMap, label: string, values: string[]) => {
    if (!values.length) return null;
    return (
      <View style={styles.commonalityRow}>
        <Ionicons name={icon} size={14} color={colors.accent.primary} />
        <Text style={styles.commonalityText}>
          {label}: {values.slice(0, 3).join(', ')}
        </Text>
      </View>
    );
  };

  const renderProfile = ({ item }: { item: FriendProfile }) => {
    const name = `${item.firstName} ${item.lastName}`.trim();
    const metroLabel = item.location.metroAreaName
      || item.location.metroCity
      || item.location.city;
    const locationText = metroLabel
      ? `${metroLabel}${metroLabel.toLowerCase().includes('metro') ? '' : ' Metro'}`
      : 'Location unavailable';
    const score = Math.max(0, Math.min(item.compatibilityScore || 0, 100));
    const isBusy = busyUserId === item.userId;

    return (
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <Avatar source={item.avatar} name={name} size="large" />
          <View style={styles.profileMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{name}</Text>
              {item.verificationLevel !== 'basic' ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.accent.primary} />
              ) : null}
            </View>
            <Text style={styles.locationText}>{locationText}</Text>
            <View style={styles.scorePill}>
              <Ionicons name="sparkles-outline" size={14} color={colors.accent.primary} />
              <Text style={styles.scoreText}>{score}% compatibility</Text>
            </View>
          </View>
        </View>

        <Text style={styles.profileBio} numberOfLines={2}>
          {item.bio || 'Looking for meaningful friendships on Wingman.'}
        </Text>

        <View style={styles.commonalities}>
          {renderCommonality('heart-outline', 'Shared interests', item.commonalities?.interests || [])}
          {renderCommonality('chatbubble-ellipses-outline', 'Shared languages', item.commonalities?.languages || [])}
          {renderCommonality('flag-outline', 'Shared goals', item.commonalities?.goals || [])}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.requestButton, !isPro && styles.requestButtonLocked]}
            onPress={() => handleSendRequest(item)}
            disabled={isBusy}
          >
            <Ionicons
              name={isPro ? 'person-add' : 'lock-closed'}
              size={16}
              color={isPro ? colors.text.primary : colors.text.tertiary}
            />
            <Text style={[styles.requestButtonText, !isPro && styles.requestButtonTextLocked]}>
              {isBusy ? 'Sending...' : isPro ? 'Send Request' : 'Pro Required'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listFooter = useMemo(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={colors.accent.primary} />
      </View>
    );
  }, [isLoadingMore, colors.accent.primary, styles.footerLoading]);

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header
        title="Friend Matching"
        showBack
        onBackPress={handleBackPress}
        rightIcon="mail-outline"
        onRightPress={() => navigation.navigate('FriendRequests')}
        transparent
      />

      <View style={styles.toolbarWrap}>
        <TouchableOpacity
          style={styles.metroPreferencesButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('MetroPreferences')}
        >
          <Ionicons name="location-outline" size={16} color={colors.accent.primary} />
          <Text style={styles.metroPreferencesText}>Metro preferences</Text>
        </TouchableOpacity>
      </View>

      {!isPro ? (
        <View style={styles.bannerWrap}>
          <InlineBanner
            title="Preview mode"
            message="Upgrade to Pro to send friend requests and unlock full Friends features."
            variant="warning"
          />
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgradePress}>
            <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={profiles}
        renderItem={renderProfile}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            tintColor={colors.accent.primary}
            refreshing={isRefreshing}
            onRefresh={() => {
              setOffset(0);
              void loadProfiles(true);
            }}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!isLoading && !isRefreshing && !isLoadingMore && hasMore) {
            void loadProfiles(false);
          }
        }}
        ListFooterComponent={listFooter}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          isLoading
            ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.accent.primary} />
                <Text style={styles.emptyTitle}>Finding great friend matches...</Text>
              </View>
            )
            : (
              <View style={styles.emptyState}>
                <Ionicons
                  name={error ? 'alert-circle-outline' : 'people-outline'}
                  size={56}
                  color={error ? colors.status.error : colors.text.tertiary}
                />
                <Text style={styles.emptyTitle}>
                  {error ? 'Unable to load matches' : 'No new matches right now'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {error || 'Check back soon for new friend recommendations.'}
                </Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setOffset(0);
                    void loadProfiles(true);
                  }}
                >
                  <Text style={styles.retryButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )
        }
      />
    </ScreenScaffold>
  );
};

export const FriendMatchingScreen: React.FC = () => {
  return <FriendMatchingContent />;
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface.level0,
  },
  bannerWrap: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  toolbarWrap: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
  },
  metroPreferencesButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  metroPreferencesText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  upgradeButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  upgradeButtonText: {
    ...typography.presets.caption,
    color: colors.text.primary,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.massive,
  },
  separator: {
    height: spacing.md,
  },
  profileCard: {
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.level1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  profileMeta: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  locationText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  scorePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.soft,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scoreText: {
    ...typography.presets.caption,
    color: colors.accent.primary,
  },
  profileBio: {
    ...typography.presets.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  commonalities: {
    gap: spacing.xs,
  },
  commonalityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  commonalityText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  requestButtonLocked: {
    backgroundColor: colors.surface.level2,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  requestButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  requestButtonTextLocked: {
    color: colors.text.secondary,
  },
  footerLoading: {
    paddingVertical: spacing.lg,
  },
  emptyState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
