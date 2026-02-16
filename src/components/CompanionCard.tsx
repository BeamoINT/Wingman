import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { Companion } from '../types';
import { haptics } from '../utils/haptics';
import { Badge } from './Badge';
import { Rating } from './Rating';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CompanionCardProps {
  companion: Companion;
  onPress: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

const specialtyLabels: Record<string, string> = {
  'social-events': 'Social Events',
  dining: 'Dining',
  nightlife: 'Nightlife',
  movies: 'Movies',
  concerts: 'Concerts',
  sports: 'Sports',
  'outdoor-activities': 'Outdoors',
  shopping: 'Shopping',
  travel: 'Travel',
  'coffee-chat': 'Coffee',
  'workout-buddy': 'Workout',
  'professional-networking': 'Networking',
  'emotional-support': 'Support',
  'safety-companion': 'Safety',
};

function getSpecialtyLabel(specialty: string): string {
  return specialtyLabels[specialty] || specialty;
}

export const CompanionCard: React.FC<CompanionCardProps> = ({
  companion,
  onPress,
  variant = 'default',
}) => {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const styles = useThemedStyles((themeTokens) => StyleSheet.create({
    card: {
      backgroundColor: themeTokens.colors.surface.level1,
      borderRadius: themeTokens.spacing.radius.md,
      overflow: 'hidden',
      width: (SCREEN_WIDTH - themeTokens.spacing.screenPadding * 2 - themeTokens.spacing.sm) / 2,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
    },
    imageContainer: {
      position: 'relative',
    },
    image: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: themeTokens.colors.surface.level2,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeTokens.colors.surface.level2,
    },
    defaultFallbackInitials: {
      ...themeTokens.typography.presets.h3,
      color: themeTokens.colors.text.secondary,
    },
    onlineIndicator: {
      position: 'absolute',
      top: themeTokens.spacing.xs,
      right: themeTokens.spacing.xs,
      backgroundColor: themeTokens.colors.surface.level0,
      borderRadius: themeTokens.spacing.radius.round,
      padding: 4,
    },
    onlineIndicatorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: themeTokens.colors.status.success,
    },
    premiumBadge: {
      position: 'absolute',
      top: themeTokens.spacing.xs,
      left: themeTokens.spacing.xs,
      backgroundColor: themeTokens.colors.surface.level0,
      borderRadius: themeTokens.spacing.radius.round,
      padding: 5,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
    },
    info: {
      padding: themeTokens.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.accent.primary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: themeTokens.spacing.xs,
      marginBottom: themeTokens.spacing.xs,
    },
    name: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
      flex: 1,
    },
    specialtiesRow: {
      flexDirection: 'row',
      gap: themeTokens.spacing.xs,
      marginTop: themeTokens.spacing.xs,
      marginBottom: themeTokens.spacing.xs,
    },
    specialty: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      backgroundColor: themeTokens.colors.surface.level2,
      paddingHorizontal: themeTokens.spacing.xs,
      paddingVertical: 2,
      borderRadius: themeTokens.spacing.radius.sm,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: themeTokens.spacing.xs,
    },
    rate: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
    },
    responseTime: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.tertiary,
    },
    compactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeTokens.colors.surface.level1,
      borderRadius: themeTokens.spacing.radius.md,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
      padding: themeTokens.spacing.sm,
      gap: themeTokens.spacing.sm,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.accent.primary,
    },
    compactImage: {
      width: 56,
      height: 56,
      borderRadius: themeTokens.spacing.radius.sm,
      backgroundColor: themeTokens.colors.surface.level2,
    },
    compactFallbackInitials: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.secondary,
    },
    compactInfo: {
      flex: 1,
      gap: 2,
    },
    compactHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: themeTokens.spacing.xs,
    },
    compactName: {
      ...themeTokens.typography.presets.bodyMedium,
      color: themeTokens.colors.text.primary,
      flex: 1,
    },
    onlineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: themeTokens.colors.status.success,
    },
    compactRate: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
    },
    verifiedIcon: {
      width: 28,
      alignItems: 'flex-end',
    },
    featuredCard: {
      backgroundColor: themeTokens.colors.surface.level1,
      borderRadius: themeTokens.spacing.radius.lg,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.light,
      overflow: 'hidden',
    },
    featuredImage: {
      width: '100%',
      height: 250,
      backgroundColor: themeTokens.colors.surface.level2,
    },
    featuredOverlay: {
      padding: themeTokens.spacing.md,
      borderTopWidth: 1,
      borderTopColor: themeTokens.colors.border.subtle,
      borderLeftWidth: 3,
      borderLeftColor: themeTokens.colors.accent.primary,
      gap: themeTokens.spacing.sm,
    },
    featuredTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: themeTokens.spacing.sm,
    },
    featuredName: {
      ...themeTokens.typography.presets.h3,
      color: themeTokens.colors.text.primary,
      flex: 1,
    },
    featuredBadges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: themeTokens.spacing.xs,
    },
    featuredDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: themeTokens.spacing.sm,
    },
    featuredRate: {
      ...themeTokens.typography.presets.h4,
      color: themeTokens.colors.text.primary,
    },
    featuredSpecialties: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: themeTokens.spacing.xs,
    },
    featuredSpecialty: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
      backgroundColor: themeTokens.colors.surface.level2,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
      borderRadius: themeTokens.spacing.radius.sm,
      paddingHorizontal: themeTokens.spacing.xs,
      paddingVertical: 2,
    },
    featuredOnline: {
      position: 'absolute',
      top: themeTokens.spacing.sm,
      right: themeTokens.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeTokens.colors.surface.level0,
      borderRadius: themeTokens.spacing.radius.round,
      borderWidth: 1,
      borderColor: themeTokens.colors.border.subtle,
      paddingHorizontal: themeTokens.spacing.xs,
      paddingVertical: 4,
      gap: 5,
    },
    featuredOnlineDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: themeTokens.colors.status.success,
    },
    featuredOnlineText: {
      ...themeTokens.typography.presets.caption,
      color: themeTokens.colors.text.secondary,
    },
  }));

  const handlePress = async () => {
    await haptics.medium();
    onPress();
  };

  const initials = `${companion.user.firstName?.charAt(0) || ''}${companion.user.lastName?.charAt(0) || ''}`
    .toUpperCase() || 'W';

  const renderAvatar = (style: object, textStyle: object) => {
    if (companion.user.avatar) {
      return (
        <Image
          source={{ uri: companion.user.avatar }}
          style={style}
        />
      );
    }

    return (
      <View style={[style, styles.avatarFallback]}>
        <Text style={textStyle}>{initials}</Text>
      </View>
    );
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.compactCard}>
        {renderAvatar(styles.compactImage, styles.compactFallbackInitials)}
        <View style={styles.compactInfo}>
          <View style={styles.compactHeader}>
            <Text style={styles.compactName}>{companion.user.firstName}</Text>
            {companion.isOnline ? <View style={styles.onlineDot} /> : null}
          </View>
          <Rating rating={companion.rating} reviewCount={companion.reviewCount} size="small" />
          <Text style={styles.compactRate}>${companion.hourlyRate}/hr</Text>
        </View>
        {(companion.verificationLevel === 'verified' || companion.verificationLevel === 'premium') ? (
          <View style={styles.verifiedIcon}>
            <Ionicons name="shield-checkmark" size={16} color={colors.status.success} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  if (variant === 'featured') {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9} style={styles.featuredCard}>
        {renderAvatar(styles.featuredImage, styles.defaultFallbackInitials)}
        <View style={styles.featuredOverlay}>
          <View style={styles.featuredTop}>
            <Text style={styles.featuredName}>
              {companion.user.firstName} {companion.user.lastName?.charAt(0)}.
            </Text>
            <Text style={styles.featuredRate}>${companion.hourlyRate}/hr</Text>
          </View>

          <View style={styles.featuredBadges}>
            {(companion.verificationLevel === 'verified' || companion.verificationLevel === 'premium') ? (
              <Badge label="ID Verified" variant="verified" icon="shield-checkmark" />
            ) : null}
            {companion.verificationLevel === 'premium' ? (
              <Badge label="Premium" variant="premium" icon="sparkles" />
            ) : null}
          </View>

          <View style={styles.featuredDetails}>
            <Rating rating={companion.rating} reviewCount={companion.reviewCount} />
          </View>

          <View style={styles.featuredSpecialties}>
            {companion.specialties.slice(0, 3).map((specialty, index) => (
              <Text key={index} style={styles.featuredSpecialty}>
                {getSpecialtyLabel(specialty)}
              </Text>
            ))}
          </View>
        </View>

        {companion.isOnline ? (
          <View style={styles.featuredOnline}>
            <View style={styles.featuredOnlineDot} />
            <Text style={styles.featuredOnlineText}>Online</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.85} style={styles.card}>
      <View style={styles.imageContainer}>
        {renderAvatar(styles.image, styles.defaultFallbackInitials)}

        {companion.isOnline ? (
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineIndicatorDot} />
          </View>
        ) : null}

        {companion.verificationLevel === 'premium' ? (
          <View style={styles.premiumBadge}>
            <Ionicons name="sparkles" size={12} color={colors.accent.primary} />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <View style={styles.header}>
          <Text style={styles.name}>{companion.user.firstName}</Text>
          {(companion.verificationLevel === 'verified' || companion.verificationLevel === 'premium') ? (
            <Ionicons name="shield-checkmark" size={14} color={colors.status.success} />
          ) : null}
        </View>

        <Rating rating={companion.rating} reviewCount={companion.reviewCount} size="small" />

        <View style={styles.specialtiesRow}>
          {companion.specialties.slice(0, 2).map((specialty, index) => (
            <Text key={index} style={styles.specialty}>
              {getSpecialtyLabel(specialty)}
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

