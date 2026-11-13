import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as Keychain from 'react-native-keychain';
import {
  ThemeMode,
  ThemeModeContext,
  ThemeModeContextValue,
} from '../theme/theme';

const SERVICE = 'onechat.theme';

async function loadThemeMode(): Promise<ThemeMode | null> {
  try {
    const saved = await Keychain.getGenericPassword({ service: SERVICE });
    const value = saved ? saved.password : null;
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

async function saveThemeMode(mode: ThemeMode) {
  try {
    await Keychain.setGenericPassword('theme', mode, { service: SERVICE });
  } catch {
    // Non-fatal: the choice still applies for this launch.
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let cancelled = false;
    loadThemeMode().then(stored => {
      if (!cancelled && stored) setModeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    saveThemeMode(next);
  }, []);

  const value = useMemo<ThemeModeContextValue>(
    () => ({
      mode,
      setMode,
      resolved: mode === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : mode,
    }),
    [mode, setMode, scheme],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}
