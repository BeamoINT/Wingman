import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { CompanionCard, Badge } from '../components';
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

// Mock data
const mockCompanions: Companion[] = [
  {
    id: '1',
    user: {
      id: 'u1',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah@example.com',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
      isVerified: true,
      isBackgroundChecked: true,
      isPremium: true,
      createdAt: '2024-01-01',
    },
    rating: 4.9,
    reviewCount: 127,
    hourlyRate: 45,
    specialties: ['dining', 'social-events', 'nightlife'],
    languages: ['English', 'Spanish'],
    availability: [],
    isOnline: true,
    responseTime: 'Usually responds within 15 min',
    completedBookings: 89,
    badges: [],
    gallery: [],
    about: '',
    interests: [],
    verificationLevel: 'premium',
  },
  {
    id: '2',
    user: {
      id: 'u2',
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael@example.com',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      isVerified: true,
      isBackgroundChecked: true,
      isPremium: false,
      createdAt: '2024-01-15',
    },
    rating: 4.7,
    reviewCount: 64,
    hourlyRate: 35,
    specialties: ['coffee-chat', 'professional-networking', 'sports'],
    languages: ['English', 'Mandarin'],
    availability: [],
    isOnline: true,
    responseTime: '~1 hour',
    completedBookings: 42,
    badges: [],
    gallery: [],
    about: '',
    interests: [],
    verificationLevel: 'background',
  },
  {
    id: '3',
    user: {
      id: 'u3',
      firstName: 'Emma',
      lastName: 'Wilson',
      email: 'emma@example.com',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
      isVerified: true,
      isBackgroundChecked: true,
      isPremium: true,
      createdAt: '2024-02-01',
    },
    rating: 4.8,
    reviewCount: 89,
    hourlyRate: 40,
    specialties: ['concerts', 'movies', 'emotional-support'],
    languages: ['English'],
    availability: [],
    isOnline: false,
    responseTime: '~30 min',
    completedBookings: 56,
    badges: [],
    gallery: [],
    about: '',
    interests: [],
    verificationLevel: 'premium',
  },
  {
    id: '4',
    user: {
      id: 'u4',
      firstName: 'James',
      lastName: 'Rodriguez',
      email: 'james@example.com',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
      isVerified: true,
      isBackgroundChecked: true,
      isPremium: false,
      createdAt: '2024-02-15',
    },
    rating: 4.6,
    reviewCount: 38,
    hourlyRate: 30,
    specialties: ['sports', 'outdoor-activities', 'workout-buddy'],
    languages: ['English', 'Portuguese'],
    availability: [],
    isOnline: true,
    responseTime: '~45 min',
    completedBookings: 28,
    badges: [],
    gallery: [],
    about: '',
    interests: [],
    verificationLevel: 'background',
  },
];

export const DiscoverScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const handleCompanionPress = async (companionId: string) => {
    await haptics.medium();
    navigation.navigate('CompanionProfile', { companionId });
  };

  const handleFilterPress = async (filterId: string) => {
    await haptics.selection();
    setActiveFilter(filterId);
  };

  const filteredCompanions = mockCompanions.filter((companion) => {
    if (activeFilter === 'all') return true;
    return companion.specialties.includes(activeFilter as CompanionSpecialty);
  });

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
          <TouchableOpacity style={styles.filterButton} onPress={() => haptics.light()}>
            <Ionicons name="options" size={20} color={colors.primary.blue} />
          </TouchableOpacity>
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
      >
        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredCompanions.length} companions available
          </Text>
          <TouchableOpacity style={styles.sortButton} onPress={() => haptics.light()}>
            <Text style={styles.sortText}>Sort by: Rating</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Companion Grid */}
        <View style={styles.companionGrid}>
          {filteredCompanions.map((companion) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              onPress={() => handleCompanionPress(companion.id)}
            />
          ))}
        </View>

        {/* Load More */}
        <TouchableOpacity style={styles.loadMore} onPress={() => haptics.light()}>
          <Text style={styles.loadMoreText}>Load more</Text>
        </TouchableOpacity>
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
  loadMore: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
  },
  loadMoreText: {
    ...typography.presets.button,
    color: colors.primary.blue,
  },
});
