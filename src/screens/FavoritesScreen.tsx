import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Badge, Rating, Button } from '../components';
import type { RootStackParamList, Companion } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FavoriteCompanion extends Companion {
  savedAt: string;
  notes?: string;
  lastBooked?: string;
  bookingCount: number;
}

const mockFavorites: FavoriteCompanion[] = [
  {
    id: '1',
    user: { id: 'u1', firstName: 'Sarah', lastName: 'Johnson', email: '', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.9, reviewCount: 127, hourlyRate: 45, specialties: ['dining', 'social-events', 'concerts'], languages: ['English', 'Spanish'], availability: [], isOnline: true, responseTime: '15 min', completedBookings: 89, badges: [], gallery: [], about: '', interests: ['Travel', 'Food', 'Music'], verificationLevel: 'premium',
    savedAt: '2 weeks ago',
    notes: 'Great for Italian restaurants',
    lastBooked: 'Jan 15, 2024',
    bookingCount: 3,
  },
  {
    id: '2',
    user: { id: 'u2', firstName: 'Michael', lastName: 'Chen', email: '', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', isVerified: true,  isPremium: false, createdAt: '' },
    rating: 4.7, reviewCount: 64, hourlyRate: 35, specialties: ['coffee-chat', 'sports', 'movies'], languages: ['English', 'Mandarin'], availability: [], isOnline: false, responseTime: '30 min', completedBookings: 42, badges: [], gallery: [], about: '', interests: ['Tech', 'Sports', 'Coffee'], verificationLevel: 'verified',
    savedAt: '1 month ago',
    lastBooked: 'Dec 20, 2023',
    bookingCount: 1,
  },
  {
    id: '3',
    user: { id: 'u3', firstName: 'Emma', lastName: 'Wilson', email: '', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400', isVerified: true,  isPremium: true, createdAt: '' },
    rating: 4.8, reviewCount: 89, hourlyRate: 40, specialties: ['concerts', 'movies', 'emotional-support'], languages: ['English', 'French'], availability: [], isOnline: true, responseTime: '1 hour', completedBookings: 56, badges: [], gallery: [], about: '', interests: ['Music', 'Art', 'Reading'], verificationLevel: 'premium',
    savedAt: '3 days ago',
    bookingCount: 0,
  },
];

type SortOption = 'recent' | 'rating' | 'booked';

export const FavoritesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState(mockFavorites);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleRemoveFavorite = async (id: string) => {
    await haptics.warning();
    setFavorites(favorites.filter(f => f.id !== id));
  };

  const handleViewProfile = async (id: string) => {
    await haptics.medium();
    navigation.navigate('CompanionProfile', { companionId: id });
  };

  const handleBookNow = async (id: string) => {
    await haptics.medium();
    navigation.navigate('Booking', { companionId: id });
  };

  const sortedFavorites = [...favorites].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'booked':
        return b.bookingCount - a.bookingCount;
      default:
        return 0;
    }
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Favorites</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="search" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'recent', label: 'Recently Added' },
            { id: 'rating', label: 'Highest Rated' },
            { id: 'booked', label: 'Most Booked' },
          ].map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.sortChip, sortBy === option.id && styles.sortChipActive]}
              onPress={() => {
                haptics.selection();
                setSortBy(option.id as SortOption);
              }}
            >
              <Text style={[
                styles.sortChipText,
                sortBy === option.id && styles.sortChipTextActive,
              ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {sortedFavorites.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={48} color={colors.text.tertiary} />
            </View>
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptySubtitle}>
              Save companions you love for quick access later
            </Text>
            <Button
              title="Browse Companions"
              onPress={() => {
                haptics.medium();
                navigation.navigate('Discover' as any);
              }}
              variant="primary"
              size="medium"
            />
          </View>
        ) : (
          sortedFavorites.map((favorite) => (
            <Card key={favorite.id} variant="outlined" style={styles.favoriteCard}>
              <TouchableOpacity
                style={styles.favoriteContent}
                onPress={() => handleViewProfile(favorite.id)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarSection}>
                  <Image source={{ uri: favorite.user.avatar }} style={styles.avatar} />
                  {favorite.isOnline && <View style={styles.onlineDot} />}
                  {favorite.verificationLevel === 'premium' && (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="star" size={10} color={colors.primary.gold} />
                    </View>
                  )}
                </View>

                <View style={styles.infoSection}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>
                      {favorite.user.firstName} {favorite.user.lastName?.charAt(0)}.
                    </Text>
                    <TouchableOpacity
                      style={styles.heartButton}
                      onPress={() => handleRemoveFavorite(favorite.id)}
                    >
                      <Ionicons name="heart" size={20} color={colors.status.error} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.ratingRow}>
                    <Rating rating={favorite.rating} reviewCount={favorite.reviewCount} size="small" />
                    <Text style={styles.rate}>${favorite.hourlyRate}/hr</Text>
                  </View>

                  <View style={styles.tagsRow}>
                    {favorite.specialties.slice(0, 2).map((specialty, i) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{specialty.replace('-', ' ')}</Text>
                      </View>
                    ))}
                    {favorite.specialties.length > 2 && (
                      <Text style={styles.moreTag}>+{favorite.specialties.length - 2}</Text>
                    )}
                  </View>

                  {favorite.notes && (
                    <View style={styles.notesRow}>
                      <Ionicons name="document-text-outline" size={12} color={colors.text.tertiary} />
                      <Text style={styles.notesText}>{favorite.notes}</Text>
                    </View>
                  )}

                  <View style={styles.statsRow}>
                    <Text style={styles.savedText}>Saved {favorite.savedAt}</Text>
                    {favorite.bookingCount > 0 && (
                      <Text style={styles.bookedText}>
                        • Booked {favorite.bookingCount}x
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => haptics.light()}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary.blue} />
                  <Text style={styles.messageButtonText}>Message</Text>
                </TouchableOpacity>
                <Button
                  title="Book Now"
                  onPress={() => handleBookNow(favorite.id)}
                  variant="primary"
                  size="small"
                  style={styles.bookButton}
                />
              </View>
            </Card>
          ))
        )}

        {/* Collections Suggestion */}
        {favorites.length > 0 && (
          <Card variant="gradient" style={styles.collectionsCard}>
            <Ionicons name="folder-open-outline" size={24} color={colors.primary.blue} />
            <View style={styles.collectionsContent}>
              <Text style={styles.collectionsTitle}>Organize with Collections</Text>
              <Text style={styles.collectionsText}>
                Create collections to group favorites by occasion (Dinners, Events, etc.)
              </Text>
            </View>
            <TouchableOpacity style={styles.collectionsButton} onPress={() => haptics.light()}>
              <Text style={styles.collectionsButtonText}>Create</Text>
            </TouchableOpacity>
          </Card>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sortLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  sortChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.round,
    marginRight: spacing.sm,
  },
  sortChipActive: {
    backgroundColor: colors.primary.blue,
  },
  sortChipText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  sortChipTextActive: {
    color: colors.text.primary,
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.massive,
    paddingHorizontal: spacing.screenPadding,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.presets.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.presets.body,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  favoriteCard: {
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.md,
  },
  favoriteContent: {
    flexDirection: 'row',
  },
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.background.tertiary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.status.success,
    borderWidth: 2,
    borderColor: colors.background.card,
  },
  premiumBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  infoSection: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  heartButton: {
    padding: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rate: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    fontWeight: typography.weights.medium,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius.sm,
  },
  tagText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  moreTag: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.sm,
  },
  notesText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  savedText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  bookedText: {
    ...typography.presets.caption,
    color: colors.status.success,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing.md,
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
  },
  messageButtonText: {
    ...typography.presets.button,
    color: colors.primary.blue,
  },
  bookButton: {
    flex: 1,
  },
  collectionsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.screenPadding,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  collectionsContent: {
    flex: 1,
  },
  collectionsTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  collectionsText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  collectionsButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.blue,
    borderRadius: spacing.radius.md,
  },
  collectionsButtonText: {
    ...typography.presets.buttonSmall,
    color: colors.text.primary,
  },
});
