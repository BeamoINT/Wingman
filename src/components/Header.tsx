import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
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
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  const handleBackPress = async () => {
    await haptics.light();
    onBackPress?.();
  };

  const handleRightPress = async () => {
    await haptics.light();
    onRightPress?.();
  };

  const styles = StyleSheet.create({
    blur: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
      overflow: 'hidden',
    },
    webBlur: {
      backgroundColor: tokens.isDark ? colors.surface.overlay : colors.surface.level1,
    },
    container: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: insets.top + spacing.xs,
      paddingBottom: large ? spacing.lg : spacing.md,
      maxWidth: spacing.contentMaxWidthWide,
      alignSelf: 'center',
      width: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 42,
    },
    leftSection: {
      width: 44,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    centerSection: {
      flex: 1,
      alignItems: large ? 'flex-start' : 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    rightSection: {
      minWidth: 44,
      alignItems: 'flex-end',
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: spacing.radius.round,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface.level3,
      borderWidth: 1,
      borderColor: colors.border.light,
    },
    title: {
      ...typography.presets.h4,
      color: colors.text.primary,
      textAlign: large ? 'left' : 'center',
    },
    subtitle: {
      ...typography.presets.caption,
      color: colors.text.tertiary,
      marginTop: 2,
      textAlign: large ? 'left' : 'center',
    },
    largeTitle: {
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    largeTitleText: {
      ...typography.presets.h1,
      color: colors.text.primary,
    },
    largeSubtitle: {
      ...typography.presets.body,
      color: colors.text.secondary,
    },
  });

  const content = (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.iconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!large && title ? (
          <View style={styles.centerSection}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.centerSection} />
        )}

        <View style={styles.rightSection}>
          {rightComponent}
          {rightIcon ? (
            <TouchableOpacity
              onPress={handleRightPress}
              style={styles.iconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={rightIcon} size={20} color={colors.text.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {large && title ? (
        <View style={styles.largeTitle}>
          <Text style={styles.largeTitleText}>{title}</Text>
          {subtitle ? <Text style={styles.largeSubtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );

  if (transparent) {
    return content;
  }

  if (Platform.OS === 'web') {
    return <View style={[styles.blur, styles.webBlur]}>{content}</View>;
  }

  return (
    <BlurView
      intensity={tokens.isDark ? 95 : 75}
      tint={tokens.isDark ? 'dark' : 'light'}
      style={styles.blur}
    >
      {content}
    </BlurView>
  );
};
