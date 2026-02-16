import { darkColors, getColorsForTheme, type ThemeColors, type ThemeName } from './colors';
import { spacing, type Spacing } from './spacing';
import { typography, type Typography } from './typography';

export type ThemeMode = ThemeName | 'system';

export interface MotionTokens {
  duration: {
    instant: number;
    fast: number;
    normal: number;
    slow: number;
  };
  scale: {
    press: number;
    subtle: number;
  };
}

export interface ThemeTokens {
  mode: ThemeName;
  isDark: boolean;
  colors: ThemeColors;
  spacing: Spacing;
  typography: Typography;
  motion: MotionTokens;
}

const sharedMotion: MotionTokens = {
  duration: {
    instant: 80,
    fast: 140,
    normal: 220,
    slow: 320,
  },
  scale: {
    press: 0.98,
    subtle: 0.995,
  },
};

export const getThemeTokens = (mode: ThemeName): ThemeTokens => ({
  mode,
  isDark: mode === 'dark',
  colors: getColorsForTheme(mode),
  spacing,
  typography,
  motion: sharedMotion,
});

export const defaultThemeTokens = getThemeTokens('dark');
export const legacyDarkColors = darkColors;
