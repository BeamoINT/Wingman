/**
 * CountryPicker Component
 * Searchable country picker with flags, grouped by region
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Keyboard, SectionList,
    StyleSheet, Text,
    TextInput,
    TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    getCountriesByRegion, regionOrder, searchCountries
} from '../../data/countries';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
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
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo((): SectionData[] => {
    if (searchQuery.trim()) {
      // When searching, show flat results grouped under "Search Results"
      const results = searchCountries(searchQuery);
      if (results.length === 0) {
        return [];
      }
      return [{ title: 'Americas' as CountryRegion, data: results }];
    }

    // Show all countries grouped by region
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
    [onSelect, onClose]
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
          {isSelected && (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={colors.primary.blue}
            />
          )}
        </TouchableOpacity>
      );
    },
    [selectedCode, handleSelect]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => {
      if (searchQuery.trim()) {
        // Don't show section header when searching
        return null;
      }
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
        </View>
      );
    },
    [searchQuery]
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Country</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search countries..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name="close-circle"
                size={20}
                color={colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Country List */}
        {sections.length > 0 ? (
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No countries found</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
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
    backgroundColor: colors.background.elevated,
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
    borderBottomColor: colors.border.light,
  },
  countryItemSelected: {
    backgroundColor: colors.primary.blueSoft,
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
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});
