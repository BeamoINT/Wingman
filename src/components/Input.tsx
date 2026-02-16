import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  /** Test ID for E2E testing */
  testID?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  testID,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { tokens } = useTheme();
  const { colors, spacing, typography } = tokens;

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  const styles = StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      ...typography.presets.caption,
      color: colors.text.secondary,
      marginBottom: spacing.xs,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface.level1,
      borderRadius: spacing.radius.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      minHeight: 48,
    },
    inputFocused: {
      borderColor: colors.accent.primary,
      backgroundColor: colors.surface.level0,
    },
    inputError: {
      borderColor: colors.status.error,
      backgroundColor: colors.status.errorLight,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.inputPadding,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.sizes.md,
      color: colors.text.primary,
    },
    inputWithLeftIcon: {
      paddingLeft: spacing.xs,
    },
    inputWithRightIcon: {
      paddingRight: spacing.xs,
    },
    leftIcon: {
      marginLeft: spacing.inputPadding,
    },
    rightIconButton: {
      padding: spacing.sm,
      opacity: props.editable === false ? 0.5 : 1,
    },
    messageContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
      minHeight: 16,
    },
    errorText: {
      ...typography.presets.caption,
      color: colors.status.error,
    },
    hintText: {
      ...typography.presets.caption,
      color: colors.text.tertiary,
    },
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
        pointerEvents="auto"
      >
        {leftIcon ? (
          <View pointerEvents="none">
              <Ionicons
                name={leftIcon}
                size={18}
                color={isFocused ? colors.accent.primary : colors.text.tertiary}
                style={styles.leftIcon}
              />
          </View>
        ) : null}

        <TextInput
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.accent.primary}
          cursorColor={colors.accent.primary}
          {...props}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            props.style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={props.editable !== false}
          accessibilityLabel={label}
          accessibilityHint={error || hint}
          accessibilityState={{
            disabled: props.editable === false,
          }}
          testID={testID}
        />

        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconButton}>
            <Ionicons name={rightIcon} size={18} color={colors.text.tertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.messageContainer}>
        {error ? (
          <>
            <Ionicons name="alert-circle" size={14} color={colors.status.error} />
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          </>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    </View>
  );
};
