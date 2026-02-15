import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { Button } from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EmptyStateProps {
  /**
   * Main title text.
   */
  title: string;
  /**
   * Optional description text.
   */
  message?: string;
  /**
   * Ionicon name to display.
   */
  icon?: IconName;
  /**
   * Icon color (defaults to tertiary text color).
   */
  iconColor?: string;
  /**
   * Optional action button label.
   */
  actionLabel?: string;
  /**
   * Optional action button callback.
   */
  onAction?: () => void;
  /**
   * Optional secondary action button label.
   */
  secondaryActionLabel?: string;
  /**
   * Optional secondary action button callback.
   */
  onSecondaryAction?: () => void;
  /**
   * Container style overrides.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Size variant.
   */
  size?: 'small' | 'medium' | 'large';
}

/**
 * Reusable empty state component for when lists/content are empty.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon = 'file-tray-outline',
  iconColor = colors.text.tertiary,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  style,
  size = 'medium',
}) => {
  const iconSize = size === 'small' ? 48 : size === 'large' ? 80 : 64;
  const titleStyle = size === 'small' ? typography.presets.h4 : typography.presets.h3;
  const messageStyle = size === 'small' ? typography.presets.caption : typography.presets.body;

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${message || ''}`}
    >
      <View
        style={[
          styles.iconContainer,
          { width: iconSize + 32, height: iconSize + 32, borderRadius: (iconSize + 32) / 2 },
        ]}
      >
        <Ionicons
          name={icon}
          size={iconSize}
          color={iconColor}
        />
      </View>

      <Text style={[styles.title, titleStyle]} accessibilityRole="header">
        {title}
      </Text>

      {message && (
        <Text style={[styles.message, messageStyle]}>
          {message}
        </Text>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <Button
              title={actionLabel}
              onPress={onAction}
              variant="primary"
              size={size === 'small' ? 'small' : 'medium'}
            />
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              title={secondaryActionLabel}
              onPress={onSecondaryAction}
              variant="outline"
              size={size === 'small' ? 'small' : 'medium'}
            />
          )}
        </View>
      )}
    </View>
  );
};

// Pre-configured empty states for common use cases
export const EmptySearchResults: React.FC<{
  query?: string;
  onClearSearch?: () => void;
}> = ({ query, onClearSearch }) => (
  <EmptyState
    icon="search-outline"
    title="No results found"
    message={query ? `No results for "${query}". Try a different search term.` : 'Try adjusting your search or filters.'}
    actionLabel={onClearSearch ? 'Clear Search' : undefined}
    onAction={onClearSearch}
  />
);

export const EmptyMessages: React.FC<{
  onStartConversation?: () => void;
}> = ({ onStartConversation }) => (
  <EmptyState
    icon="chatbubbles-outline"
    title="No messages yet"
    message="Start a conversation with a wingman to see your messages here."
    actionLabel={onStartConversation ? 'Browse Wingmen' : undefined}
    onAction={onStartConversation}
  />
);

export const EmptyBookings: React.FC<{
  onBrowse?: () => void;
}> = ({ onBrowse }) => (
  <EmptyState
    icon="calendar-outline"
    title="No bookings yet"
    message="When you book a wingman, your bookings will appear here."
    actionLabel={onBrowse ? 'Find a Wingman' : undefined}
    onAction={onBrowse}
  />
);

export const EmptyNotifications: React.FC = () => (
  <EmptyState
    icon="notifications-outline"
    title="No notifications"
    message="You're all caught up! New notifications will appear here."
    size="medium"
  />
);

export const EmptyFavorites: React.FC<{
  onBrowse?: () => void;
}> = ({ onBrowse }) => (
  <EmptyState
    icon="heart-outline"
    title="No favorites yet"
    message="Tap the heart icon on wingmen you like to save them here."
    actionLabel={onBrowse ? 'Browse Wingmen' : undefined}
    onAction={onBrowse}
  />
);

export const EmptyFeed: React.FC<{
  onFindFriends?: () => void;
}> = ({ onFindFriends }) => (
  <EmptyState
    icon="people-outline"
    title="Your feed is empty"
    message="Connect with friends to see their posts here."
    actionLabel={onFindFriends ? 'Find Friends' : undefined}
    onAction={onFindFriends}
  />
);

export const EmptyChat: React.FC<{
  companionName?: string;
}> = ({ companionName }) => (
  <EmptyState
    icon="chatbubble-outline"
    title="Start the conversation"
    message={companionName
      ? `Say hello to ${companionName}! Introduce yourself and discuss your booking.`
      : 'Send a message to get the conversation started.'
    }
    size="small"
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
