import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  icon: string;
  category: 'discount' | 'upgrade' | 'experience' | 'gift';
  isAvailable: boolean;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  maxProgress: number;
  pointsReward: number;
  isCompleted: boolean;
}

const mockRewards: Reward[] = [
  { id: '1', title: '$10 Off Next Booking', description: 'Apply to any booking over $50', pointsCost: 500, icon: 'pricetag', category: 'discount', isAvailable: true },
  { id: '2', title: 'Free Hour Extension', description: 'Add an extra hour to your booking', pointsCost: 750, icon: 'time', category: 'discount', isAvailable: true },
  { id: '3', title: 'Priority Matching', description: '1 week of priority companion matching', pointsCost: 1000, icon: 'flash', category: 'upgrade', isAvailable: true },
  { id: '4', title: 'VIP Event Access', description: 'Exclusive invite to member events', pointsCost: 1500, icon: 'star', category: 'experience', isAvailable: false },
  { id: '5', title: 'Gift a Booking', description: 'Send a free booking to a friend', pointsCost: 2000, icon: 'gift', category: 'gift', isAvailable: false },
  { id: '6', title: '1 Month Premium', description: 'Free Premium subscription upgrade', pointsCost: 5000, icon: 'diamond', category: 'upgrade', isAvailable: false },
];

const mockAchievements: Achievement[] = [
  { id: '1', title: 'First Timer', description: 'Complete your first booking', icon: 'rocket', progress: 1, maxProgress: 1, pointsReward: 100, isCompleted: true },
  { id: '2', title: 'Social Butterfly', description: 'Complete 10 bookings', icon: 'butterfly', progress: 7, maxProgress: 10, pointsReward: 500, isCompleted: false },
  { id: '3', title: 'Regular', description: 'Book 3 times in a month', icon: 'calendar', progress: 2, maxProgress: 3, pointsReward: 200, isCompleted: false },
  { id: '4', title: 'Explorer', description: 'Try 5 different activities', icon: 'compass', progress: 3, maxProgress: 5, pointsReward: 300, isCompleted: false },
  { id: '5', title: 'Reviewer', description: 'Leave 5 reviews', icon: 'star-half', progress: 5, maxProgress: 5, pointsReward: 150, isCompleted: true },
  { id: '6', title: 'Streak Master', description: 'Book for 4 consecutive weeks', icon: 'flame', progress: 2, maxProgress: 4, pointsReward: 400, isCompleted: false },
];

export const RewardsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const userPoints = 1250;
  const tierProgress = 75; // percentage to next tier
  const currentTier = 'Silver';
  const nextTier = 'Gold';

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!reward.isAvailable || reward.pointsCost > userPoints) return;
    await haptics.success();
    // Handle redemption
  };

  const getCategoryColor = (category: Reward['category']) => {
    switch (category) {
      case 'discount': return colors.primary.blue;
      case 'upgrade': return colors.primary.gold;
      case 'experience': return colors.verification.trusted;
      case 'gift': return colors.status.success;
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rewards</Text>
        <TouchableOpacity onPress={() => haptics.light()}>
          <Ionicons name="help-circle-outline" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Points Card */}
        <View style={styles.section}>
          <LinearGradient
            colors={colors.gradients.premium}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pointsCard}
          >
            <View style={styles.pointsHeader}>
              <View>
                <Text style={styles.pointsLabel}>Your Points</Text>
                <Text style={styles.pointsValue}>{userPoints.toLocaleString()}</Text>
              </View>
              <View style={styles.tierBadge}>
                <Ionicons name="medal" size={20} color={colors.primary.darkBlack} />
                <Text style={styles.tierText}>{currentTier}</Text>
              </View>
            </View>

            <View style={styles.tierProgress}>
              <View style={styles.tierProgressBar}>
                <View style={[styles.tierProgressFill, { width: `${tierProgress}%` }]} />
              </View>
              <Text style={styles.tierProgressText}>
                {100 - tierProgress}% to {nextTier}
              </Text>
            </View>

            <View style={styles.pointsActions}>
              <TouchableOpacity style={styles.pointsAction} onPress={() => haptics.light()}>
                <Ionicons name="time-outline" size={18} color={colors.primary.darkBlack} />
                <Text style={styles.pointsActionText}>History</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pointsAction} onPress={() => haptics.light()}>
                <Ionicons name="share-outline" size={18} color={colors.primary.darkBlack} />
                <Text style={styles.pointsActionText}>Earn More</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Earn */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Ways to Earn</Text>
          <View style={styles.earnGrid}>
            <Card style={styles.earnCard}>
              <Ionicons name="person-add" size={24} color={colors.primary.blue} />
              <Text style={styles.earnPoints}>+500</Text>
              <Text style={styles.earnLabel}>Refer a Friend</Text>
            </Card>
            <Card style={styles.earnCard}>
              <Ionicons name="star" size={24} color={colors.primary.gold} />
              <Text style={styles.earnPoints}>+50</Text>
              <Text style={styles.earnLabel}>Leave a Review</Text>
            </Card>
            <Card style={styles.earnCard}>
              <Ionicons name="checkmark-circle" size={24} color={colors.status.success} />
              <Text style={styles.earnPoints}>+100</Text>
              <Text style={styles.earnLabel}>Complete Booking</Text>
            </Card>
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <TouchableOpacity onPress={() => haptics.light()}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsScroll}
          >
            {mockAchievements.map((achievement) => (
              <Card
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  achievement.isCompleted && styles.achievementCardCompleted,
                ]}
              >
                <View style={[
                  styles.achievementIcon,
                  achievement.isCompleted && styles.achievementIconCompleted,
                ]}>
                  <Ionicons
                    name={achievement.icon as any}
                    size={24}
                    color={achievement.isCompleted ? colors.primary.gold : colors.text.tertiary}
                  />
                </View>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription} numberOfLines={2}>
                  {achievement.description}
                </Text>

                {!achievement.isCompleted && (
                  <View style={styles.achievementProgress}>
                    <View style={styles.achievementProgressBar}>
                      <View
                        style={[
                          styles.achievementProgressFill,
                          { width: `${(achievement.progress / achievement.maxProgress) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.achievementProgressText}>
                      {achievement.progress}/{achievement.maxProgress}
                    </Text>
                  </View>
                )}

                <View style={styles.achievementReward}>
                  <Ionicons name="star" size={12} color={colors.primary.gold} />
                  <Text style={styles.achievementRewardText}>
                    +{achievement.pointsReward} pts
                  </Text>
                </View>

                {achievement.isCompleted && (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark" size={12} color={colors.text.primary} />
                  </View>
                )}
              </Card>
            ))}
          </ScrollView>
        </View>

        {/* Rewards Catalog */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Redeem Rewards</Text>

          {mockRewards.map((reward) => {
            const canRedeem = reward.isAvailable && reward.pointsCost <= userPoints;

            return (
              <Card key={reward.id} variant="outlined" style={styles.rewardCard}>
                <View style={styles.rewardContent}>
                  <View style={[
                    styles.rewardIcon,
                    { backgroundColor: `${getCategoryColor(reward.category)}20` },
                  ]}>
                    <Ionicons
                      name={reward.icon as any}
                      size={24}
                      color={getCategoryColor(reward.category)}
                    />
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text style={styles.rewardTitle}>{reward.title}</Text>
                    <Text style={styles.rewardDescription}>{reward.description}</Text>
                  </View>
                </View>

                <View style={styles.rewardFooter}>
                  <View style={styles.rewardCost}>
                    <Ionicons name="star" size={14} color={colors.primary.gold} />
                    <Text style={styles.rewardCostText}>
                      {reward.pointsCost.toLocaleString()} pts
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.redeemButton,
                      canRedeem && styles.redeemButtonActive,
                    ]}
                    onPress={() => handleRedeemReward(reward)}
                    disabled={!canRedeem}
                  >
                    <Text style={[
                      styles.redeemText,
                      canRedeem && styles.redeemTextActive,
                    ]}>
                      {canRedeem ? 'Redeem' : 'Locked'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Tier Benefits */}
        <View style={styles.section}>
          <Card variant="gradient" style={styles.benefitsCard}>
            <View style={styles.benefitsHeader}>
              <Ionicons name="medal" size={24} color={colors.primary.gold} />
              <Text style={styles.benefitsTitle}>Gold Tier Benefits</Text>
            </View>
            <Text style={styles.benefitsSubtitle}>
              Reach Gold tier to unlock exclusive perks
            </Text>
            <View style={styles.benefitsList}>
              {['2x points on bookings', 'Exclusive events access', 'Priority support', 'Monthly bonus rewards'].map((benefit, i) => (
                <View key={i} style={styles.benefitItem}>
                  <Ionicons name="checkmark" size={14} color={colors.status.success} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
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
  section: {
    padding: spacing.screenPadding,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  seeAllText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  pointsCard: {
    padding: spacing.xl,
    borderRadius: spacing.radius.xl,
  },
  pointsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  pointsLabel: {
    ...typography.presets.bodySmall,
    color: colors.primary.darkBlack,
    opacity: 0.8,
  },
  pointsValue: {
    ...typography.presets.hero,
    color: colors.primary.darkBlack,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
  },
  tierText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.darkBlack,
  },
  tierProgress: {
    marginBottom: spacing.lg,
  },
  tierProgressBar: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    marginBottom: spacing.xs,
  },
  tierProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.darkBlack,
    borderRadius: 3,
  },
  tierProgressText: {
    ...typography.presets.caption,
    color: colors.primary.darkBlack,
    opacity: 0.8,
  },
  pointsActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pointsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
  },
  pointsActionText: {
    ...typography.presets.buttonSmall,
    color: colors.primary.darkBlack,
  },
  earnGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  earnCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
  },
  earnPoints: {
    ...typography.presets.h3,
    color: colors.primary.gold,
    marginTop: spacing.sm,
  },
  earnLabel: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  achievementsScroll: {
    paddingRight: spacing.screenPadding,
  },
  achievementCard: {
    width: 140,
    alignItems: 'center',
    padding: spacing.lg,
    marginRight: spacing.md,
    position: 'relative',
  },
  achievementCardCompleted: {
    borderWidth: 1,
    borderColor: colors.primary.gold,
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  achievementIconCompleted: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  achievementTitle: {
    ...typography.presets.bodySmall,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  achievementDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
    height: 32,
  },
  achievementProgress: {
    width: '100%',
    marginTop: spacing.sm,
  },
  achievementProgressBar: {
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    marginBottom: 4,
  },
  achievementProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.blue,
    borderRadius: 2,
  },
  achievementProgressText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    fontSize: 10,
  },
  achievementReward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.sm,
  },
  achievementRewardText: {
    ...typography.presets.caption,
    color: colors.primary.gold,
    fontSize: 10,
  },
  completedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.status.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardCard: {
    marginBottom: spacing.md,
  },
  rewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  rewardDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  rewardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  rewardCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rewardCostText: {
    ...typography.presets.body,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
  },
  redeemButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
  },
  redeemButtonActive: {
    backgroundColor: colors.primary.blue,
  },
  redeemText: {
    ...typography.presets.buttonSmall,
    color: colors.text.tertiary,
  },
  redeemTextActive: {
    color: colors.text.primary,
  },
  benefitsCard: {
    padding: spacing.xl,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  benefitsTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  benefitsSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  benefitsList: {
    gap: spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
});
