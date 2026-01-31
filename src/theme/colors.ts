/**
 * Wingman Color Palette
 * Primary: Black, Light Blue/Teal, Gold
 * Designed for a premium, modern social companion app
 *
 * Design Philosophy:
 * - Deep blacks create depth and elegance
 * - Teal accent provides energy and trust
 * - Gold highlights premium features
 * - Subtle gradients add dimension
 */

export const colors = {
  // Primary Colors
  primary: {
    // Blacks - Deep and sophisticated
    black: '#0A0A0F',
    darkBlack: '#050508',
    lightBlack: '#13131A',

    // Teal/Light Blue - Primary accent
    blue: '#4ECDC4',
    blueLight: '#6FE7DF',
    blueDark: '#3AAFA6',
    blueMuted: '#3A9A94',
    blueGlow: 'rgba(78, 205, 196, 0.25)',
    blueSoft: 'rgba(78, 205, 196, 0.12)',

    // Gold - Premium accent
    gold: '#FFD700',
    goldLight: '#FFE55C',
    goldDark: '#DAA520',
    goldGlow: 'rgba(255, 215, 0, 0.25)',
    goldSoft: 'rgba(255, 215, 0, 0.12)',
  },

  // Background Colors - Layered depth
  background: {
    primary: '#0A0A0F',    // Deepest black
    secondary: '#0F0F16',  // Slightly lifted
    tertiary: '#16161F',   // Card backgrounds
    card: '#1A1A24',       // Interactive cards
    cardHover: '#22222E',  // Hover state
    elevated: '#1E1E28',   // Elevated surfaces
    overlay: 'rgba(5, 5, 8, 0.92)',
    gradient: ['#0A0A0F', '#0F0F16', '#16161F'],
  },

  // Text Colors - Clear hierarchy
  text: {
    primary: '#FFFFFF',
    secondary: '#A8A8B8',
    tertiary: '#686878',
    muted: '#484858',
    placeholder: '#505060',
    accent: '#4ECDC4',
    gold: '#FFD700',
    inverse: '#0A0A0F',
  },

  // Status Colors - Clear feedback
  status: {
    success: '#34D399',
    successLight: 'rgba(52, 211, 153, 0.12)',
    successMuted: '#22C080',
    warning: '#FBBF24',
    warningLight: 'rgba(251, 191, 36, 0.12)',
    error: '#F87171',
    errorLight: 'rgba(248, 113, 113, 0.12)',
    info: '#60A5FA',
    infoLight: 'rgba(96, 165, 250, 0.12)',
  },

  // Verification/Badge Colors
  verification: {
    verified: '#34D399',
    backgroundChecked: '#4ECDC4',
    premium: '#FFD700',
    trusted: '#A78BFA',
    trustedLight: 'rgba(167, 139, 250, 0.12)',
  },

  // Border Colors - Subtle definition
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    heavy: 'rgba(255, 255, 255, 0.18)',
    accent: 'rgba(78, 205, 196, 0.4)',
    gold: 'rgba(255, 215, 0, 0.4)',
    focus: 'rgba(78, 205, 196, 0.6)',
  },

  // Gradient Presets - Smooth transitions
  gradients: {
    // Primary button gradient
    primary: ['#4ECDC4', '#3AAFA6'],
    primarySoft: ['rgba(78, 205, 196, 0.2)', 'rgba(58, 175, 166, 0.1)'],

    // Gold/Premium gradients
    gold: ['#FFE55C', '#FFD700', '#DAA520'],
    goldSoft: ['rgba(255, 215, 0, 0.2)', 'rgba(218, 165, 32, 0.1)'],
    premium: ['#FFD700', '#4ECDC4'],

    // Background gradients
    dark: ['#16161F', '#0A0A0F'],
    darkReverse: ['#0A0A0F', '#16161F'],
    cardShine: ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0)'],

    // Accent gradients
    blueToPurple: ['#4ECDC4', '#A78BFA'],
    sunset: ['#F472B6', '#FB923C'],

    // Overlay gradients
    fadeBottom: ['transparent', 'rgba(10, 10, 15, 0.95)'],
    fadeTop: ['rgba(10, 10, 15, 0.95)', 'transparent'],
  },

  // Shadow Colors - Depth and elevation
  shadow: {
    light: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.2)',
    heavy: 'rgba(0, 0, 0, 0.4)',
    blue: 'rgba(78, 205, 196, 0.2)',
    blueStrong: 'rgba(78, 205, 196, 0.35)',
    gold: 'rgba(255, 215, 0, 0.2)',
    goldStrong: 'rgba(255, 215, 0, 0.35)',
  },

  // Interactive States
  interactive: {
    pressed: 'rgba(255, 255, 255, 0.05)',
    hover: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(78, 205, 196, 0.15)',
    selected: 'rgba(78, 205, 196, 0.12)',
  },
} as const;

export type Colors = typeof colors;
