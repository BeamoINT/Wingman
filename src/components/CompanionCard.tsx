import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Badge } from './Badge';
import { Rating } from './Rating';
import type { Companion } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CompanionCardProps {
  companion: Companion;
  onPress: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

export const CompanionCard: React.FC<CompanionCardProps> = ({
  companion,
  onPress,
  variant = 'default',
}) => {
  const handlePress = async () => {
    await haptics.medium();
    onPress();
  };

  const getSpecialtyLabel = (specialty: string): string => {
    const labels: Record<string, string> = {
      'social-events': '🎉 Social Events',
      'dining': '🍽️ Dining',
      'nightlife': '🌙 Nightlife',
      'movies': '🎬 Movies',
      'concerts': '🎵 Concerts',
      'sports': '⚽ Sports',
      'outdoor-activities': '🏃 Outdoors',
      'shopping': '🛍️ Shopping',
      'travel': '✈️ Travel',
      'coffee-chat': '☕ Coffee',
      'workout-buddy': '💪 Workout',
      'professional-networking': '💼 Networking',
      'emotional-support': '💚 Support',
      'safety-companion': '🛡️ Safety',
    };
    return labels[specialty] || specialty;
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        style={styles.compactCard}
      >
        <Image
          source={{ uri: companion.user.avatar || 'https://via.placeholder.com/80' }}
          style={styles.compactImage}
        />
        <View style={styles.compactInfo}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactName}>{companion.user.firstName}</Text>
            {companion.isOnline && <View style={styles.onlineDot} />}
          </View>
          <Rating rating={companion.rating} reviewCount={companion.reviewCount} size="small" />
          <Text style={styles.compactRate}>${companion.hourlyRate}/hr</Text>
        </View>
        {companion.verificationLevel === 'background' || companion.verificationLevel === 'premium' ? (
          <View style={styles.verifiedIcon}>
            <Ionicons name="shield-checkmark" size={16} color={colors.verification.backgroundChecked} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (variant === 'featured') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={styles.featuredCard}
      >
        <Image
          source={{ uri: companion.user.avatar || 'https://via.placeholder.com/300' }}
          style={styles.featuredImage}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredContent}>
            <View style={styles.featuredBadges}>
              {companion.verificationLevel === 'premium' && (
                <Badge label="Premium" variant="premium" icon="star" />
              )}
              {(companion.verificationLevel === 'background' || companion.verificationLevel === 'premium') && (
                <Badge label="Background Checked" variant="verified" icon="shield-checkmark" />
              )}
            </View>
            <Text style={styles.featuredName}>
              {companion.user.firstName} {companion.user.lastName?.charAt(0)}.
            </Text>
            <View style={styles.featuredDetails}>
              <Rating rating={companion.rating} reviewCount={companion.reviewCount} />
              <Text style={styles.featuredRate}>${companion.hourlyRate}/hr</Text>
            </View>
            <View style={styles.featuredSpecialties}>
              {companion.specialties.slice(0, 3).map((specialty, index) => (
                <Text key={index} style={styles.featuredSpecialty}>
                  {getSpecialtyLabel(specialty)}
                </Text>
              ))}
            </View>
          </View>
        </LinearGradient>
        {companion.isOnline && (
          <View style={styles.featuredOnline}>
            <View style={styles.featuredOnlineDot} />
            <Text style={styles.featuredOnlineText}>Online</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.card}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: companion.user.avatar || 'https://via.placeholder.com/200' }}
          style={styles.image}
        />
        {companion.isOnline && (
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineIndicatorDot} />
          </View>
        )}
        {companion.verificationLevel === 'premium' && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={12} color={colors.primary.gold} />
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.header}>
          <Text style={styles.name}>{companion.user.firstName}</Text>
          {(companion.verificationLevel === 'background' || companion.verificationLevel === 'premium') && (
            <Ionicons name="shield-checkmark" size={14} color={colors.verification.backgroundChecked} />
          )}
        </View>

        <Rating rating={companion.rating} reviewCount={companion.reviewCount} size="small" />

        <View style={styles.specialtiesRow}>
          {companion.specialties.slice(0, 2).map((specialty, index) => (
            <Text key={index} style={styles.specialty}>
              {getSpecialtyLabel(specialty).split(' ')[0]}
            </Text>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.rate}>${companion.hourlyRate}/hr</Text>
          <Text style={styles.responseTime}>{companion.responseTime}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Default card styles
  card: {
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    overflow: 'hidden',
    width: (SCREEN_WIDTH - spacing.screenPadding * 2 - spacing.md) / 2,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background.tertiary,
  },
  onlineIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.background.overlay,
    borderRadius: spacing.radius.round,
    padding: 4,
  },
  onlineIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  premiumBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: spacing.radius.round,
    padding: 6,
    borderWidth: 1,
    borderColor: colors.border.gold,
  },
  info: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  name: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  specialtiesRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  specialty: {
    fontSize: typography.sizes.xxs,
    color: colors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  rate: {
    ...typography.presets.h4,
    color: colors.primary.blue,
  },
  responseTime: {
    fontSize: typography.sizes.xxs,
    color: colors.text.tertiary,
  },

  // Compact card styles
  compactCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  compactImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background.tertiary,
  },
  compactInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  compactName: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  compactRate: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
    marginTop: spacing.xs,
  },
  verifiedIcon: {
    marginLeft: spacing.sm,
  },

  // Featured card styles
  featuredCard: {
    width: SCREEN_WIDTH - spacing.screenPadding * 2,
    height: 320,
    borderRadius: spacing.radius.xl,
    overflow: 'hidden',
    position: 'relative',
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
    height: '60%',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  featuredContent: {},
  featuredBadges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  featuredName: {
    ...typography.presets.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  featuredDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  featuredRate: {
    ...typography.presets.h3,
    color: colors.primary.blue,
  },
  featuredSpecialties: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  featuredSpecialty: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  featuredOnline: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    gap: spacing.xs,
  },
  featuredOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success,
  },
  featuredOnlineText: {
    fontSize: typography.sizes.xs,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
});
