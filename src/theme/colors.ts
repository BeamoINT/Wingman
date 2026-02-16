import { Appearance } from 'react-native';

/**
 * Wingman color system.
 *
 * Includes semantic tokens for modern adaptive theming while preserving
 * backwards-compatible keys used across the existing app.
 */

export type ThemeName = 'light' | 'dark';

interface BasePalette {
  canvas: string;
  surface0: string;
  surface1: string;
  surface2: string;
  surface3: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentGlow: string;
  silver: string;
  silverLight: string;
  silverDark: string;
  silverSoft: string;
  silverGlow: string;
  coral: string;
  coralLight: string;
  coralDark: string;
  coralSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  info: string;
  infoSoft: string;
  borderSubtle: string;
  borderLight: string;
  borderMedium: string;
  borderHeavy: string;
  overlay: string;
  shadowLight: string;
  shadowMedium: string;
  shadowHeavy: string;
}

const darkPalette: BasePalette = {
  canvas: '#070B14',
  surface0: '#0D1424',
  surface1: '#131E33',
  surface2: '#192740',
  surface3: '#223250',
  textPrimary: '#F8FAFF',
  textSecondary: '#C2CCE2',
  textTertiary: '#8C9AB7',
  textMuted: '#66748F',
  accent: '#2FA8FF',
  accentStrong: '#007EEA',
  accentSoft: 'rgba(47, 168, 255, 0.14)',
  accentGlow: 'rgba(47, 168, 255, 0.34)',
  silver: '#D3D7E3',
  silverLight: '#EEF2FC',
  silverDark: '#AAB6CF',
  silverSoft: 'rgba(211, 215, 227, 0.14)',
  silverGlow: 'rgba(211, 215, 227, 0.3)',
  coral: '#FF7C6B',
  coralLight: '#FF9D91',
  coralDark: '#E46052',
  coralSoft: 'rgba(255, 124, 107, 0.14)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.14)',
  error: '#EF4444',
  errorSoft: 'rgba(239, 68, 68, 0.14)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.14)',
  borderSubtle: 'rgba(194, 204, 226, 0.08)',
  borderLight: 'rgba(194, 204, 226, 0.14)',
  borderMedium: 'rgba(194, 204, 226, 0.22)',
  borderHeavy: 'rgba(194, 204, 226, 0.34)',
  overlay: 'rgba(5, 10, 19, 0.9)',
  shadowLight: 'rgba(2, 10, 30, 0.16)',
  shadowMedium: 'rgba(2, 10, 30, 0.32)',
  shadowHeavy: 'rgba(2, 10, 30, 0.46)',
};

const lightPalette: BasePalette = {
  canvas: '#F4F7FF',
  surface0: '#FFFFFF',
  surface1: '#F0F4FE',
  surface2: '#E7EDFB',
  surface3: '#DBE5F8',
  textPrimary: '#0B162D',
  textSecondary: '#334362',
  textTertiary: '#62708C',
  textMuted: '#8591AA',
  accent: '#1B75F0',
  accentStrong: '#0A54C6',
  accentSoft: 'rgba(27, 117, 240, 0.12)',
  accentGlow: 'rgba(27, 117, 240, 0.24)',
  silver: '#7D8CA8',
  silverLight: '#9BA9C2',
  silverDark: '#5F6D87',
  silverSoft: 'rgba(125, 140, 168, 0.12)',
  silverGlow: 'rgba(125, 140, 168, 0.2)',
  coral: '#E85A4F',
  coralLight: '#F17D73',
  coralDark: '#CF473C',
  coralSoft: 'rgba(232, 90, 79, 0.12)',
  success: '#16A34A',
  successSoft: 'rgba(22, 163, 74, 0.12)',
  warning: '#D97706',
  warningSoft: 'rgba(217, 119, 6, 0.12)',
  error: '#DC2626',
  errorSoft: 'rgba(220, 38, 38, 0.12)',
  info: '#0284C7',
  infoSoft: 'rgba(2, 132, 199, 0.12)',
  borderSubtle: 'rgba(51, 67, 98, 0.08)',
  borderLight: 'rgba(51, 67, 98, 0.14)',
  borderMedium: 'rgba(51, 67, 98, 0.22)',
  borderHeavy: 'rgba(51, 67, 98, 0.32)',
  overlay: 'rgba(11, 22, 45, 0.6)',
  shadowLight: 'rgba(17, 28, 47, 0.08)',
  shadowMedium: 'rgba(17, 28, 47, 0.16)',
  shadowHeavy: 'rgba(17, 28, 47, 0.24)',
};

const paletteByTheme: Record<ThemeName, BasePalette> = {
  dark: darkPalette,
  light: lightPalette,
};

const createThemeColors = (theme: ThemeName) => {
  const p = paletteByTheme[theme];

  return {
    theme,
    isDark: theme === 'dark',

    semantic: {
      background: p.canvas,
      surface: p.surface0,
      surfaceElevated: p.surface1,
      textPrimary: p.textPrimary,
      textSecondary: p.textSecondary,
      textTertiary: p.textTertiary,
      borderSubtle: p.borderSubtle,
      borderStrong: p.borderMedium,
      accent: p.accent,
    },

    surface: {
      level0: p.canvas,
      level1: p.surface0,
      level2: p.surface1,
      level3: p.surface2,
      level4: p.surface3,
      overlay: p.overlay,
    },

    accent: {
      primary: p.accent,
      strong: p.accentStrong,
      soft: p.accentSoft,
      glow: p.accentGlow,
      secondary: p.coral,
      secondarySoft: p.coralSoft,
    },

    text: {
      primary: p.textPrimary,
      secondary: p.textSecondary,
      tertiary: p.textTertiary,
      muted: p.textMuted,
      placeholder: p.textTertiary,
      accent: p.accent,
      gold: p.silver,
      inverse: theme === 'dark' ? '#060B14' : '#FFFFFF',
    },

    border: {
      subtle: p.borderSubtle,
      light: p.borderLight,
      medium: p.borderMedium,
      heavy: p.borderHeavy,
      accent: p.accentGlow,
      gold: p.silverGlow,
      focus: p.accentGlow,
      strong: p.borderHeavy,
    },

    status: {
      success: p.success,
      successLight: p.successSoft,
      successMuted: theme === 'dark' ? '#1F9D4D' : '#15803D',
      warning: p.warning,
      warningLight: p.warningSoft,
      error: p.error,
      errorLight: p.errorSoft,
      info: p.info,
      infoLight: p.infoSoft,
    },

    verification: {
      verified: p.success,
      premium: p.silver,
      trusted: p.accent,
      trustedLight: p.accentSoft,
    },

    shadow: {
      light: p.shadowLight,
      medium: p.shadowMedium,
      heavy: p.shadowHeavy,
      blue: p.accentSoft,
      blueStrong: p.accentGlow,
      gold: p.silverSoft,
      goldStrong: p.silverGlow,
    },

    interactive: {
      pressed: theme === 'dark' ? 'rgba(248, 250, 255, 0.06)' : 'rgba(11, 22, 45, 0.06)',
      hover: theme === 'dark' ? 'rgba(248, 250, 255, 0.1)' : 'rgba(11, 22, 45, 0.1)',
      focus: p.accentSoft,
      selected: p.accentSoft,
    },

    gradients: {
      primary: [p.accent, p.accentStrong],
      primarySoft: [p.accentSoft, 'transparent'],
      gold: [p.silverLight, p.silver, p.silverDark],
      goldSoft: [p.silverSoft, 'transparent'],
      premium: [p.silver, p.accent],
      dark: [p.surface3, p.surface0],
      darkReverse: [p.surface0, p.surface3],
      cardShine: theme === 'dark'
        ? ['rgba(248, 250, 255, 0.06)', 'rgba(248, 250, 255, 0)']
        : ['rgba(11, 22, 45, 0.05)', 'rgba(11, 22, 45, 0)'],
      blueToPurple: [p.accent, p.accentStrong],
      sunset: [p.coralLight, p.coral],
      fadeBottom: ['transparent', p.overlay],
      fadeTop: [p.overlay, 'transparent'],
    },

    primary: {
      black: p.canvas,
      darkBlack: theme === 'dark' ? '#040812' : '#DDE7FB',
      lightBlack: p.surface2,
      blue: p.accent,
      blueLight: theme === 'dark' ? '#66BEFF' : '#3C8AF7',
      blueDark: p.accentStrong,
      blueMuted: theme === 'dark' ? '#2A89CC' : '#2E6AC7',
      blueGlow: p.accentGlow,
      blueSoft: p.accentSoft,
      silver: p.silver,
      silverLight: p.silverLight,
      silverDark: p.silverDark,
      silverGlow: p.silverGlow,
      silverSoft: p.silverSoft,
      gold: p.silver,
      goldLight: p.silverLight,
      goldDark: p.silverDark,
      goldGlow: p.silverGlow,
      goldSoft: p.silverSoft,
      coral: p.coral,
      coralLight: p.coralLight,
      coralDark: p.coralDark,
      coralSoft: p.coralSoft,
    },

    background: {
      primary: p.canvas,
      secondary: p.surface0,
      tertiary: p.surface1,
      card: p.surface2,
      cardHover: p.surface3,
      elevated: theme === 'dark' ? '#273A58' : '#D0DCF2',
      overlay: p.overlay,
      gradient: [p.canvas, p.surface0, p.surface1],
    },
  } as const;
};

export const lightColors = createThemeColors('light');
export const darkColors = createThemeColors('dark');

export const themeColors = {
  light: lightColors,
  dark: darkColors,
} as const;

export const getColorsForTheme = (theme: ThemeName) => themeColors[theme];

// Backwards compatibility for legacy style imports.
const initialTheme: ThemeName = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
export const colors = getColorsForTheme(initialTheme);

export type Colors = typeof darkColors;
export type ThemeColors = Colors;
