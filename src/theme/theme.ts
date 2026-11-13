import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/**
 * OneChat design tokens — "Navy & Signal Green".
 * Navy (from the logo ground) carries primary actions and hero surfaces;
 * green is reserved for brand, active, unread and positive states.
 * Keys from the previous palette are kept so every screen keeps working.
 */
export const lightColors = {
  // Surfaces
  canvas: '#F5F7FA',
  surface: '#FFFFFF',
  header: '#FFFFFF',
  border: '#E4E8EE',
  divider: '#EEF1F4',
  fieldBg: '#F1F3F6',
  fieldBorder: '#D5DBE3',
  // Text
  ink: '#0F172A',
  inkSoft: '#344054',
  muted: '#5B6475',
  placeholder: '#7A8494',
  // Brand
  primary: '#0B1324',
  onPrimary: '#FFFFFF',
  primarySoft: '#A9B4C6',
  accent: '#2BD47D',
  onAccent: '#062214',
  emerald: '#0E8A4B',
  emeraldDark: '#0B6E3C',
  mint: '#E7F6EE',
  mintText: '#0B6E3C',
  // Status tints (bg / fg pairs)
  infoBg: '#E8F0FE',
  info: '#2457C5',
  warnBg: '#FEF1E3',
  warning: '#9A4A08',
  violetBg: '#F1EBFD',
  violet: '#5B32B4',
  danger: '#B42335',
  dangerBg: '#FDE9EC',
  dangerBorder: '#F3C6CA',
  badge: '#E5484D',
  online: '#22B566',
  readTick: '#2C7BE5',
  // Chat
  chatBg: '#EEF1F5',
  bubbleIn: '#FFFFFF',
  bubbleInText: '#0F172A',
  bubbleOut: '#DCF5E6',
  bubbleOutText: '#0F172A',
  inputBg: '#FFFFFF',
  inputContainerBg: '#F1F3F6',
  cardHover: '#EEF1F4',
  shadow: '#0B1324',
  isDark: false,
};

export const darkColors: typeof lightColors = {
  canvas: '#0A0F1A',
  surface: '#121A2B',
  header: '#0E1524',
  border: '#233047',
  divider: '#1B2538',
  fieldBg: '#1A2336',
  fieldBorder: '#2C3A52',
  ink: '#E8EDF5',
  inkSoft: '#C3CCDA',
  muted: '#93A0B4',
  placeholder: '#6F7C91',
  primary: '#2BD47D',
  onPrimary: '#062214',
  primarySoft: '#93A0B4',
  accent: '#2BD47D',
  onAccent: '#062214',
  emerald: '#2BD47D',
  emeraldDark: '#1FA862',
  mint: '#123526',
  mintText: '#7CE8AE',
  infoBg: '#17264A',
  info: '#8DB2FF',
  warnBg: '#3A2614',
  warning: '#F5B642',
  violetBg: '#2A1F4A',
  violet: '#BBA2F5',
  danger: '#FF8A94',
  dangerBg: '#3B2428',
  dangerBorder: '#6E363B',
  badge: '#E5484D',
  online: '#2BD47D',
  readTick: '#5AA2FF',
  chatBg: '#0B1220',
  bubbleIn: '#1A2336',
  bubbleInText: '#E8EDF5',
  bubbleOut: '#124530',
  bubbleOutText: '#E8EDF5',
  inputBg: '#1A2336',
  inputContainerBg: '#121A2B',
  cardHover: '#1B2538',
  shadow: '#000000',
  isDark: true,
};

export type ThemeColors = typeof lightColors;

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolved: ResolvedTheme;
};

/** Provided by ThemeProvider (src/contexts/ThemeContext.tsx). */
export const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/** Current light/dark/system preference plus the resolved scheme. */
export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  const scheme = useColorScheme();
  if (ctx) return ctx;
  return {
    mode: 'system',
    setMode: () => {},
    resolved: scheme === 'dark' ? 'dark' : 'light',
  };
}

/** Active palette. Follows the user's Appearance setting (System/Light/Dark). */
export function useTheme(): ThemeColors {
  const { resolved } = useThemeMode();
  return resolved === 'dark' ? darkColors : lightColors;
}

/** Corner radii used across the app. */
export const radii = { xs: 6, sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, pill: 999 };

/** 4-pt spacing scale. */
export const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 };

/** Type scale (sizes in dp, weights as RN strings). */
export const type = {
  display: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.7 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 11, fontWeight: '700' as const },
};

/** Soft card elevation. */
export const cardShadow = {
  shadowColor: '#0B1324',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
};

// Backward compatibility default colors (static: always the light palette)
export const colors = lightColors;
