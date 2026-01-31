import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic Feedback Utilities
 * Provides consistent haptic feedback throughout the app
 */

// Check if haptics are available (iOS and some Android devices)
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Light haptic feedback - for subtle interactions
 * Use for: toggles, selection changes, minor actions
 */
export const lightHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Medium haptic feedback - for standard interactions
 * Use for: button presses, card selections, confirmations
 */
export const mediumHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Heavy haptic feedback - for significant interactions
 * Use for: important actions, completing bookings, significant changes
 */
export const heavyHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Selection haptic feedback
 * Use for: picker selections, segment controls
 */
export const selectionHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Success haptic feedback - double tap pattern
 * Use for: successful actions, confirmations, achievements
 */
export const successHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Warning haptic feedback
 * Use for: warnings, attention needed
 */
export const warningHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Error haptic feedback
 * Use for: errors, failed actions, alerts
 */
export const errorHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Custom pattern haptic - celebration
 * Use for: achievements, milestones, special events
 */
export const celebrationHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(resolve => setTimeout(resolve, 100));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(resolve => setTimeout(resolve, 50));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Pull to refresh haptic
 * Use for: pull to refresh interactions
 */
export const pullRefreshHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Tab switch haptic
 * Use for: bottom tab navigation
 */
export const tabSwitchHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

/**
 * Swipe action haptic
 * Use for: swipe gestures, card swipes
 */
export const swipeHaptic = async () => {
  if (!isHapticsAvailable) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (error) {
    // Silently fail if haptics unavailable
  }
};

// Consolidated haptics object for easy importing
export const haptics = {
  light: lightHaptic,
  medium: mediumHaptic,
  heavy: heavyHaptic,
  selection: selectionHaptic,
  success: successHaptic,
  warning: warningHaptic,
  error: errorHaptic,
  celebration: celebrationHaptic,
  pullRefresh: pullRefreshHaptic,
  tabSwitch: tabSwitchHaptic,
  swipe: swipeHaptic,
};
