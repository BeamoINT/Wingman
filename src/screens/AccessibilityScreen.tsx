import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { haptics } from '../utils/haptics';
import { Card, Button, Badge } from '../components';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AccessibilityNeed {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const mobilityNeeds: AccessibilityNeed[] = [
  { id: 'wheelchair', label: 'Wheelchair Accessible', icon: 'accessibility', description: 'Venues must be wheelchair accessible' },
  { id: 'limited-walking', label: 'Limited Walking', icon: 'walk', description: 'Prefer seated activities or short distances' },
  { id: 'elevator', label: 'Elevator Required', icon: 'arrow-up', description: 'Avoid stairs, require elevator access' },
  { id: 'accessible-transport', label: 'Accessible Transport', icon: 'car', description: 'Need vehicle with accessibility features' },
];

const sensoryNeeds: AccessibilityNeed[] = [
  { id: 'visual', label: 'Visual Impairment', icon: 'eye-off', description: 'May need assistance with visual tasks' },
  { id: 'hearing', label: 'Hearing Impairment', icon: 'ear', description: 'May need written communication or sign language' },
  { id: 'quiet-venues', label: 'Quiet Venues', icon: 'volume-low', description: 'Avoid loud or crowded environments' },
  { id: 'low-light', label: 'Light Sensitivity', icon: 'sunny', description: 'Prefer dimmer lighting environments' },
];

const communicationNeeds: AccessibilityNeed[] = [
  { id: 'sign-language', label: 'Sign Language', icon: 'hand-right', description: 'Companion proficient in sign language' },
  { id: 'clear-speech', label: 'Clear Speech', icon: 'mic', description: 'Need companion to speak clearly and slowly' },
  { id: 'written', label: 'Written Communication', icon: 'create', description: 'Prefer text-based communication' },
  { id: 'patience', label: 'Extra Patience', icon: 'time', description: 'May need extra time for communication' },
];

const otherNeeds: AccessibilityNeed[] = [
  { id: 'service-animal', label: 'Service Animal', icon: 'paw', description: 'Will be accompanied by service animal' },
  { id: 'dietary', label: 'Dietary Restrictions', icon: 'restaurant', description: 'Have specific dietary needs' },
  { id: 'anxiety', label: 'Anxiety Support', icon: 'heart', description: 'May need patience with social anxiety' },
  { id: 'breaks', label: 'Frequent Breaks', icon: 'pause', description: 'May need to take breaks during activities' },
];

export const AccessibilityScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(['quiet-venues', 'patience']);
  const [shareWithCompanions, setShareWithCompanions] = useState(true);
  const [showBadge, setShowBadge] = useState(false);
  const [matchAccessibleCompanions, setMatchAccessibleCompanions] = useState(true);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleBackPress = async () => {
    await haptics.light();
    navigation.goBack();
  };

  const toggleNeed = (needId: string) => {
    haptics.selection();
    if (selectedNeeds.includes(needId)) {
      setSelectedNeeds(selectedNeeds.filter(id => id !== needId));
    } else {
      setSelectedNeeds([...selectedNeeds, needId]);
    }
  };

  const handleSave = async () => {
    await haptics.success();
    navigation.goBack();
  };

  const renderNeedCategory = (title: string, needs: AccessibilityNeed[], icon: string) => (
    <View style={styles.category}>
      <View style={styles.categoryHeader}>
        <Ionicons name={icon as any} size={20} color={colors.primary.blue} />
        <Text style={styles.categoryTitle}>{title}</Text>
      </View>
      <View style={styles.needsGrid}>
        {needs.map((need) => {
          const isSelected = selectedNeeds.includes(need.id);
          return (
            <TouchableOpacity
              key={need.id}
              style={[styles.needCard, isSelected && styles.needCardActive]}
              onPress={() => toggleNeed(need.id)}
            >
              <View style={styles.needHeader}>
                <View style={[styles.needIcon, isSelected && styles.needIconActive]}>
                  <Ionicons
                    name={need.icon as any}
                    size={20}
                    color={isSelected ? colors.text.primary : colors.text.tertiary}
                  />
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={colors.text.primary} />}
                </View>
              </View>
              <Text style={[styles.needLabel, isSelected && styles.needLabelActive]}>
                {need.label}
              </Text>
              <Text style={styles.needDescription} numberOfLines={2}>
                {need.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accessibility</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <Card variant="gradient" style={styles.infoBanner}>
          <Ionicons name="heart" size={24} color={colors.primary.blue} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>We're Here For Everyone</Text>
            <Text style={styles.infoText}>
              Tell us about your accessibility needs so we can match you with companions who can best support you.
            </Text>
          </View>
        </Card>

        {/* Categories */}
        {renderNeedCategory('Mobility', mobilityNeeds, 'accessibility')}
        {renderNeedCategory('Sensory', sensoryNeeds, 'eye')}
        {renderNeedCategory('Communication', communicationNeeds, 'chatbubbles')}
        {renderNeedCategory('Other Needs', otherNeeds, 'options')}

        {/* Privacy Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Matching</Text>

          <Card variant="outlined" style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Share with Companions</Text>
                <Text style={styles.settingDescription}>
                  Companions will see your accessibility needs before accepting bookings
                </Text>
              </View>
              <Switch
                value={shareWithCompanions}
                onValueChange={(value) => {
                  haptics.selection();
                  setShareWithCompanions(value);
                }}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Show Accessibility Badge</Text>
                <Text style={styles.settingDescription}>
                  Display a badge on your profile indicating accessibility needs
                </Text>
              </View>
              <Switch
                value={showBadge}
                onValueChange={(value) => {
                  haptics.selection();
                  setShowBadge(value);
                }}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>

            <View style={styles.settingDivider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Prioritize Trained Companions</Text>
                <Text style={styles.settingDescription}>
                  Show companions with accessibility training first in search results
                </Text>
              </View>
              <Switch
                value={matchAccessibleCompanions}
                onValueChange={(value) => {
                  haptics.selection();
                  setMatchAccessibleCompanions(value);
                }}
                trackColor={{ false: colors.background.tertiary, true: colors.primary.blue }}
                thumbColor={colors.text.primary}
              />
            </View>
          </Card>
        </View>

        {/* Companion Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>For Companions</Text>
          <Text style={styles.sectionSubtitle}>
            Want to become an accessibility-trained companion?
          </Text>

          <Card variant="outlined" style={styles.trainingCard}>
            <View style={styles.trainingBadge}>
              <Ionicons name="ribbon" size={24} color={colors.primary.gold} />
            </View>
            <Text style={styles.trainingTitle}>Accessibility Champion Program</Text>
            <Text style={styles.trainingDescription}>
              Complete our training to earn a badge and get matched with users who need accessibility support.
            </Text>
            <View style={styles.trainingBenefits}>
              {['Specialized training', 'Priority matching', 'Higher earnings', 'Community impact'].map((benefit, i) => (
                <View key={i} style={styles.trainingBenefit}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
                  <Text style={styles.trainingBenefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
            <Button
              title="Learn More"
              onPress={() => haptics.medium()}
              variant="gold"
              size="medium"
            />
          </Card>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          title="Save Preferences"
          onPress={handleSave}
          variant="primary"
          size="large"
          fullWidth
        />
      </View>
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: spacing.screenPadding,
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  infoText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  category: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  categoryTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
  },
  needsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  needCard: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderRadius: spacing.radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  needCardActive: {
    borderColor: colors.primary.blue,
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
  },
  needHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  needIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needIconActive: {
    backgroundColor: colors.primary.blue,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.text.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  needLabel: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    fontWeight: typography.weights.medium,
    marginBottom: 4,
  },
  needLabelActive: {
    color: colors.text.primary,
  },
  needDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    lineHeight: 16,
  },
  section: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.presets.bodySmall,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginLeft: spacing.lg,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    ...typography.presets.body,
    color: colors.text.primary,
    fontWeight: typography.weights.medium,
  },
  settingDescription: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  trainingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  trainingBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  trainingTitle: {
    ...typography.presets.h4,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  trainingDescription: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  trainingBenefits: {
    alignSelf: 'stretch',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  trainingBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trainingBenefitText: {
    ...typography.presets.bodySmall,
    color: colors.text.secondary,
  },
  bottomBar: {
    padding: spacing.screenPadding,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
});
