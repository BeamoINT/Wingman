/**
 * Wingman spacing + sizing system.
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
  giant: 80,

  // Semantic spacing
  screenPadding: 20,
  screenPaddingWide: 24,
  cardPadding: 16,
  cardMargin: 12,
  sectionGap: 24,
  itemGap: 12,
  buttonPadding: 16,
  inputPadding: 16,
  listItemPadding: 14,

  // Responsive layout
  contentMaxWidth: 720,
  contentMaxWidthWide: 960,

  // Border Radius
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    round: 9999,
    full: 9999,
    pill: 9999,
  },

  // Elevation presets
  elevation: {
    none: {
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    sm: {
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    md: {
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    lg: {
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    xl: {
      shadowOpacity: 0.2,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
      elevation: 12,
    },
  },
} as const;

export type Spacing = typeof spacing;
