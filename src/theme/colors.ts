/**
 * Wingman Color Palette
 * Primary: Black, Light Blue, Gold
 * Designed for a premium, modern social companion app
 */

export const colors = {
  // Primary Colors
  primary: {
    black: '#0A0A0F',
    darkBlack: '#050508',
    lightBlack: '#15151F',

    blue: '#4ECDC4',      // Main accent - teal/light blue
    blueLight: '#7EEEE6', // Lighter variant
    blueDark: '#2BA39B',  // Darker variant
    blueGlow: 'rgba(78, 205, 196, 0.3)',

    gold: '#FFD700',      // Premium gold
    goldLight: '#FFE44D', // Lighter gold
    goldDark: '#CC9900',  // Darker gold
    goldGlow: 'rgba(255, 215, 0, 0.3)',
  },

  // Background Colors
  background: {
    primary: '#0A0A0F',
    secondary: '#12121A',
    tertiary: '#1A1A25',
    card: '#1E1E2A',
    cardHover: '#252535',
    overlay: 'rgba(10, 10, 15, 0.9)',
    gradient: ['#0A0A0F', '#12121A', '#1A1A25'],
  },

  // Text Colors
  text: {
    primary: '#FFFFFF',
    secondary: '#B8B8C5',
    tertiary: '#6E6E80',
    muted: '#4A4A5A',
    accent: '#4ECDC4',
    gold: '#FFD700',
    inverse: '#0A0A0F',
  },

  // Status Colors
  status: {
    success: '#4ADE80',
    successLight: 'rgba(74, 222, 128, 0.15)',
    warning: '#FBBF24',
    warningLight: 'rgba(251, 191, 36, 0.15)',
    error: '#F87171',
    errorLight: 'rgba(248, 113, 113, 0.15)',
    info: '#60A5FA',
    infoLight: 'rgba(96, 165, 250, 0.15)',
  },

  // Verification/Safety Badge Colors
  verification: {
    verified: '#4ADE80',
    backgroundChecked: '#4ECDC4',
    premium: '#FFD700',
    trusted: '#A78BFA',
  },

  // Border Colors
  border: {
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    heavy: 'rgba(255, 255, 255, 0.2)',
    accent: 'rgba(78, 205, 196, 0.5)',
    gold: 'rgba(255, 215, 0, 0.5)',
  },

  // Gradient Presets
  gradients: {
    primary: ['#4ECDC4', '#2BA39B'],
    gold: ['#FFE44D', '#FFD700', '#CC9900'],
    premium: ['#FFD700', '#4ECDC4'],
    dark: ['#1A1A25', '#0A0A0F'],
    cardShine: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0)'],
    blueToPurple: ['#4ECDC4', '#A78BFA'],
  },

  // Shadow Colors
  shadow: {
    light: 'rgba(0, 0, 0, 0.1)',
    medium: 'rgba(0, 0, 0, 0.25)',
    heavy: 'rgba(0, 0, 0, 0.5)',
    blue: 'rgba(78, 205, 196, 0.25)',
    gold: 'rgba(255, 215, 0, 0.25)',
  },
} as const;

export type Colors = typeof colors;
