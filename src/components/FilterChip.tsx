import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  count?: number;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  selected = false,
  onPress,
  count,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.accent.soft : colors.background.tertiary,
          borderColor: selected ? colors.accent.primary : colors.border.light,
          paddingHorizontal: spacing.md,
          paddingVertical: 6,
          borderRadius: spacing.radius.round,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          ...typography.presets.bodySmall,
          fontFamily: selected ? typography.fontFamily.semibold : typography.fontFamily.medium,
          color: selected ? colors.accent.primary : colors.text.secondary,
        }}
      >
        {label}
        {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});
