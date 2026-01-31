import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Badge, Button } from '../components';
import type { RootStackParamList } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Event {
  id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  time: string;
  location: string;
  attendees: number;
  maxAttendees: number;
  price: number;
  category: 'mixer' | 'activity' | 'workshop' | 'exclusive';
  isPremiumOnly: boolean;
  isRSVPd: boolean;
}

const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Premium Members Mixer',
    description: 'Meet fellow Wingman members in a relaxed, upscale setting. Enjoy appetizers, drinks, and great conversation.',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600',
    date: 'Sat, Mar 16',
    time: '7:00 PM',
    location: 'The Grand Ballroom, Downtown',
    attendees: 45,
    maxAttendees: 60,
    price: 0,
    category: 'mixer',
    isPremiumOnly: true,
    isRSVPd: false,
  },
  {
    id: '2',
    title: 'Wine Tasting Experience',
    description: 'Explore fine wines from Napa Valley with our expert sommelier. Perfect for wine lovers and newcomers alike.',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600',
    date: 'Sun, Mar 17',
    time: '5:00 PM',
    location: 'Vintage Wine Bar',
    attendees: 18,
    maxAttendees: 24,
    price: 45,
    category: 'activity',
    isPremiumOnly: false,
    isRSVPd: true,
  },
  {
    id: '3',
    title: 'Cooking Class: Italian Cuisine',
    description: 'Learn to make authentic pasta from scratch with Chef Marco. All skill levels welcome!',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600',
    date: 'Wed, Mar 20',
    time: '6:30 PM',
    location: 'Culinary Arts Center',
    attendees: 8,
    maxAttendees: 12,
    price: 75,
    category: 'workshop',
    isPremiumOnly: false,
    isRSVPd: false,
  },
  {
    id: '4',
    title: 'Elite Rooftop Gala',
    description: 'An exclusive evening for our Elite members featuring live music, gourmet dining, and stunning city views.',
    image: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600',
    date: 'Fri, Mar 22',
    time: '8:00 PM',
    location: 'Sky Lounge, Penthouse',
    attendees: 32,
    maxAttendees: 50,
    price: 0,
    category: 'exclusive',
    isPremiumOnly: true,
    isRSVPd: false,
  },
];

const categories = [
  { id: 'all', label: 'All Events', icon: 'apps' },
  { id: 'mixer', label: 'Mixers', icon: 'people' },
  { id: 'activity', label: 'Activities', icon: 'wine' },
  { id: 'workshop', label: 'Workshops', icon: 'school' },
  { id: 'exclusive', label: 'Exclusive', icon: 'star' },
];

export const EventsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState('all');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleRSVP = async (eventId: string) => {
    await haptics.success();
    // Handle RSVP
  };

  const getCategoryColor = (category: Event['category']) => {
    switch (category) {
      case 'mixer': return colors.primary.blue;
      case 'activity': return colors.verification.trusted;
      case 'workshop': return colors.status.success;
      case 'exclusive': return colors.primary.gold;
    }
  };

  const filteredEvents = activeCategory === 'all'
    ? mockEvents
    : mockEvents.filter(e => e.category === activeCategory);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="calendar-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                activeCategory === category.id && styles.categoryChipActive,
              ]}
              onPress={() => {
                haptics.selection();
                setActiveCategory(category.id);
              }}
            >
              <Ionicons
                name={category.icon as any}
                size={16}
                color={activeCategory === category.id ? colors.text.primary : colors.text.tertiary}
              />
              <Text style={[
                styles.categoryLabel,
                activeCategory === category.id && styles.categoryLabelActive,
              ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Event */}
        {activeCategory === 'all' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured</Text>
            <TouchableOpacity
              style={styles.featuredCard}
              onPress={() => haptics.medium()}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: mockEvents[0].image }}
                style={styles.featuredImage}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.9)']}
                style={styles.featuredGradient}
              >
                <Badge
                  label="Premium Only"
                  variant="premium"
                  icon="star"
                  size="small"
                />
                <Text style={styles.featuredTitle}>{mockEvents[0].title}</Text>
                <View style={styles.featuredMeta}>
                  <View style={styles.featuredMetaItem}>
                    <Ionicons name="calendar" size={14} color={colors.text.secondary} />
                    <Text style={styles.featuredMetaText}>{mockEvents[0].date}</Text>
                  </View>
                  <View style={styles.featuredMetaItem}>
                    <Ionicons name="location" size={14} color={colors.text.secondary} />
                    <Text style={styles.featuredMetaText} numberOfLines={1}>
                      {mockEvents[0].location}
                    </Text>
                  </View>
                </View>
                <View style={styles.featuredFooter}>
                  <View style={styles.attendeesInfo}>
                    <View style={styles.attendeeAvatars}>
                      {[1, 2, 3].map((_, i) => (
                        <View key={i} style={[styles.attendeeAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                          <Ionicons name="person" size={12} color={colors.text.tertiary} />
                        </View>
                      ))}
                    </View>
                    <Text style={styles.attendeesText}>
                      {mockEvents[0].attendees} attending
                    </Text>
                  </View>
                  <Button
                    title="RSVP Free"
                    onPress={() => handleRSVP(mockEvents[0].id)}
                    variant="gold"
                    size="small"
                  />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Events List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {activeCategory === 'all' ? 'Upcoming Events' : `${categories.find(c => c.id === activeCategory)?.label}`}
          </Text>

          {filteredEvents.map((event) => (
            <Card key={event.id} variant="outlined" style={styles.eventCard}>
              <View style={styles.eventContent}>
                <Image source={{ uri: event.image }} style={styles.eventImage} />
                <View style={styles.eventInfo}>
                  <View style={styles.eventHeader}>
                    <View style={[
                      styles.categoryDot,
                      { backgroundColor: getCategoryColor(event.category) },
                    ]} />
                    {event.isPremiumOnly && (
                      <Ionicons name="star" size={12} color={colors.primary.gold} />
                    )}
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
                  <View style={styles.eventMeta}>
                    <Text style={styles.eventDate}>{event.date} • {event.time}</Text>
                  </View>
                  <View style={styles.eventMeta}>
                    <Ionicons name="location-outline" size={12} color={colors.text.tertiary} />
                    <Text style={styles.eventLocation} numberOfLines={1}>{event.location}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.eventFooter}>
                <View style={styles.eventStats}>
                  <View style={styles.attendeesBadge}>
                    <Ionicons name="people" size={12} color={colors.text.secondary} />
                    <Text style={styles.attendeesCount}>
                      {event.attendees}/{event.maxAttendees}
                    </Text>
                  </View>
                  <Text style={styles.eventPrice}>
                    {event.price === 0 ? 'Free' : `$${event.price}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.rsvpButton,
                    event.isRSVPd && styles.rsvpButtonActive,
                  ]}
                  onPress={() => handleRSVP(event.id)}
                >
                  <Text style={[
                    styles.rsvpText,
                    event.isRSVPd && styles.rsvpTextActive,
                  ]}>
                    {event.isRSVPd ? 'Going' : 'RSVP'}
                  </Text>
                  {event.isRSVPd && (
                    <Ionicons name="checkmark" size={14} color={colors.status.success} />
                  )}
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>

        {/* Host Your Own Event */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.hostCard}>
            <View style={styles.hostIcon}>
              <Ionicons name="add-circle" size={32} color={colors.primary.blue} />
            </View>
            <View style={styles.hostContent}>
              <Text style={styles.hostTitle}>Host Your Own Event</Text>
              <Text style={styles.hostDescription}>
                Create a group activity and invite other Wingman members to join!
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
          </Card>
        </View>
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
  scrollView: {
    flex: 1,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.round,
    marginRight: spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: colors.primary.blue,
  },
  categoryLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  categoryLabelActive: {
    color: colors.text.primary,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  featuredCard: {
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    height: 280,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  featuredGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  featuredTitle: {
    ...typography.presets.h2,
    color: colors.text.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  featuredMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  featuredMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  featuredMetaText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  featuredFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  attendeeAvatars: {
    flexDirection: 'row',
  },
  attendeeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  attendeesText: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  eventCard: {
    marginBottom: spacing.md,
  },
  eventContent: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  eventImage: {
    width: 80,
    height: 80,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.background.tertiary,
  },
  eventInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  eventDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
  },
  eventLocation: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    flex: 1,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  eventStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  attendeesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  attendeesCount: {
    ...typography.presets.caption,
    color: colors.text.secondary,
  },
  eventPrice: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  rsvpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
  },
  rsvpButtonActive: {
    backgroundColor: colors.status.successLight,
  },
  rsvpText: {
    ...typography.presets.buttonSmall,
    color: colors.text.secondary,
  },
  rsvpTextActive: {
    color: colors.status.success,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  hostIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostContent: {
    flex: 1,
  },
  hostTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  hostDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
