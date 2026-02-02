/**
 * Wingman Color Palette
 * Primary: Black, White, Electric Blue
 * Designed for a premium, modern social companion app
 *
 * Design Philosophy:
 * - Deep blacks create depth and elegance
 * - Electric blue accent provides energy and modernity
 * - Silver highlights premium features
 * - Clean black and white foundation
 */

export const colors = {
  // Primary Colors
  primary: {
    // Blacks - Deep and sophisticated
    black: '#0A0A0F',
    darkBlack: '#050508',
    lightBlack: '#13131A',

    // Electric Blue - Primary accent
    blue: '#00D4FF',
    blueLight: '#33DFFF',
    blueDark: '#00A8CC',
    blueMuted: '#0099BB',
    blueGlow: 'rgba(0, 212, 255, 0.25)',
    blueSoft: 'rgba(0, 212, 255, 0.12)',

    // Silver - Premium accent (replacing gold)
    silver: '#C0C0C0',
    silverLight: '#E8E8E8',
    silverDark: '#A0A0A0',
    silverGlow: 'rgba(192, 192, 192, 0.25)',
    silverSoft: 'rgba(192, 192, 192, 0.12)',

    // Gold - Mapped to silver for backwards compatibility
    gold: '#C0C0C0',
    goldLight: '#E8E8E8',
    goldDark: '#A0A0A0',
    goldGlow: 'rgba(192, 192, 192, 0.25)',
    goldSoft: 'rgba(192, 192, 192, 0.12)',

    // Coral - For social/friends features
    coral: '#FF6B6B',
    coralLight: '#FF8E8E',
    coralDark: '#E55555',
    coralSoft: 'rgba(255, 107, 107, 0.12)',
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
    secondary: '#B0B0B0',
    tertiary: '#707070',
    muted: '#505050',
    placeholder: '#606060',
    accent: '#00D4FF',
    gold: '#C0C0C0',
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
    info: '#00D4FF',
    infoLight: 'rgba(0, 212, 255, 0.12)',
  },

  // Verification/Badge Colors
  verification: {
    verified: '#34D399',
    premium: '#C0C0C0',
    trusted: '#00D4FF',
    trustedLight: 'rgba(0, 212, 255, 0.12)',
  },

  // Border Colors - Subtle definition
  border: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    heavy: 'rgba(255, 255, 255, 0.18)',
    accent: 'rgba(0, 212, 255, 0.4)',
    gold: 'rgba(192, 192, 192, 0.4)',
    focus: 'rgba(0, 212, 255, 0.6)',
  },

  // Gradient Presets - Smooth transitions
  gradients: {
    // Primary button gradient
    primary: ['#00D4FF', '#00A8CC'],
    primarySoft: ['rgba(0, 212, 255, 0.2)', 'rgba(0, 168, 204, 0.1)'],

    // Silver/Premium gradients
    gold: ['#E8E8E8', '#C0C0C0', '#A0A0A0'],
    goldSoft: ['rgba(192, 192, 192, 0.2)', 'rgba(160, 160, 160, 0.1)'],
    premium: ['#C0C0C0', '#00D4FF'],

    // Background gradients
    dark: ['#16161F', '#0A0A0F'],
    darkReverse: ['#0A0A0F', '#16161F'],
    cardShine: ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0)'],

    // Accent gradients
    blueToPurple: ['#00D4FF', '#0099DD'],
    sunset: ['#00D4FF', '#00A8CC'],

    // Overlay gradients
    fadeBottom: ['transparent', 'rgba(10, 10, 15, 0.95)'],
    fadeTop: ['rgba(10, 10, 15, 0.95)', 'transparent'],
  },

  // Shadow Colors - Depth and elevation
  shadow: {
    light: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.2)',
    heavy: 'rgba(0, 0, 0, 0.4)',
    blue: 'rgba(0, 212, 255, 0.2)',
    blueStrong: 'rgba(0, 212, 255, 0.35)',
    gold: 'rgba(192, 192, 192, 0.2)',
    goldStrong: 'rgba(192, 192, 192, 0.35)',
  },

  // Interactive States
  interactive: {
    pressed: 'rgba(255, 255, 255, 0.05)',
    hover: 'rgba(255, 255, 255, 0.08)',
    focus: 'rgba(0, 212, 255, 0.15)',
    selected: 'rgba(0, 212, 255, 0.12)',
  },
} as const;

export type Colors = typeof colors;
