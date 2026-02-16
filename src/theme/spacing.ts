/**
 * Wingman spacing + sizing system.
 */

export const spacing = {
  // Base spacing units (8pt cadence with tight helpers)
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
  huge: 64,
  massive: 80,
  giant: 96,

  // Semantic spacing
  screenPadding: 16,
  screenPaddingWide: 24,
  cardPadding: 16,
  cardMargin: 12,
  sectionGap: 24,
  itemGap: 12,
  buttonPadding: 16,
  inputPadding: 14,
  listItemPadding: 12,

  // Responsive layout
  contentMaxWidth: 720,
  contentMaxWidthWide: 960,

  // Border Radius
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
    xxxl: 32,
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
      shadowOpacity: 0.05,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    md: {
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    lg: {
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    xl: {
      shadowOpacity: 0.16,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
  },
} as const;

export type Spacing = typeof spacing;
