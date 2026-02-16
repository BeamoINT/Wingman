/**
 * CountryPicker Component
 * Searchable country picker with flags, grouped by region
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Keyboard,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  getCountriesByRegion,
  regionOrder,
  searchCountries,
} from '../../data/countries';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { Country, CountryPickerProps, CountryRegion } from '../../types/location';
import { haptics } from '../../utils/haptics';
import { BottomSheet } from '../BottomSheet';

interface SectionData {
  title: CountryRegion;
  data: Country[];
}

export const CountryPicker: React.FC<CountryPickerProps> = ({
  visible,
  selectedCode,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo((): SectionData[] => {
    if (searchQuery.trim()) {
      const results = searchCountries(searchQuery);
      if (results.length === 0) {
        return [];
      }
      return [{ title: 'Americas' as CountryRegion, data: results }];
    }

    const grouped = getCountriesByRegion();
    return regionOrder.map((region) => ({
      title: region,
      data: grouped[region],
    }));
  }, [searchQuery]);

  const handleSelect = useCallback(
    async (country: Country) => {
      await haptics.selection();
      Keyboard.dismiss();
      onSelect(country);
      onClose();
      setSearchQuery('');
    },
    [onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const renderItem = useCallback(
    ({ item }: { item: Country }) => {
      const isSelected = item.code === selectedCode;

      return (
        <TouchableOpacity
          style={[styles.countryItem, isSelected && styles.countryItemSelected]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.flag}>{item.flag}</Text>
          <View style={styles.countryInfo}>
            <Text style={styles.countryName}>{item.name}</Text>
            <Text style={styles.dialCode}>{item.dialCode}</Text>
          </View>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={tokens.colors.accent.primary}
            />
          ) : null}
        </TouchableOpacity>
      );
    },
    [selectedCode, handleSelect, styles, tokens.colors.accent.primary],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => {
      if (searchQuery.trim()) {
        return null;
      }
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      );
    },
    [searchQuery, styles],
  );

  const keyExtractor = useCallback((item: Country) => item.code, []);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[0.85]}
      initialSnapIndex={0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Country</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={tokens.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={tokens.colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries..."
            placeholderTextColor={tokens.colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={tokens.colors.text.tertiary}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {sections.length > 0 ? (
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + tokens.spacing.xl }]}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={tokens.colors.text.tertiary} />
            <Text style={styles.emptyText}>No countries found</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.level2,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    backgroundColor: colors.surface.level1,
    paddingVertical: spacing.sm,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  countryItemSelected: {
    backgroundColor: colors.accent.soft,
  },
  flag: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  dialCode: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
});
