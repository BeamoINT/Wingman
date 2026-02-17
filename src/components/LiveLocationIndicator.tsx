import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLiveLocation } from '../context/LiveLocationContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

function formatRemainingSeconds(seconds: number): string {
  if (seconds <= 0) {
    return 'expiring now';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m left`;
  }

  return `${Math.max(minutes, 1)}m left`;
}

function parseTimestamp(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const LiveLocationIndicator: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { activeShares, stopAllShares, isLoading, nowMs } = useLiveLocation();

  const metadata = useMemo(() => {
    if (activeShares.length === 0) {
      return null;
    }

    const earliestExpiry = activeShares.reduce((lowest, share) => {
      const candidate = parseTimestamp(share.expiresAt);
      if (!lowest || (candidate > 0 && candidate < lowest)) {
        return candidate;
      }
      return lowest;
    }, 0 as number);

    const remainingSeconds = earliestExpiry > 0
      ? Math.max(Math.floor((earliestExpiry - nowMs) / 1_000), 0)
      : 0;

    return {
      count: activeShares.length,
      remainingSeconds,
    };
  }, [activeShares, nowMs]);

  if (!metadata) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View style={[styles.container, { marginTop: insets.top + tokens.spacing.xs }]}> 
        <View style={styles.leftContent}>
          <Ionicons name="radio" size={14} color={tokens.colors.status.success} />
          <Text style={styles.text} numberOfLines={1}>
            Sharing live location in {metadata.count} {metadata.count === 1 ? 'chat' : 'chats'} ({formatRemainingSeconds(metadata.remainingSeconds)})
          </Text>
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={() => {
            void stopAllShares();
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={tokens.colors.status.error} />
          ) : (
            <>
              <Ionicons name="stop-circle-outline" size={14} color={tokens.colors.status.error} />
              <Text style={styles.stopText}>Stop</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  container: {
    width: '100%',
    maxWidth: spacing.contentMaxWidthWide,
    minHeight: 44,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.status.success,
    backgroundColor: colors.surface.level0,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  text: {
    ...typography.presets.caption,
    color: colors.text.primary,
    flexShrink: 1,
  },
  stopButton: {
    minHeight: 30,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: colors.status.error,
    backgroundColor: colors.surface.level1,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stopText: {
    ...typography.presets.caption,
    color: colors.status.error,
  },
});
