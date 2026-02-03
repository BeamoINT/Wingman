import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { CompanionCard, EmptySearchResults } from '../components';
import { fetchCompanions, searchCompanions } from '../services/api/companions';
import type { CompanionData } from '../services/api/companions';
import type { RootStackParamList, Companion, CompanionSpecialty } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const filters = [
  { id: 'all', label: 'All', icon: 'apps' },
  { id: 'dining', label: 'Dining', icon: 'restaurant' },
  { id: 'nightlife', label: 'Nightlife', icon: 'wine' },
  { id: 'coffee-chat', label: 'Coffee', icon: 'cafe' },
  { id: 'sports', label: 'Sports', icon: 'fitness' },
  { id: 'movies', label: 'Movies', icon: 'film' },
  { id: 'safety-companion', label: 'Safety', icon: 'shield' },
];

/**
 * Transform API companion data to our Companion type
 */
function transformCompanionData(data: CompanionData): Companion {
  return {
    id: data.id,
    user: {
      id: data.user_id,
      firstName: data.user?.first_name || '',
      lastName: data.user?.last_name || '',
      email: data.user?.email || '',
      avatar: data.user?.avatar_url,
      isVerified: data.user?.phone_verified || false,
      isPremium: data.user?.subscription_tier !== 'free',
      createdAt: data.user?.created_at || data.created_at,
    },
    rating: data.rating || 0,
    reviewCount: data.review_count || 0,
    hourlyRate: data.hourly_rate,
    specialties: (data.specialties || []) as CompanionSpecialty[],
    languages: data.languages || [],
    availability: [],
    isOnline: data.is_available,
    responseTime: data.response_time || 'Usually responds within 1 hour',
    completedBookings: data.completed_bookings || 0,
    badges: [],
    gallery: data.gallery || [],
    about: data.about || '',
    interests: [],
    verificationLevel: data.user?.verification_level as any || 'basic',
  };
}

export const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCompanions = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const filters: any = { isAvailable: true };

      if (activeFilter !== 'all') {
        filters.specialty = activeFilter;
      }

      const { companions: data, error: apiError } = await fetchCompanions(filters);

      if (apiError) {
        setError('Failed to load companions');
        console.error('Error loading companions:', apiError);
      } else {
        setCompanions(data.map(transformCompanionData));
      }
    } catch (err) {
      setError('Something went wrong');
      console.error('Error in loadCompanions:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeFilter]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      loadCompanions();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { companions: data, error: apiError } = await searchCompanions(searchQuery);

      if (apiError) {
        setError('Search failed');
      } else {
        setCompanions(data.map(transformCompanionData));
      }
    } catch (err) {
      setError('Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, loadCompanions]);

  useEffect(() => {
    loadCompanions();
  }, [loadCompanions]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, handleSearch]);

  const handleCompanionPress = async (companionId: string) => {
    await haptics.medium();
    navigation.navigate('CompanionProfile', { companionId });
  };

  const handleFilterPress = async (filterId: string) => {
    await haptics.selection();
    setActiveFilter(filterId);
  };

  const handleRefresh = () => {
    loadCompanions(true);
  };

  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.blue} />
          <Text style={styles.loadingText}>Finding companions...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadCompanions()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (companions.length === 0) {
      return (
        <EmptySearchResults
          query={searchQuery}
          onClearSearch={() => {
            setSearchQuery('');
            setActiveFilter('all');
          }}
        />
      );
    }

    return (
      <>
        <View style={styles.companionGrid}>
          {companions.map((companion) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              onPress={() => handleCompanionPress(companion.id)}
            />
          ))}
        </View>
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.title}>Discover</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search companions..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.filterButton} onPress={async () => await haptics.light()}>
              <Ionicons name="options" size={20} color={colors.primary.blue} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                activeFilter === filter.id && styles.filterChipActive,
              ]}
              onPress={() => handleFilterPress(filter.id)}
            >
              <Ionicons
                name={filter.icon as any}
                size={16}
                color={activeFilter === filter.id ? colors.text.primary : colors.text.tertiary}
              />
              <Text
                style={[
                  styles.filterLabel,
                  activeFilter === filter.id && styles.filterLabelActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary.blue}
          />
        }
      >
        {/* Results Count */}
        {!isLoading && !error && companions.length > 0 && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {companions.length} companion{companions.length !== 1 ? 's' : ''} available
            </Text>
            <TouchableOpacity style={styles.sortButton} onPress={async () => await haptics.light()}>
              <Text style={styles.sortText}>Sort by: Rating</Text>
              <Ionicons name="chevron-down" size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {renderContent()}
      </ScrollView>
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
    marginBottom: spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  filterButton: {
    padding: spacing.sm,
  },
  clearButton: {
    padding: spacing.sm,
  },
  filtersContent: {
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.round,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary.blue,
  },
  filterLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  filterLabelActive: {
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.screenPadding,
    paddingBottom: 100,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  resultsCount: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sortText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  errorText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  retryButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
  },
  retryText: {
    ...typography.presets.button,
    color: colors.text.primary,
  },
});
