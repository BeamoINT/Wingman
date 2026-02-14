import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Badge } from '../components';
import type { RootStackParamList } from '../types';

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

// Notifications will be fetched from the backend when the notifications table is implemented.
// For now, the screen shows an empty state.

const filterTabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'booking', label: 'Bookings' },
  { id: 'message', label: 'Messages' },
  { id: 'social', label: 'Social' },
];

export const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleNotificationPress = async (notification: Notification) => {
    await haptics.light();
    // Mark as read
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    );
    // Navigate based on type
  };

  const handleMarkAllRead = async () => {
    await haptics.medium();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking': return { name: 'calendar', color: colors.primary.blue };
      case 'message': return { name: 'chatbubble', color: colors.status.info };
      case 'review': return { name: 'star', color: colors.primary.gold };
      case 'promo': return { name: 'pricetag', color: colors.verification.trusted };
      case 'safety': return { name: 'shield', color: colors.status.success };
      case 'system': return { name: 'settings', color: colors.text.tertiary };
      case 'social': return { name: 'people', color: colors.status.info };
      case 'reward': return { name: 'gift', color: colors.primary.gold };
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.isRead;
    return n.type === activeFilter;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterContainer}
      >
        {filterTabs.map((tab) => {
          const count = tab.id === 'unread'
            ? unreadCount
            : tab.id === 'all'
            ? notifications.length
            : notifications.filter(n => n.type === tab.id).length;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
              onPress={() => {
                haptics.selection();
                setActiveFilter(tab.id);
              }}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === tab.id && styles.filterTabTextActive,
              ]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.filterBadge,
                  activeFilter === tab.id && styles.filterBadgeActive,
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    activeFilter === tab.id && styles.filterBadgeTextActive,
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'unread' ? "You're all caught up!" : 'Nothing here yet'}
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
                activeOpacity={0.7}
              >
                <View style={styles.notificationLeft}>
                  {notification.avatar ? (
                    <View style={styles.avatarContainer}>
                      <Image source={{ uri: notification.avatar }} style={styles.avatar} />
                      <View style={[styles.iconBadge, { backgroundColor: icon.color }]}>
                        <Ionicons name={icon.name as any} size={10} color={colors.text.primary} />
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.iconContainer, { backgroundColor: `${icon.color}20` }]}>
                      <Ionicons name={icon.name as any} size={24} color={icon.color} />
                    </View>
                  )}
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[
                      styles.notificationTitle,
                      !notification.isRead && styles.notificationTitleUnread,
                    ]}>
                      {notification.title}
                    </Text>
                    {!notification.isRead && <View style={styles.unreadDot} />}
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
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    flex: 1,
    marginLeft: spacing.sm,
  },
  markAllRead: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  filterContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.round,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  filterTabActive: {
    backgroundColor: colors.primary.blue,
  },
  filterTabText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  filterTabTextActive: {
    color: colors.text.primary,
  },
  filterBadge: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterBadgeText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontSize: 10,
  },
  filterBadgeTextActive: {
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.massive,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  notificationUnread: {
    backgroundColor: 'rgba(78, 205, 196, 0.05)',
  },
  notificationLeft: {
    marginRight: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  notificationTitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
  },
  notificationTitleUnread: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary.blue,
  },
  notificationMessage: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  notificationTime: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
});
