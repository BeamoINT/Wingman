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
  canvas: '#0A0A0A',
  surface0: '#111111',
  surface1: '#181818',
  surface2: '#202020',
  surface3: '#292929',
  textPrimary: '#F5F5F5',
  textSecondary: '#D1D1D1',
  textTertiary: '#A6A6A6',
  textMuted: '#7C7C7C',
  accent: '#0A84FF',
  accentStrong: '#006FE0',
  accentSoft: 'rgba(10, 132, 255, 0.16)',
  accentGlow: 'rgba(10, 132, 255, 0.3)',
  silver: '#D6D6D6',
  silverLight: '#ECECEC',
  silverDark: '#B5B5B5',
  silverSoft: 'rgba(214, 214, 214, 0.14)',
  silverGlow: 'rgba(214, 214, 214, 0.28)',
  coral: '#FF5A5F',
  coralLight: '#FF787C',
  coralDark: '#E04549',
  coralSoft: 'rgba(255, 90, 95, 0.14)',
  success: '#2CB67D',
  successSoft: 'rgba(44, 182, 125, 0.14)',
  warning: '#F4A300',
  warningSoft: 'rgba(244, 163, 0, 0.14)',
  error: '#E5484D',
  errorSoft: 'rgba(229, 72, 77, 0.14)',
  info: '#0A84FF',
  infoSoft: 'rgba(10, 132, 255, 0.14)',
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.14)',
  borderMedium: 'rgba(255, 255, 255, 0.22)',
  borderHeavy: 'rgba(255, 255, 255, 0.32)',
  overlay: 'rgba(0, 0, 0, 0.72)',
  shadowLight: 'rgba(0, 0, 0, 0.14)',
  shadowMedium: 'rgba(0, 0, 0, 0.22)',
  shadowHeavy: 'rgba(0, 0, 0, 0.34)',
};

const lightPalette: BasePalette = {
  canvas: '#F6F6F6',
  surface0: '#FFFFFF',
  surface1: '#F1F1F1',
  surface2: '#EAEAEA',
  surface3: '#E1E1E1',
  textPrimary: '#121212',
  textSecondary: '#303030',
  textTertiary: '#626262',
  textMuted: '#8A8A8A',
  accent: '#0A84FF',
  accentStrong: '#006FE0',
  accentSoft: 'rgba(10, 132, 255, 0.12)',
  accentGlow: 'rgba(10, 132, 255, 0.22)',
  silver: '#6E6E6E',
  silverLight: '#8A8A8A',
  silverDark: '#4E4E4E',
  silverSoft: 'rgba(110, 110, 110, 0.12)',
  silverGlow: 'rgba(110, 110, 110, 0.2)',
  coral: '#E5484D',
  coralLight: '#F06569',
  coralDark: '#CA383D',
  coralSoft: 'rgba(229, 72, 77, 0.12)',
  success: '#2CB67D',
  successSoft: 'rgba(44, 182, 125, 0.12)',
  warning: '#D99000',
  warningSoft: 'rgba(217, 144, 0, 0.12)',
  error: '#E5484D',
  errorSoft: 'rgba(229, 72, 77, 0.12)',
  info: '#0A84FF',
  infoSoft: 'rgba(10, 132, 255, 0.12)',
  borderSubtle: 'rgba(18, 18, 18, 0.08)',
  borderLight: 'rgba(18, 18, 18, 0.14)',
  borderMedium: 'rgba(18, 18, 18, 0.22)',
  borderHeavy: 'rgba(18, 18, 18, 0.32)',
  overlay: 'rgba(18, 18, 18, 0.45)',
  shadowLight: 'rgba(18, 18, 18, 0.08)',
  shadowMedium: 'rgba(18, 18, 18, 0.14)',
  shadowHeavy: 'rgba(18, 18, 18, 0.2)',
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
      onAccent: '#FFFFFF',
      onDanger: '#FFFFFF',
      onSuccess: '#FFFFFF',
      inverse: theme === 'dark' ? '#0A0A0A' : '#FFFFFF',
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
      pressed: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(18, 18, 18, 0.06)',
      hover: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(18, 18, 18, 0.1)',
      focus: p.accentSoft,
      selected: p.accentSoft,
    },

    gradients: {
      primary: [p.accent, p.accentStrong],
      primarySoft: [p.accentSoft, 'transparent'],
      gold: [p.silverLight, p.silver, p.silverDark],
      goldSoft: [p.silverSoft, 'transparent'],
      premium: [p.surface2, p.surface0],
      dark: [p.surface3, p.surface0],
      darkReverse: [p.surface0, p.surface3],
      cardShine: theme === 'dark'
        ? ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0)']
        : ['rgba(18, 18, 18, 0.05)', 'rgba(18, 18, 18, 0)'],
      blueToPurple: [p.accent, p.accentStrong],
      sunset: [p.coralLight, p.coral],
      fadeBottom: ['transparent', p.overlay],
      fadeTop: [p.overlay, 'transparent'],
    },

    primary: {
      black: p.canvas,
      darkBlack: theme === 'dark' ? '#0A0A0A' : '#F6F6F6',
      lightBlack: p.surface2,
      blue: p.accent,
      blueLight: theme === 'dark' ? '#4EA2FF' : '#0A84FF',
      blueDark: p.accentStrong,
      blueMuted: theme === 'dark' ? '#1B80D6' : '#357DC8',
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
      elevated: theme === 'dark' ? '#2E2E2E' : '#E6E6E6',
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
