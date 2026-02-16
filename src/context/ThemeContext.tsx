import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import {
  getThemeTokens,
  type ThemeMode,
  type ThemeTokens,
} from '../theme/tokens';

const THEME_STORAGE_KEY = 'wingman.theme.mode';

export interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  tokens: ThemeTokens;
  isDark: boolean;
  reduceMotionEnabled: boolean;
  isThemeReady: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemTheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isThemeReady, setIsThemeReady] = useState(false);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadThemeMode = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!mounted) {
          return;
        }

        if (storedMode === 'light' || storedMode === 'dark' || storedMode === 'system') {
          setThemeModeState(storedMode);
        }
      } catch (error) {
        console.error('Unable to load theme preference:', error);
      } finally {
        if (mounted) {
          setIsThemeReady(true);
        }
      }
    };

    loadThemeMode();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadReduceMotion = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) {
          setReduceMotionEnabled(enabled);
        }
      } catch (error) {
        console.error('Unable to read reduced motion preference:', error);
      }
    };

    loadReduceMotion();

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotionEnabled(enabled);
      }
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return systemTheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemTheme]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Unable to save theme preference:', error);
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: ThemeMode = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setThemeMode(nextTheme);
  }, [resolvedTheme, setThemeMode]);

  const value = useMemo<ThemeContextValue>(() => {
    const tokens = getThemeTokens(resolvedTheme);

    return {
      themeMode,
      resolvedTheme,
      tokens,
      isDark: resolvedTheme === 'dark',
      reduceMotionEnabled,
      isThemeReady,
      setThemeMode,
      toggleTheme,
    };
  }, [isThemeReady, reduceMotionEnabled, resolvedTheme, setThemeMode, themeMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
