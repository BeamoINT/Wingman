import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

interface ScreenScaffoldProps {
  children: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  hideHorizontalPadding?: boolean;
  withBottomPadding?: boolean;
}

export const ScreenScaffold: React.FC<ScreenScaffoldProps> = ({
  children,
  scrollable = false,
  contentContainerStyle,
  style,
  hideHorizontalPadding = false,
  withBottomPadding = true,
}) => {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { colors, spacing } = tokens;

  const containerStyle = [
    styles.container,
    {
      backgroundColor: colors.background.primary,
      paddingLeft: hideHorizontalPadding ? 0 : spacing.screenPadding,
      paddingRight: hideHorizontalPadding ? 0 : spacing.screenPadding,
      paddingBottom: withBottomPadding ? insets.bottom + spacing.xxl : 0,
      maxWidth: spacing.contentMaxWidthWide,
      alignSelf: 'center' as const,
      width: '100%' as const,
    },
    contentContainerStyle,
  ];

  if (scrollable) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background.primary }, style]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={containerStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }, style]}>
      <View style={containerStyle}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
});
