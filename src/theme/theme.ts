import { useColorScheme } from 'react-native';

export const lightColors = {
  canvas: '#F8FAF9',
  surface: '#FFFFFF',
  header: '#FFFFFF',
  border: '#E2EBE7',
  ink: '#0F172A',
  muted: '#64748B',
  emerald: '#059669',
  emeraldDark: '#047857',
  mint: '#E6F4ED',
  mintText: '#047857',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',
  warning: '#F59E0B',
  chatBg: '#EFEAE2',
  bubbleIn: '#FFFFFF',
  bubbleInText: '#0F172A',
  bubbleOut: '#E7FFDB',
  bubbleOutText: '#0F172A',
  inputBg: '#FFFFFF',
  inputContainerBg: '#F0F2F5',
  cardHover: '#F1F5F9',
  shadow: '#000000',
  isDark: false,
};

export const darkColors = {
  canvas: '#060c18ff',
  surface: '#101723ff',
  header: '#030912ff',
  border: '#334155',
  ink: '#F8FAFC',
  muted: '#94A3B8',
  emerald: '#01b670ff',
  emeraldDark: '#026848ff',
  mint: '#064E3B',
  mintText: '#A7F3D0',
  danger: '#F87171',
  dangerBg: '#451A1A',
  dangerBorder: '#7F1D1D',
  warning: '#D97706',
  chatBg: '#0B141A',
  bubbleIn: '#202C33',
  bubbleInText: '#E9EDEF',
  bubbleOut: '#005C4B',
  bubbleOutText: '#E9EDEF',
  inputBg: '#2A3942',
  inputContainerBg: '#202C33',
  cardHover: '#334155',
  shadow: '#000000',
  isDark: true,
};

export type ThemeColors = typeof lightColors;

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}

// Backward compatibility default colors
export const colors = lightColors;
