import { Platform } from 'react-native';

/**
 * Typography system using modern brand fonts with graceful fallback.
 */

const fontFamily = Platform.select({
  ios: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    displayRegular: 'SpaceGrotesk_500Medium',
    displayMedium: 'SpaceGrotesk_600SemiBold',
    displayBold: 'SpaceGrotesk_700Bold',
    fallback: 'System',
  },
  android: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    displayRegular: 'SpaceGrotesk_500Medium',
    displayMedium: 'SpaceGrotesk_600SemiBold',
    displayBold: 'SpaceGrotesk_700Bold',
    fallback: 'sans-serif',
  },
  default: {
    regular: 'Manrope_400Regular',
    medium: 'Manrope_500Medium',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    displayRegular: 'SpaceGrotesk_500Medium',
    displayMedium: 'SpaceGrotesk_600SemiBold',
    displayBold: 'SpaceGrotesk_700Bold',
    fallback: 'sans-serif',
  },
});

export const typography = {
  fontFamily,

  sizes: {
    xxs: 10,
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
    display: 34,
    hero: 44,
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
    tighter: -0.8,
    tight: -0.4,
    normal: 0,
    wide: 0.3,
    wider: 0.7,
    widest: 1.2,
  },

  presets: {
    hero: {
      fontFamily: fontFamily.displayBold,
      fontSize: 44,
      fontWeight: '700' as const,
      letterSpacing: -0.8,
      lineHeight: 52,
    },
    h1: {
      fontFamily: fontFamily.displayBold,
      fontSize: 34,
      fontWeight: '700' as const,
      letterSpacing: -0.6,
      lineHeight: 42,
    },
    h2: {
      fontFamily: fontFamily.displayMedium,
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.4,
      lineHeight: 36,
    },
    h3: {
      fontFamily: fontFamily.displayMedium,
      fontSize: 22,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      lineHeight: 30,
    },
    h4: {
      fontFamily: fontFamily.displayRegular,
      fontSize: 18,
      fontWeight: '500' as const,
      letterSpacing: -0.1,
      lineHeight: 25,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 24,
    },
    bodyMedium: {
      fontFamily: fontFamily.medium,
      fontSize: 16,
      fontWeight: '500' as const,
      letterSpacing: 0,
      lineHeight: 24,
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
      letterSpacing: 0.3,
      lineHeight: 16,
    },
    button: {
      fontFamily: fontFamily.semibold,
      fontSize: 16,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
      lineHeight: 24,
    },
    buttonSmall: {
      fontFamily: fontFamily.semibold,
      fontSize: 14,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
      lineHeight: 20,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: 12,
      fontWeight: '500' as const,
      letterSpacing: 1,
      lineHeight: 16,
      textTransform: 'uppercase' as const,
    },
  },
} as const;

export type Typography = typeof typography;
