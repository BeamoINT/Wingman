import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InlineBanner, PillTabs, ScreenScaffold } from '../components';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Notification {
  id: string;
  type: 'booking' | 'message' | 'review' | 'promo' | 'safety' | 'system' | 'social' | 'reward';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  avatar?: string;
  actionUrl?: string;
  data?: Record<string, string>;
}

const filterTabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'booking', label: 'Bookings' },
  { id: 'message', label: 'Messages' },
  { id: 'social', label: 'Social' },
] as const;

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleNotificationPress = async (notification: Notification) => {
    await haptics.light();
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    );
  };

  const handleMarkAllRead = async () => {
    await haptics.medium();
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking':
        return { name: 'calendar', color: colors.accent.primary };
      case 'message':
        return { name: 'chatbubble', color: colors.status.info };
      case 'review':
        return { name: 'star', color: colors.primary.silver };
      case 'promo':
        return { name: 'pricetag', color: colors.verification.trusted };
      case 'safety':
        return { name: 'shield', color: colors.status.success };
      case 'system':
        return { name: 'settings', color: colors.text.tertiary };
      case 'social':
        return { name: 'people', color: colors.status.info };
      case 'reward':
        return { name: 'gift', color: colors.primary.silver };
      default:
        return { name: 'notifications', color: colors.text.tertiary };
    }
  };

  const filteredNotifications = notifications.filter((notification) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !notification.isRead;
    return notification.type === activeFilter;
  });

  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const filterItems = useMemo(
    () =>
      filterTabs.map((tab) => {
        const count =
          tab.id === 'unread'
            ? unreadCount
            : tab.id === 'all'
              ? notifications.length
              : notifications.filter((notification) => notification.type === tab.id).length;

        return {
          id: tab.id,
          label: tab.label,
          count: count || undefined,
        };
      }),
    [notifications, unreadCount],
  );

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top + spacing.sm,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
      marginBottom: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: spacing.radius.round,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.level3,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    headerTitle: {
      ...typography.presets.h3,
      color: colors.text.primary,
      flex: 1,
      marginLeft: spacing.md,
    },
    markAllRead: {
      ...typography.presets.bodySmall,
      color: colors.accent.primary,
      fontFamily: typography.fontFamily.semibold,
    },
    scrollView: {
      flex: 1,
    },
    listContent: {
      paddingBottom: spacing.massive,
      gap: spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: spacing.massive,
      gap: spacing.md,
    },
    emptyTitle: {
      ...typography.presets.h4,
      color: colors.text.primary,
    },
    emptySubtitle: {
      ...typography.presets.bodySmall,
      color: colors.text.tertiary,
      textAlign: 'center',
    },
    notificationItem: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.surface.level3,
      borderWidth: 1,
      borderColor: colors.border.light,
      borderRadius: spacing.radius.xl,
      padding: spacing.md,
    },
    notificationUnread: {
      backgroundColor: colors.accent.soft,
      borderColor: colors.border.accent,
    },
    notificationLeft: {
      marginTop: 2,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: spacing.radius.round,
      backgroundColor: colors.surface.level2,
    },
    iconBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: spacing.radius.round,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background.primary,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: spacing.radius.round,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationContent: {
      flex: 1,
      gap: spacing.xs,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    notificationTitle: {
      ...typography.presets.body,
      color: colors.text.secondary,
      flex: 1,
    },
    notificationTitleUnread: {
      color: colors.text.primary,
      fontFamily: typography.fontFamily.semibold,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: spacing.radius.round,
      backgroundColor: colors.accent.primary,
    },
    notificationMessage: {
      ...typography.presets.bodySmall,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    notificationTime: {
      ...typography.presets.caption,
      color: colors.text.tertiary,
    },
  });

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 12 }} />
        )}
      </View>

      <InlineBanner
        variant="info"
        title="Verified-only community"
        message="Every Wingman user must complete identity verification before booking."
      />

      <PillTabs
        items={filterItems}
        activeId={activeFilter}
        onChange={(id) => {
          haptics.selection();
          setActiveFilter(id);
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'unread' ? "You're all caught up." : 'New updates will appear here.'}
            </Text>
          </View>
        ) : (
          filteredNotifications.map((notification) => {
            const icon = getNotificationIcon(notification.type);

            return (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.isRead && styles.notificationUnread,
                ]}
                onPress={() => handleNotificationPress(notification)}
                activeOpacity={0.72}
              >
                <View style={styles.notificationLeft}>
                  {notification.avatar ? (
                    <View style={styles.avatarContainer}>
                      <Image source={{ uri: notification.avatar }} style={styles.avatar} />
                      <View style={[styles.iconBadge, { backgroundColor: icon.color }]}> 
                        <Ionicons name={icon.name as keyof typeof Ionicons.glyphMap} size={10} color={colors.text.inverse} />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}> 
                      <Ionicons
                        name={icon.name as keyof typeof Ionicons.glyphMap}
                        size={24}
                        color={icon.color}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        !notification.isRead && styles.notificationTitleUnread,
                      ]}
                    >
                      {notification.title}
                    </Text>
                    {!notification.isRead ? <View style={styles.unreadDot} /> : null}
                  </View>
                  <Text style={styles.notificationMessage} numberOfLines={2}>
                    {notification.message}
                  </Text>
                  <Text style={styles.notificationTime}>{notification.timestamp}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </ScreenScaffold>
  );
};
