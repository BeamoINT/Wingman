import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
    Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBackPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightComponent?: React.ReactNode;
  transparent?: boolean;
  large?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBackPress,
  rightIcon,
  onRightPress,
  rightComponent,
  transparent = false,
  large = false,
}) => {
  const insets = useSafeAreaInsets();

  const handleBackPress = async () => {
    await haptics.light();
    onBackPress?.();
  };

  const handleRightPress = async () => {
    await haptics.light();
    onRightPress?.();
  };

  const HeaderContent = () => (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        large && styles.largeContainer,
      ]}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.row}>
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>

        {!large && title && (
          <View style={styles.centerSection}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        )}

        <View style={styles.rightSection}>
          {rightComponent}
          {rightIcon && (
            <TouchableOpacity
              onPress={handleRightPress}
              style={styles.rightButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={rightIcon}
                size={24}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {large && title && (
        <View style={styles.largeTitle}>
          <Text style={styles.largeTitleText}>{title}</Text>
          {subtitle && <Text style={styles.largeSubtitle}>{subtitle}</Text>}
        </View>
      )}
    </View>
  );

  if (transparent) {
    return <HeaderContent />;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.blur, styles.webBlur]}>
        <HeaderContent />
      </View>
    );
  }

  return (
    <BlurView intensity={80} tint="dark" style={styles.blur}>
      <HeaderContent />
    </BlurView>
  );
};

const styles = StyleSheet.create({
  blur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  webBlur: {
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
  },
  container: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  largeContainer: {
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  rightButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.presets.h4,
    color: colors.text.primary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 2,
  },
  largeTitle: {
    marginTop: spacing.md,
  },
  largeTitleText: {
    ...typography.presets.h1,
    color: colors.text.primary,
  },
  largeSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
});
