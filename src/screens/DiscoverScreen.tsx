import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompanionCard, EmptySearchResults, EmptyState } from '../components';
import type { CompanionData } from '../services/api/companions';
import { fetchCompanions } from '../services/api/companions';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import type { Companion, CompanionSpecialty, RootStackParamList, VerificationLevel } from '../types';
import { haptics } from '../utils/haptics';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type SpecialtyFilter = 'all' | CompanionSpecialty;
type SortOption = 'top-rated' | 'most-reviewed' | 'price-low' | 'price-high';

const specialtyFilters: Array<{
  id: SpecialtyFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'dining', label: 'Dining', icon: 'restaurant' },
  { id: 'social-events', label: 'Social', icon: 'people' },
  { id: 'coffee-chat', label: 'Coffee', icon: 'cafe' },
  { id: 'nightlife', label: 'Nightlife', icon: 'wine' },
  { id: 'movies', label: 'Movies', icon: 'film' },
  { id: 'concerts', label: 'Concerts', icon: 'musical-notes' },
  { id: 'sports', label: 'Sports', icon: 'football' },
  { id: 'safety-companion', label: 'Safety', icon: 'shield' },
];

const sortOptions: Array<{
  id: SortOption;
  label: string;
}> = [
  { id: 'top-rated', label: 'Top Rated' },
  { id: 'most-reviewed', label: 'Most Reviewed' },
  { id: 'price-low', label: 'Price: Low to High' },
  { id: 'price-high', label: 'Price: High to Low' },
];

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Transform API companion data to app Companion type
 */
function transformCompanionData(data: CompanionData): Companion {
  const hasIdVerification = !!data.user?.id_verified;
  const verificationLevel: VerificationLevel = data.user?.verification_level === 'premium'
    ? 'premium'
    : data.user?.verification_level === 'verified' || hasIdVerification
      ? 'verified'
      : 'basic';

  return {
    id: data.id,
    user: {
      id: data.user_id,
      firstName: data.user?.first_name || '',
      lastName: data.user?.last_name || '',
      email: data.user?.email || '',
      avatar: data.user?.avatar_url || undefined,
      isVerified: (
        verificationLevel === 'verified'
        || verificationLevel === 'premium'
        || !!data.user?.id_verified
      ),
      isPremium: (data.user?.subscription_tier || 'free') !== 'free',
      createdAt: data.user?.created_at || data.created_at,
      location: data.user?.city ? {
        city: data.user.city,
        state: data.user?.state || undefined,
        country: data.user?.country || 'USA',
      } : undefined,
    },
    rating: toNumber(data.rating, 0),
    reviewCount: Math.max(0, Math.round(toNumber(data.review_count, 0))),
    hourlyRate: Math.max(0, toNumber(data.hourly_rate, 0)),
    specialties: toStringArray(data.specialties) as CompanionSpecialty[],
    languages: toStringArray(data.languages),
    availability: [],
    isOnline: typeof data.is_available === 'boolean' ? data.is_available : true,
    responseTime: data.response_time || 'Usually responds within 1 hour',
    completedBookings: Math.max(0, Math.round(toNumber(data.completed_bookings, 0))),
    badges: [],
    gallery: toStringArray(data.gallery),
    about: data.about || '',
    interests: [],
    verificationLevel,
  };
}

function normalizeForSearch(value: string): string {
  return value.trim().toLowerCase();
}

function sortCompanions(companions: Companion[], sortOption: SortOption): Companion[] {
  const sorted = [...companions];

  switch (sortOption) {
    case 'most-reviewed':
      sorted.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
      return sorted;
    case 'price-low':
      sorted.sort((a, b) => a.hourlyRate - b.hourlyRate || b.rating - a.rating);
      return sorted;
    case 'price-high':
      sorted.sort((a, b) => b.hourlyRate - a.hourlyRate || b.rating - a.rating);
      return sorted;
    case 'top-rated':
    default:
      sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
      return sorted;
  }
}

export const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [allCompanions, setAllCompanions] = useState<Companion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState<SpecialtyFilter>('all');
  const [sortOption, setSortOption] = useState<SortOption>('top-rated');
  const [availableOnly, setAvailableOnly] = useState(false);

  const loadCompanions = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const { companions, error: apiError } = await fetchCompanions();

      if (apiError) {
        console.error('Error loading companions:', apiError);
        setError('Unable to load wingmen right now.');
        setAllCompanions([]);
      } else {
        setAllCompanions(companions.map(transformCompanionData));
      }
    } catch (err) {
      console.error('Error in loadCompanions:', err);
      setError('Something went wrong while loading wingmen.');
      setAllCompanions([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCompanions();
  }, [loadCompanions]);

  const filteredCompanions = useMemo(() => {
    const normalizedSearch = normalizeForSearch(searchQuery);

    let result = [...allCompanions];

    if (activeSpecialty !== 'all') {
      result = result.filter(companion => companion.specialties.includes(activeSpecialty));
    }

    if (availableOnly) {
      result = result.filter(companion => companion.isOnline);
    }

    if (normalizedSearch) {
      result = result.filter(companion => {
        const searchable = [
          companion.user.firstName,
          companion.user.lastName,
          `${companion.user.firstName} ${companion.user.lastName}`.trim(),
          companion.user.location?.city || '',
          companion.user.location?.state || '',
          companion.about,
          companion.specialties.join(' '),
          companion.languages.join(' '),
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      });
    }

    return sortCompanions(result, sortOption);
  }, [allCompanions, activeSpecialty, availableOnly, searchQuery, sortOption]);

  const hasActiveFilters = useMemo(() => {
    return (
      activeSpecialty !== 'all' ||
      availableOnly ||
      !!searchQuery.trim() ||
      sortOption !== 'top-rated'
    );
  }, [activeSpecialty, availableOnly, searchQuery, sortOption]);

  const handleCompanionPress = useCallback(
    (companionId: string) => {
      navigation.navigate('CompanionProfile', { companionId });
    },
    [navigation]
  );

  const handleRefresh = useCallback(() => {
    loadCompanions(true);
  }, [loadCompanions]);

  const resetFilters = useCallback(async () => {
    await haptics.selection();
    setSearchQuery('');
    setActiveSpecialty('all');
    setSortOption('top-rated');
    setAvailableOnly(false);
  }, []);

  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.centerStateText}>Loading wingmen...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle" size={42} color={colors.status.error} />
          <Text style={styles.errorTitle}>Couldn’t Load Discover</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadCompanions()}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <EmptySearchResults
          query={searchQuery.trim()}
          onClearSearch={() => setSearchQuery('')}
        />
      );
    }

    return (
      <EmptyState
        icon="people-outline"
        title="No wingmen available"
        message="There are currently no active wingmen matching your filters."
        actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
        onAction={hasActiveFilters ? resetFilters : undefined}
      />
    );
  }, [isLoading, error, loadCompanions, searchQuery, hasActiveFilters, resetFilters]);

  const listHeader = (
    <View style={styles.controls}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {specialtyFilters.map((filter) => {
          const isActive = activeSpecialty === filter.id;

          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={async () => {
                await haptics.selection();
                setActiveSpecialty(filter.id);
              }}
            >
              <Ionicons
                name={filter.icon}
                size={15}
                color={isActive ? colors.text.primary : colors.text.tertiary}
              />
              <Text style={[styles.filterChipLabel, isActive && styles.filterChipLabelActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleChip, availableOnly && styles.toggleChipActive]}
          onPress={async () => {
            await haptics.selection();
            setAvailableOnly(prev => !prev);
          }}
        >
          <Ionicons
            name={availableOnly ? 'checkmark-circle' : 'ellipse-outline'}
            size={16}
            color={availableOnly ? colors.primary.blue : colors.text.tertiary}
          />
          <Text style={styles.toggleChipLabel}>Available now</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
      >
        {sortOptions.map((option) => {
          const isActive = sortOption === option.id;

          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.sortChip, isActive && styles.sortChipActive]}
              onPress={async () => {
                await haptics.selection();
                setSortOption(option.id);
              }}
            >
              <Text style={[styles.sortChipLabel, isActive && styles.sortChipLabelActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isLoading && !error && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {filteredCompanions.length} {filteredCompanions.length === 1 ? 'wingman' : 'wingmen'}
          </Text>
          {hasActiveFilters && (
            <TouchableOpacity onPress={resetFilters}>
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search wingmen by name, city, language..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {!!searchQuery && (
            <TouchableOpacity
              style={styles.clearSearchButton}
              onPress={async () => {
                await haptics.light();
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.trustNote}>
          <Ionicons name="shield-checkmark" size={14} color={colors.status.success} />
          <Text style={styles.trustNoteText}>All wingmen shown are ID and photo verified.</Text>
        </View>
      </View>

      <FlatList
        data={filteredCompanions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CompanionCard
            companion={item}
            onPress={() => handleCompanionPress(item.id)}
          />
        )}
        numColumns={2}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmptyState}
        columnWrapperStyle={filteredCompanions.length > 1 ? styles.columnWrapper : undefined}
        contentContainerStyle={[
          styles.listContent,
          filteredCompanions.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  title: {
    ...typography.presets.h1,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.sizes.md,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  trustNote: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trustNoteText: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 110,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  controls: {
    marginBottom: spacing.md,
  },
  chipRow: {
    paddingBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary.blue,
  },
  filterChipLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  filterChipLabelActive: {
    color: colors.text.primary,
    fontWeight: typography.weights.semibold as any,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  toggleChipActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(74, 144, 226, 0.12)',
  },
  toggleChipLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
  },
  sortRow: {
    paddingBottom: spacing.xs,
  },
  sortChip: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: spacing.radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  sortChipActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(74, 144, 226, 0.12)',
  },
  sortChipLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  sortChipLabelActive: {
    color: colors.primary.blue,
    fontWeight: typography.weights.semibold as any,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  resultsText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  clearFiltersText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    fontWeight: typography.weights.semibold as any,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.xl,
  },
  centerStateText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  errorSubtitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
