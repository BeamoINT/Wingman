/**
 * CitySearch Component
 * City search with Google Places Autocomplete
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { usePlacesAutocomplete } from '../../hooks/usePlacesAutocomplete';
import type { ThemeTokens } from '../../theme/tokens';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { CitySearchProps, PlacePrediction } from '../../types/location';
import { haptics } from '../../utils/haptics';
import { BottomSheet } from '../BottomSheet';

export const CitySearch: React.FC<CitySearchProps> = ({
  visible,
  countryCode,
  onSelect,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    predictions,
    isSearching,
    isLoadingDetails,
    error,
    search,
    selectPlace,
    clearPredictions,
  } = usePlacesAutocomplete({ countryCode });

  useEffect(() => {
    search(searchQuery);
  }, [searchQuery, search]);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      clearPredictions();
    }
  }, [visible, clearPredictions]);

  const handleSelect = useCallback(
    async (prediction: PlacePrediction) => {
      await haptics.selection();
      Keyboard.dismiss();

      const details = await selectPlace(prediction.placeId);
      if (details) {
        onSelect(details);
        onClose();
      }
    },
    [selectPlace, onSelect, onClose],
  );

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setSearchQuery('');
    clearPredictions();
    onClose();
  }, [onClose, clearPredictions]);

  const renderItem = useCallback(
    ({ item }: { item: PlacePrediction }) => (
      <TouchableOpacity
        style={styles.predictionItem}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        disabled={isLoadingDetails}
      >
        <Ionicons
          name="location"
          size={20}
          color={tokens.colors.primary.blue}
          style={styles.locationIcon}
        />
        <View style={styles.predictionInfo}>
          <Text style={styles.mainText}>{item.mainText}</Text>
          <Text style={styles.secondaryText} numberOfLines={1}>
            {item.secondaryText}
          </Text>
        </View>
        {isLoadingDetails ? (
          <ActivityIndicator size="small" color={tokens.colors.primary.blue} />
        ) : null}
      </TouchableOpacity>
    ),
    [handleSelect, isLoadingDetails, styles, tokens.colors.primary.blue],
  );

  const keyExtractor = useCallback((item: PlacePrediction) => item.placeId, []);

  const renderEmptyState = () => {
    if (isSearching) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={tokens.colors.primary.blue} />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={48} color={tokens.colors.status.error} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (searchQuery.trim().length >= 2 && predictions.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="location" size={48} color={tokens.colors.text.tertiary} />
          <Text style={styles.emptyText}>No cities found</Text>
          <Text style={styles.emptyHint}>Try a different search term</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search" size={48} color={tokens.colors.text.tertiary} />
        <Text style={styles.emptyText}>Search for a city</Text>
        <Text style={styles.emptyHint}>Start typing to search for cities</Text>
      </View>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      snapPoints={[0.85]}
      initialSnapIndex={0}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Search City</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={tokens.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={tokens.colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter city name..."
            placeholderTextColor={tokens.colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            autoFocus
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

        {isLoadingDetails ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={tokens.colors.primary.blue} />
            <Text style={styles.loadingText}>Getting city details...</Text>
          </View>
        ) : null}

        {predictions.length > 0 ? (
          <FlatList
            data={predictions}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + tokens.spacing.xl }]}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          renderEmptyState()
        )}

        <View style={styles.attribution}>
          <Text style={styles.attributionText}>Powered by Google</Text>
        </View>
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
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  locationIcon: {
    marginRight: spacing.md,
  },
  predictionInfo: {
    flex: 1,
  },
  mainText: {
    ...typography.presets.body,
    color: colors.text.primary,
  },
  secondaryText: {
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
  emptyHint: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  attribution: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  attributionText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    fontSize: 10,
  },
});
