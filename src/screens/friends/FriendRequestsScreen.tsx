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
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Header,
  PillTabs,
  RequirementsGate,
  ScreenScaffold,
  SectionHeader,
} from '../../components';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchConnectionInbox,
  respondToConnectionRequest,
} from '../../services/api/friendsApi';
import { getOrCreateConversation } from '../../services/api/messages';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { RootStackParamList } from '../../types';
import type { FriendConnection } from '../../types/friends';
import { haptics } from '../../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RequestTab = 'incoming' | 'outgoing' | 'connected';

const FriendRequestsContent: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles(createStyles);

  const [activeTab, setActiveTab] = useState<RequestTab>('incoming');
  const [incoming, setIncoming] = useState<FriendConnection[]>([]);
  const [outgoing, setOutgoing] = useState<FriendConnection[]>([]);
  const [connected, setConnected] = useState<FriendConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyConnectionId, setBusyConnectionId] = useState<string | null>(null);

  const loadInbox = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    try {
      const {
        incoming: incomingRows,
        outgoing: outgoingRows,
        accepted,
        error: inboxError,
      } = await fetchConnectionInbox();

      if (inboxError) {
        setError(inboxError.message);
        setIncoming([]);
        setOutgoing([]);
        setConnected([]);
        return;
      }

      setIncoming(incomingRows);
      setOutgoing(outgoingRows);
      setConnected(accepted);
    } catch (loadError) {
      console.error('Error loading connection inbox:', loadError);
      setError('Unable to load friend requests right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleAccept = async (connection: FriendConnection) => {
    if (!connection.id) return;
    setBusyConnectionId(connection.id);
    await haptics.success();

    const { success, error: updateError } = await respondToConnectionRequest(connection.id, 'accepted');
    if (!success || updateError) {
      setError(updateError?.message || 'Unable to accept request right now.');
      setBusyConnectionId(null);
      return;
    }

    const otherUserId = connection.otherProfile?.userId || connection.otherProfile?.id;
    if (otherUserId) {
      const { conversation, error: conversationError } = await getOrCreateConversation(otherUserId);
      if (!conversationError && conversation?.id) {
        navigation.navigate('Chat', { conversationId: conversation.id });
      }
    }

    setBusyConnectionId(null);
    await loadInbox(true);
  };

  const handleDecline = async (connectionId: string) => {
    setBusyConnectionId(connectionId);
    await haptics.light();
    const { success, error: updateError } = await respondToConnectionRequest(connectionId, 'declined');
    if (!success || updateError) {
      setError(updateError?.message || 'Unable to decline request right now.');
    }
    setBusyConnectionId(null);
    await loadInbox(true);
  };

  const handleCancel = async (connectionId: string) => {
    setBusyConnectionId(connectionId);
    await haptics.light();
    const { success, error: updateError } = await respondToConnectionRequest(connectionId, 'canceled');
    if (!success || updateError) {
      setError(updateError?.message || 'Unable to cancel request right now.');
    }
    setBusyConnectionId(null);
    await loadInbox(true);
  };

  const handleOpenChat = async (connection: FriendConnection) => {
    const otherUserId = connection.otherProfile?.userId || connection.otherProfile?.id;
    if (!otherUserId) return;

    await haptics.light();
    const { conversation, error: conversationError } = await getOrCreateConversation(otherUserId);
    if (conversationError || !conversation?.id) {
      setError(conversationError?.message || 'Unable to open chat right now.');
      return;
    }
    navigation.navigate('Chat', { conversationId: conversation.id });
  };

  const data = activeTab === 'incoming'
    ? incoming
    : activeTab === 'outgoing'
      ? outgoing
      : connected;

  const renderItem = ({ item }: { item: FriendConnection }) => {
    const name = item.otherProfile
      ? `${item.otherProfile.firstName} ${item.otherProfile.lastName}`.trim()
      : 'Wingman User';
    const subtitle = item.otherProfile?.commonalities?.interests?.length
      ? `${item.otherProfile.commonalities.interests.length} shared interests`
      : item.otherProfile?.bio || 'Friend connection on Wingman';

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Avatar source={item.otherProfile?.avatar} name={name} size="medium" />
          <View style={styles.requestContent}>
            <Text style={styles.requestName}>{name}</Text>
            <Text style={styles.requestSubtitle} numberOfLines={2}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.requestActions}>
          {activeTab === 'incoming' ? (
            <>
              <TouchableOpacity
                style={styles.secondaryAction}
                onPress={() => handleDecline(item.id)}
                disabled={busyConnectionId === item.id}
              >
                <Text style={styles.secondaryActionText}>
                  {busyConnectionId === item.id ? 'Updating...' : 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryAction}
                onPress={() => handleAccept(item)}
                disabled={busyConnectionId === item.id}
              >
                <Text style={styles.primaryActionText}>
                  {busyConnectionId === item.id ? 'Updating...' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </>
          ) : activeTab === 'outgoing' ? (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => handleCancel(item.id)}
              disabled={busyConnectionId === item.id}
            >
              <Text style={styles.secondaryActionText}>
                {busyConnectionId === item.id ? 'Updating...' : 'Cancel Request'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryAction} onPress={() => handleOpenChat(item)}>
              <Text style={styles.primaryActionText}>Open Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenScaffold hideHorizontalPadding withBottomPadding={false} style={styles.container}>
      <Header title="Friend Requests" showBack onBackPress={handleBackPress} transparent />

      <View style={styles.innerContent}>
        <SectionHeader title="Connections" subtitle="Manage requests and active chats" />

        <View style={styles.tabs}>
          <PillTabs
            items={[
              { id: 'incoming', label: 'Incoming', count: incoming.length },
              { id: 'outgoing', label: 'Outgoing', count: outgoing.length },
              { id: 'connected', label: 'Connected', count: connected.length },
            ]}
            activeId={activeTab}
            onChange={(value) => setActiveTab(value as RequestTab)}
          />
        </View>

        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              tintColor={colors.accent.primary}
              refreshing={isRefreshing}
              onRefresh={() => {
                void loadInbox(true);
              }}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            isLoading
              ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="large" color={colors.accent.primary} />
                  <Text style={styles.emptyTitle}>Loading requests...</Text>
                </View>
              )
              : (
                <View style={styles.emptyState}>
                  <Ionicons
                    name={error ? 'alert-circle-outline' : 'people-outline'}
                    size={52}
                    color={error ? colors.status.error : colors.text.tertiary}
                  />
                  <Text style={styles.emptyTitle}>
                    {error
                      ? 'Unable to load requests'
                      : activeTab === 'incoming'
                        ? 'No incoming requests'
                        : activeTab === 'outgoing'
                          ? 'No outgoing requests'
                          : 'No connections yet'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {error || 'Start connecting with relevant friends from the Match tab.'}
                  </Text>
                </View>
              )
          }
        />
      </View>
    </ScreenScaffold>
  );
};

export const FriendRequestsScreen: React.FC = () => {
  return (
    <RequirementsGate feature="friends_feed" modalTitle="Upgrade to Pro">
      <FriendRequestsContent />
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
  tabs: {
    marginBottom: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.massive,
  },
  separator: {
    height: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.surface.level1,
    borderRadius: spacing.radius.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    gap: spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  requestContent: {
    flex: 1,
    gap: spacing.xs,
  },
  requestName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  requestSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  primaryAction: {
    backgroundColor: colors.accent.primary,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
  secondaryAction: {
    backgroundColor: colors.surface.level2,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: spacing.radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    ...typography.presets.button,
    color: colors.text.secondary,
  },
  emptyState: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
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
});
