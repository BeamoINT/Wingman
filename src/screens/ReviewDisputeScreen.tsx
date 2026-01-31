import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Button, Badge, Rating } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DisputeCase {
  id: string;
  bookingId: string;
  companionName: string;
  companionAvatar: string;
  date: string;
  type: 'refund' | 'behavior' | 'no-show' | 'safety' | 'other';
  status: 'open' | 'in-review' | 'resolved' | 'closed';
  description: string;
  createdAt: string;
  resolution?: string;
}

interface PendingReview {
  id: string;
  bookingId: string;
  companionId: string;
  companionName: string;
  companionAvatar: string;
  date: string;
  activity: string;
}

const mockPendingReviews: PendingReview[] = [
  {
    id: '1',
    bookingId: 'b1',
    companionId: 'c1',
    companionName: 'Sarah J.',
    companionAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    date: 'Yesterday',
    activity: 'Dinner at Italian Restaurant',
  },
  {
    id: '2',
    bookingId: 'b2',
    companionId: 'c2',
    companionName: 'Michael C.',
    companionAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    date: '3 days ago',
    activity: 'Coffee Chat',
  },
];

const mockDisputes: DisputeCase[] = [
  {
    id: 'd1',
    bookingId: 'b3',
    companionName: 'John D.',
    companionAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    date: 'Jan 15, 2024',
    type: 'no-show',
    status: 'resolved',
    description: 'Companion did not show up to the scheduled meeting.',
    createdAt: 'Jan 16, 2024',
    resolution: 'Full refund issued. Companion has been warned.',
  },
];

const disputeTypes = [
  { id: 'refund', label: 'Refund Request', icon: 'cash-outline' },
  { id: 'behavior', label: 'Inappropriate Behavior', icon: 'warning-outline' },
  { id: 'no-show', label: 'No Show', icon: 'close-circle-outline' },
  { id: 'safety', label: 'Safety Concern', icon: 'shield-outline' },
  { id: 'other', label: 'Other Issue', icon: 'help-circle-outline' },
];

export const ReviewDisputeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'reviews' | 'disputes'>('reviews');
  const [showNewDispute, setShowNewDispute] = useState(false);
  const [selectedDisputeType, setSelectedDisputeType] = useState<string | null>(null);
  const [disputeDescription, setDisputeDescription] = useState('');

  // Review states
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewTags, setReviewTags] = useState<string[]>([]);

  const handleBackPress = async () => {
    await haptics.light();
    if (selectedReview) {
      setSelectedReview(null);
      setReviewRating(0);
      setReviewText('');
      setReviewTags([]);
    } else if (showNewDispute) {
      setShowNewDispute(false);
      setSelectedDisputeType(null);
      setDisputeDescription('');
    } else {
      navigation.goBack();
    }
  };

  const handleSubmitReview = async () => {
    await haptics.success();
    setSelectedReview(null);
    setReviewRating(0);
    setReviewText('');
    setReviewTags([]);
  };

  const handleSubmitDispute = async () => {
    await haptics.success();
    setShowNewDispute(false);
    setSelectedDisputeType(null);
    setDisputeDescription('');
  };

  const toggleReviewTag = (tag: string) => {
    haptics.selection();
    if (reviewTags.includes(tag)) {
      setReviewTags(reviewTags.filter(t => t !== tag));
    } else {
      setReviewTags([...reviewTags, tag]);
    }
  };

  const getStatusColor = (status: DisputeCase['status']) => {
    switch (status) {
      case 'open': return colors.status.warning;
      case 'in-review': return colors.primary.blue;
      case 'resolved': return colors.status.success;
      case 'closed': return colors.text.tertiary;
    }
  };

  const reviewPositiveTags = ['Great conversation', 'On time', 'Made me comfortable', 'Fun personality', 'Would book again'];
  const reviewNegativeTags = ['Late arrival', 'Poor communication', 'Not as described'];

  if (selectedReview) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Review</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Companion Info */}
          <View style={styles.reviewHeader}>
            <Image source={{ uri: selectedReview.companionAvatar }} style={styles.reviewAvatar} />
            <Text style={styles.reviewCompanionName}>{selectedReview.companionName}</Text>
            <Text style={styles.reviewActivity}>{selectedReview.activity}</Text>
            <Text style={styles.reviewDate}>{selectedReview.date}</Text>
          </View>

          {/* Star Rating */}
          <View style={styles.ratingSection}>
            <Text style={styles.ratingSectionTitle}>How was your experience?</Text>
            <View style={styles.starRating}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    haptics.selection();
                    setReviewRating(star);
                  }}
                >
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= reviewRating ? colors.primary.gold : colors.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {reviewRating > 0 && (
              <Text style={styles.ratingLabel}>
                {reviewRating === 5 ? 'Excellent!' : reviewRating === 4 ? 'Great!' : reviewRating === 3 ? 'Good' : reviewRating === 2 ? 'Fair' : 'Poor'}
              </Text>
            )}
          </View>

          {/* Quick Tags */}
          {reviewRating > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.tagsSectionTitle}>What went well?</Text>
              <View style={styles.tagsContainer}>
                {(reviewRating >= 3 ? reviewPositiveTags : reviewNegativeTags).map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.reviewTag, reviewTags.includes(tag) && styles.reviewTagActive]}
                    onPress={() => toggleReviewTag(tag)}
                  >
                    <Text style={[
                      styles.reviewTagText,
                      reviewTags.includes(tag) && styles.reviewTagTextActive,
                    ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Written Review */}
          <View style={styles.textReviewSection}>
            <Text style={styles.textReviewTitle}>Share more details (optional)</Text>
            <TextInput
              style={styles.reviewInput}
              placeholder="Tell others about your experience..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              value={reviewText}
              onChangeText={setReviewText}
            />
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="eye-outline" size={16} color={colors.text.tertiary} />
            <Text style={styles.privacyText}>
              Your review will be visible to other users. Your name will be shown as your first name and last initial.
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Submit Review"
            onPress={handleSubmitReview}
            variant="primary"
            size="large"
            fullWidth
            disabled={reviewRating === 0}
          />
        </View>
      </View>
    );
  }

  if (showNewDispute) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issue</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Issue Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What type of issue?</Text>
            <View style={styles.disputeTypesGrid}>
              {disputeTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.disputeTypeCard,
                    selectedDisputeType === type.id && styles.disputeTypeCardActive,
                  ]}
                  onPress={() => {
                    haptics.selection();
                    setSelectedDisputeType(type.id);
                  }}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={selectedDisputeType === type.id ? colors.primary.blue : colors.text.tertiary}
                  />
                  <Text style={[
                    styles.disputeTypeLabel,
                    selectedDisputeType === type.id && styles.disputeTypeLabelActive,
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          {selectedDisputeType && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Describe the issue</Text>
              <TextInput
                style={styles.disputeInput}
                placeholder="Please provide as much detail as possible..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={6}
                value={disputeDescription}
                onChangeText={setDisputeDescription}
              />
            </View>
          )}

          {/* Evidence Upload */}
          {selectedDisputeType && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Attach evidence (optional)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={() => haptics.light()}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.text.tertiary} />
                <Text style={styles.uploadText}>Tap to upload photos or screenshots</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Safety Warning */}
          {selectedDisputeType === 'safety' && (
            <Card variant="outlined" style={styles.safetyWarning}>
              <View style={styles.safetyWarningHeader}>
                <Ionicons name="alert-circle" size={24} color={colors.status.error} />
                <Text style={styles.safetyWarningTitle}>Urgent Safety Concern?</Text>
              </View>
              <Text style={styles.safetyWarningText}>
                If you're in immediate danger, please contact local emergency services. Our trust and safety team is available 24/7 for urgent matters.
              </Text>
              <Button
                title="Call Emergency Line"
                onPress={() => haptics.warning()}
                variant="danger"
                size="medium"
                icon="call"
              />
            </Card>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            title="Submit Report"
            onPress={handleSubmitDispute}
            variant="primary"
            size="large"
            fullWidth
            disabled={!selectedDisputeType || disputeDescription.length < 10}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reviews & Support</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
          onPress={() => {
            haptics.selection();
            setActiveTab('reviews');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
            Pending Reviews
          </Text>
          {mockPendingReviews.length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{mockPendingReviews.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'disputes' && styles.tabActive]}
          onPress={() => {
            haptics.selection();
            setActiveTab('disputes');
          }}
        >
          <Text style={[styles.tabText, activeTab === 'disputes' && styles.tabTextActive]}>
            Support Cases
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeTab === 'reviews' ? (
          <>
            {mockPendingReviews.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color={colors.status.success} />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No pending reviews</Text>
              </View>
            ) : (
              mockPendingReviews.map((review) => (
                <TouchableOpacity
                  key={review.id}
                  onPress={() => {
                    haptics.medium();
                    setSelectedReview(review);
                  }}
                >
                  <Card variant="outlined" style={styles.reviewCard}>
                    <Image source={{ uri: review.companionAvatar }} style={styles.cardAvatar} />
                    <View style={styles.cardContent}>
                      <Text style={styles.cardName}>{review.companionName}</Text>
                      <Text style={styles.cardActivity}>{review.activity}</Text>
                      <Text style={styles.cardDate}>{review.date}</Text>
                    </View>
                    <View style={styles.cardAction}>
                      <Text style={styles.leaveReviewText}>Leave Review</Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.primary.blue} />
                    </View>
                  </Card>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            {/* New Dispute Button */}
            <TouchableOpacity
              style={styles.newDisputeButton}
              onPress={() => {
                haptics.medium();
                setShowNewDispute(true);
              }}
            >
              <View style={styles.newDisputeIcon}>
                <Ionicons name="add" size={24} color={colors.primary.blue} />
              </View>
              <Text style={styles.newDisputeText}>Report a New Issue</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>

            {/* Existing Cases */}
            <Text style={styles.casesTitle}>Your Cases</Text>
            {mockDisputes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color={colors.text.tertiary} />
                <Text style={styles.emptyTitle}>No support cases</Text>
                <Text style={styles.emptySubtitle}>Report an issue if you need help</Text>
              </View>
            ) : (
              mockDisputes.map((dispute) => (
                <Card key={dispute.id} variant="outlined" style={styles.disputeCard}>
                  <View style={styles.disputeHeader}>
                    <View style={styles.disputeInfo}>
                      <Text style={styles.disputeType}>
                        {disputeTypes.find(t => t.id === dispute.type)?.label}
                      </Text>
                      <Text style={styles.disputeDate}>Opened {dispute.createdAt}</Text>
                    </View>
                    <Badge
                      label={dispute.status.replace('-', ' ')}
                      variant={dispute.status === 'resolved' ? 'success' : 'info'}
                      size="small"
                    />
                  </View>
                  <Text style={styles.disputeDescription} numberOfLines={2}>
                    {dispute.description}
                  </Text>
                  {dispute.resolution && (
                    <View style={styles.resolutionBox}>
                      <Text style={styles.resolutionLabel}>Resolution:</Text>
                      <Text style={styles.resolutionText}>{dispute.resolution}</Text>
                    </View>
                  )}
                </Card>
              ))
            )}
          </>
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
  placeholder: {
    width: 40,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.blue,
  },
  tabText: {
    ...typography.presets.button,
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary.blue,
  },
  tabBadge: {
    backgroundColor: colors.status.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    ...typography.presets.caption,
    color: colors.text.primary,
    fontSize: 10,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: spacing.screenPadding,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.massive,
  },
  emptyTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.md,
  },
  cardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.background.tertiary,
  },
  cardContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardName: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  cardActivity: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cardDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leaveReviewText: {
    ...typography.presets.bodySmall,
    color: colors.primary.blue,
  },
  reviewHeader: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  reviewAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: spacing.md,
  },
  reviewCompanionName: {
    ...typography.presets.h3,
    color: colors.text.primary,
  },
  reviewActivity: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  reviewDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  ratingSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
    marginHorizontal: spacing.screenPadding,
  },
  ratingSectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  starRating: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ratingLabel: {
    ...typography.presets.body,
    color: colors.primary.gold,
    marginTop: spacing.md,
  },
  tagsSection: {
    padding: spacing.screenPadding,
  },
  tagsSectionTitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reviewTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.round,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reviewTagActive: {
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    borderColor: colors.primary.blue,
  },
  reviewTagText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  reviewTagTextActive: {
    color: colors.primary.blue,
  },
  textReviewSection: {
    padding: spacing.screenPadding,
  },
  textReviewTitle: {
    ...typography.presets.body,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  reviewInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    color: colors.text.primary,
    ...typography.presets.body,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.screenPadding,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.md,
  },
  privacyText: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    flex: 1,
  },
  bottomBar: {
    padding: spacing.screenPadding,
  },
  newDisputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    gap: spacing.md,
  },
  newDisputeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDisputeText: {
    ...typography.presets.body,
    color: colors.text.primary,
    flex: 1,
  },
  casesTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  disputeCard: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  disputeInfo: {},
  disputeType: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  disputeDate: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  disputeDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  resolutionBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.status.successLight,
    borderRadius: spacing.radius.md,
  },
  resolutionLabel: {
    ...typography.presets.caption,
    color: colors.status.success,
    fontWeight: typography.weights.medium,
  },
  resolutionText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    marginTop: 4,
  },
  disputeTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  disputeTypeCard: {
    width: '48%',
    padding: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  disputeTypeCardActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  disputeTypeLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  disputeTypeLabelActive: {
    color: colors.primary.blue,
  },
  disputeInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    padding: spacing.lg,
    color: colors.text.primary,
    ...typography.presets.body,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background.tertiary,
    borderRadius: spacing.radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border.light,
    gap: spacing.sm,
  },
  uploadText: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
  },
  safetyWarning: {
    marginHorizontal: spacing.screenPadding,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.status.error,
    gap: spacing.md,
  },
  safetyWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  safetyWarningTitle: {
    ...typography.presets.h4,
    color: colors.status.error,
  },
  safetyWarningText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
});
