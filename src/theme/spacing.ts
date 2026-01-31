/**
 * Spacing System
 * Consistent spacing throughout the app
 */

export const spacing = {
  // Base spacing units
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,

  // Semantic spacing
  screenPadding: 20,
  cardPadding: 16,
  cardMargin: 12,
  sectionGap: 24,
  itemGap: 12,
  buttonPadding: 16,
  inputPadding: 16,

  // Border Radius
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 9999,
  },
} as const;

export type Spacing = typeof spacing;
