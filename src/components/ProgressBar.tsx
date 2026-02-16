import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle, useSharedValue, withSpring
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from '../theme/tokens';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps,
  showLabel = true,
}) => {
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;
  const styles = useThemedStyles(createStyles);
  const progressValue = useSharedValue(currentStep / totalSteps);

  useEffect(() => {
    progressValue.value = withSpring(currentStep / totalSteps, {
      damping: 20,
      stiffness: 90,
    });
  }, [currentStep, totalSteps]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          Step {currentStep} of {totalSteps}
        </Text>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    </View>
  );
};

const createStyles = ({ colors, spacing, typography }: ThemeTokens) => StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.presets.caption,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  track: {
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary.blue,
    borderRadius: 2,
  },
});
