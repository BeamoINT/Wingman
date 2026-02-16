import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import type { ThemeTokens } from './tokens';

/**
 * Memoize StyleSheet-like factories against active theme tokens.
 */
export const useThemedStyles = <T>(factory: (tokens: ThemeTokens) => T): T => {
  const { tokens } = useTheme();

  return useMemo(() => factory(tokens), [tokens]);
};
