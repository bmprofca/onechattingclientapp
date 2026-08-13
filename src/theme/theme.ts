import { useColorScheme } from 'react-native';

export const lightColors = {
  // WhatsApp-inspired light palette: warm chat canvas, deep teal chrome,
  // and the familiar green sent-message treatment.
  canvas: '#F7F8FA',
  surface: '#FFFFFF',
  header: '#FFFFFF',
  border: '#D8E0E4',
  ink: '#111B21',
  muted: '#667781',
  emerald: '#00A884',
  emeraldDark: '#008069',
  mint: '#E7F8F2',
  mintText: '#008069',
  danger: '#E5484D',
  dangerBg: '#ff000dff',
  dangerBorder: '#F5B8BB',
  warning: '#D97706',
  chatBg: '#EFEAE2',
  bubbleIn: '#FFFFFF',
  bubbleInText: '#111B21',
  bubbleOut: '#D9FDD3',
  bubbleOutText: '#111B21',
  inputBg: '#FFFFFF',
  inputContainerBg: '#F0F2F5',
  cardHover: '#EEF3F5',
  shadow: '#000000',
  isDark: false,
};

export const darkColors = {
  // WhatsApp dark uses blue-black surfaces with an emerald action color.
  canvas: '#0B141A',
  surface: '#111B21',
  header: '#202C33',
  border: '#2A3942',
  ink: '#E9EDEF',
  muted: '#8696A0',
  emerald: '#00A884',
  emeraldDark: '#008069',
  mint: '#103B35',
  mintText: '#71E4C0',
  danger: '#ff0008ff',
  dangerBg: '#3B2428',
  dangerBorder: '#6E363B',
  warning: '#F5B642',
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
