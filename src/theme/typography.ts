import { Platform } from 'react-native';

/**
 * Typography system using a single-family minimalist scale.
 */

const fontFamily = Platform.select({
  ios: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    // Compatibility aliases retained during migration.
    displayRegular: 'Manrope_500Medium',
    displayMedium: 'Manrope_600SemiBold',
    displayBold: 'Manrope_700Bold',
    fallback: 'System',
  },
  android: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    displayRegular: 'Manrope_500Medium',
    displayMedium: 'Manrope_600SemiBold',
    displayBold: 'Manrope_700Bold',
    fallback: 'sans-serif',
  },
  default: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    displayRegular: 'Manrope_500Medium',
    displayMedium: 'Manrope_600SemiBold',
    displayBold: 'Manrope_700Bold',
    fallback: 'sans-serif',
  },
});

export const typography = {
  fontFamily,

  sizes: {
    xxs: 11,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 34,
    hero: 40,
  },

  lineHeights: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.55,
    loose: 1.75,
  },

  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },

  letterSpacing: {
    tighter: -0.4,
    tight: -0.2,
    normal: 0,
    wide: 0.15,
    wider: 0.3,
    widest: 0.8,
  },

  presets: {
    hero: {
      fontFamily: fontFamily.bold,
      fontSize: 40,
      fontWeight: '700' as const,
      letterSpacing: -0.4,
      lineHeight: 48,
    },
    h1: {
      fontFamily: fontFamily.bold,
      fontSize: 34,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
      lineHeight: 40,
    },
    h2: {
      fontFamily: fontFamily.semibold,
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      lineHeight: 34,
    },
    h3: {
      fontFamily: fontFamily.semibold,
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.1,
      lineHeight: 28,
    },
    h4: {
      fontFamily: fontFamily.medium,
      fontSize: 18,
      fontWeight: '500' as const,
      letterSpacing: -0.05,
      lineHeight: 24,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 23,
    },
    bodyMedium: {
      fontFamily: fontFamily.medium,
      fontSize: 16,
      fontWeight: '500' as const,
      letterSpacing: 0,
      lineHeight: 23,
    },
    bodySmall: {
      fontFamily: fontFamily.regular,
      fontSize: 14,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 20,
    },
    caption: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 0.15,
      lineHeight: 16,
    },
    button: {
      fontFamily: fontFamily.semibold,
      fontSize: 16,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
      lineHeight: 22,
    },
    buttonSmall: {
      fontFamily: fontFamily.semibold,
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
      lineHeight: 20,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 0.6,
      lineHeight: 16,
      textTransform: 'uppercase' as const,
    },
  },
} as const;

export type Typography = typeof typography;
