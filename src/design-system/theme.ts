export type ColorScheme = 'light' | 'dark';

export const lightColors: Record<string, any> = {
  // Accent — the ONLY color. Green = money / primary / positive.
  accent: '#0E9E62', // deep emerald — text/icons/CTA on light surfaces
  accentBright: '#17E58A', // vivid emerald — text/curves/glow on dark/charcoal surfaces
  accentTint: 'rgba(23, 229, 138, 0.14)',
  accentGlow: 'rgba(23, 229, 138, 0.22)',

  loss: '#E5484D',
  neutralChart: '#2B2E37', // non-accent bar/gauge fill — must read against a LIGHT surface

  // Scoped exception to the single-accent rule: distinct hues for telling apart
  // multiple simultaneous items in a legend-like context (e.g. calendar festival bars).
  calendarPalette: ['#0E9E62', '#B45309', '#4F46E5', '#BE185D', '#0E7490', '#7C3AED'],

  // Scoped exception to the single-accent rule: a playing card must look like a physical
  // card (light face, red/black pips) regardless of the app's light/dark scheme — identical
  // values in both color objects on purpose.
  cardFaceBg: '#F7F7F5',
  cardFaceBorder: 'rgba(30, 34, 46, 0.10)',
  cardSuitRed: '#E5484D',
  cardSuitBlack: '#23252B',

  // Text — on light surfaces (the app's dominant surface in light scheme)
  textPrimary: '#23252B',
  textSecondary: '#5A5E68',
  textTertiary: '#8A8F99',
  hairline: 'rgba(30, 34, 46, 0.10)',
  neutralTileBg: 'rgba(30, 34, 46, 0.06)',
  chipActiveBg: '#FFFFFF',

  // Text — on charcoal/dark glass surfaces (hero/featured cards, always dark regardless of scheme)
  onDarkPrimary: '#FFFFFF',
  onDarkSecondary: 'rgba(255, 255, 255, 0.50)',
  onDarkTertiary: 'rgba(255, 255, 255, 0.35)',
  onDarkHairline: 'rgba(255, 255, 255, 0.10)',

  // Surface fills/borders
  surface: {
    lightGlassBg: 'rgba(255, 255, 255, 0.32)',
    lightGlassBorder: 'rgba(255, 255, 255, 0.70)',
    darkGlassBorder: 'rgba(255, 255, 255, 0.09)',
    fieldBg: 'rgba(255, 255, 255, 0.9)',
    fieldBorder: 'rgba(30, 34, 46, 0.05)',
    sheetBg: 'rgba(247, 247, 249, 0.97)',
  },
};

export const darkColors: Record<string, any> = {
  // Same single accent, tuned for legibility on dark surfaces (both card types are dark now).
  accent: '#17E58A',
  accentBright: '#17E58A',
  accentTint: 'rgba(23, 229, 138, 0.18)',
  accentGlow: 'rgba(23, 229, 138, 0.25)',

  loss: '#FF6B70',
  neutralChart: '#4A4F5A', // lighter than the light-scheme value — must read against a DARK surface

  // Scoped exception to the single-accent rule: distinct hues for telling apart
  // multiple simultaneous items in a legend-like context (e.g. calendar festival bars).
  calendarPalette: ['#17E58A', '#FBBF24', '#818CF8', '#F472B6', '#22D3EE', '#A78BFA'],

  // Scoped exception to the single-accent rule: a playing card must look like a physical
  // card (light face, red/black pips) regardless of the app's light/dark scheme — identical
  // values in both color objects on purpose.
  cardFaceBg: '#F7F7F5',
  cardFaceBorder: 'rgba(30, 34, 46, 0.10)',
  cardSuitRed: '#E5484D',
  cardSuitBlack: '#23252B',

  // Text — on the dominant (dark) surface in dark scheme
  textPrimary: '#F4F5F6',
  textSecondary: 'rgba(244, 245, 246, 0.62)',
  textTertiary: 'rgba(244, 245, 246, 0.42)',
  hairline: 'rgba(255, 255, 255, 0.10)',
  neutralTileBg: 'rgba(255, 255, 255, 0.07)',
  chipActiveBg: '#33363E',

  // Text on charcoal/dark glass hero cards — same dark surface, so identical to textPrimary etc.
  onDarkPrimary: '#FFFFFF',
  onDarkSecondary: 'rgba(255, 255, 255, 0.55)',
  onDarkTertiary: 'rgba(255, 255, 255, 0.38)',
  onDarkHairline: 'rgba(255, 255, 255, 0.12)',

  surface: {
    lightGlassBg: 'rgba(255, 255, 255, 0.07)', // "light" card = subtly-elevated dark card, not white
    lightGlassBorder: 'rgba(255, 255, 255, 0.12)',
    darkGlassBorder: 'rgba(255, 255, 255, 0.08)',
    fieldBg: 'rgba(255, 255, 255, 0.06)',
    fieldBorder: 'rgba(255, 255, 255, 0.12)',
    sheetBg: 'rgba(22, 23, 28, 0.97)',
  },
};

/** @deprecated Use `useTheme().colors` for anything that should react to the user's theme setting.
 * Kept as a static light-scheme fallback for call sites not yet migrated. */
export const colors = lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 22,
  '2xl': 26,
  full: 9999,
} as const;

export const fontFamily = {
  display: 'Jost_300Light',
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_800ExtraBold',
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 36,
  '4xl': 46,
  display: 56,
  displaySheet: 32,
} as const;

export const shadow = {
  light: {
    shadowColor: '#323848',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 6,
  },
  dark: {
    shadowColor: '#141620',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 34,
    elevation: 10,
  },
  field: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;

export function getColors(scheme: ColorScheme): Record<string, any> {
  return scheme === 'dark' ? darkColors : lightColors;
}
