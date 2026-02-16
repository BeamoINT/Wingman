import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { FilterChip } from './FilterChip';

export interface PillTabItem {
  id: string;
  label: string;
  count?: number;
}

interface PillTabsProps {
  items: PillTabItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export const PillTabs: React.FC<PillTabsProps> = ({ items, activeId, onChange }) => {
  const { tokens } = useTheme();
  const { spacing } = tokens;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { gap: spacing.xs }]}
      >
        {items.map((item) => (
          <FilterChip
            key={item.id}
            label={item.label}
            selected={activeId === item.id}
            count={item.count}
            onPress={() => onChange(item.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 2,
  },
});
