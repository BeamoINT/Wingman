import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onPressAction,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  return (
    <View style={[styles.row, { marginBottom: spacing.sm }]}> 
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{subtitle}</Text>
        ) : null}
      </View>

      {actionLabel && onPressAction ? (
        <Pressable
          onPress={onPressAction}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: pressed ? colors.interactive.selected : 'transparent',
              borderColor: colors.border.light,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
              borderRadius: spacing.radius.round,
            },
          ]}
        >
          <Text
            style={{
              ...typography.presets.caption,
              color: colors.accent.primary,
            }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  action: {
    borderWidth: 1,
  },
});
