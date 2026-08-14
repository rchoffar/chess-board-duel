import { createContext, useContext, useMemo } from 'react';
import { getColors, spacing, radius, fontFamily, fontSize, shadow, type ColorScheme } from './theme';

interface ThemeValue {
  scheme: ColorScheme;
  colors: ReturnType<typeof getColors>;
  spacing: typeof spacing;
  radius: typeof radius;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  shadow: typeof shadow;
}

const ThemeContext = createContext<ThemeValue | null>(null);

// Chess Board Duel is dark-only by design.
const SCHEME: ColorScheme = 'dark';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ThemeValue>(() => ({
    scheme: SCHEME,
    colors: getColors(SCHEME),
    spacing,
    radius,
    fontFamily,
    fontSize,
    shadow,
  }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
