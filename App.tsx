import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary, LoadingScreen } from './src/components';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LiveLocationProvider } from './src/context/LiveLocationContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { RequirementsProvider } from './src/context/RequirementsContext';
import { SafetyProvider } from './src/context/SafetyContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { VerificationProvider } from './src/context/VerificationContext';
import { LiveLocationIndicator } from './src/components/LiveLocationIndicator';
import { EmergencySosIndicator } from './src/components/EmergencySosIndicator';
import { RootNavigator } from './src/navigation';
import { captureError, initializeSentry } from './src/services/monitoring/sentry';

// Disable strict mode warnings for shared value reads during render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

type AppStartupPhase = 'fonts' | 'theme' | 'session' | 'ready' | 'failed';

const FONT_LOAD_TIMEOUT_MS = 8000;
const THEME_LOAD_TIMEOUT_MS = 8000;
const SESSION_RESTORE_TIMEOUT_MS = 12000;

/**
 * Inner app component that has access to contexts.
 */
function AppContent({ onPhaseChange }: { onPhaseChange: (phase: AppStartupPhase) => void }) {
  const { isRestoringSession } = useAuth();
  const { isDark, isThemeReady } = useTheme();
  const [themeTimedOut, setThemeTimedOut] = useState(false);
  const [sessionTimedOut, setSessionTimedOut] = useState(false);
  const startupPhase: AppStartupPhase = !isThemeReady && !themeTimedOut
    ? 'theme'
    : isRestoringSession && !sessionTimedOut
      ? 'session'
      : 'ready';

  useEffect(() => {
    if (isThemeReady) {
      setThemeTimedOut(false);
      return undefined;
    }

    const timeout = setTimeout(() => {
      setThemeTimedOut(true);
      onPhaseChange('failed');
    }, THEME_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isThemeReady, onPhaseChange]);

  useEffect(() => {
    if (!isRestoringSession) {
      setSessionTimedOut(false);
      return undefined;
    }

    const timeout = setTimeout(() => {
      setSessionTimedOut(true);
      onPhaseChange('failed');
    }, SESSION_RESTORE_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [isRestoringSession, onPhaseChange]);

  useEffect(() => {
    onPhaseChange(startupPhase);
  }, [onPhaseChange, startupPhase]);

  if (startupPhase === 'theme') {
    return <LoadingScreen message="Preparing your app..." />;
  }

  if (startupPhase === 'session') {
    return <LoadingScreen message="Restoring your account..." />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
      <LiveLocationIndicator />
      <EmergencySosIndicator />
    </>
  );
}

/**
 * Error handler for crash reporting.
 * In production, this would send to a service like Sentry.
 */
function handleError(error: Error, errorInfo: React.ErrorInfo) {
  if (__DEV__) {
    console.error('App Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  }
  captureError(error);
}

export default function App() {
  const [startupPhase, setStartupPhase] = useState<AppStartupPhase>('fonts');
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    initializeSentry();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError || fontLoadTimedOut) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFontLoadTimedOut(true);
      setStartupPhase('failed');
    }, FONT_LOAD_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [fontError, fontLoadTimedOut, fontsLoaded]);

  const fontsReady = fontsLoaded || Boolean(fontError) || fontLoadTimedOut;
  const loadingMessage = startupPhase === 'failed'
    ? 'Startup is taking longer than expected...'
    : 'Starting Wingman...';

  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary onError={handleError}>
        <SafeAreaProvider>
          <ThemeProvider>
            {!fontsReady ? (
              <LoadingScreen message={loadingMessage} />
            ) : (
              <NetworkProvider>
                <AuthProvider>
                  <VerificationProvider>
                    <RequirementsProvider>
                      <SafetyProvider>
                        <LiveLocationProvider>
                          <AppContent onPhaseChange={setStartupPhase} />
                        </LiveLocationProvider>
                      </SafetyProvider>
                    </RequirementsProvider>
                  </VerificationProvider>
                </AuthProvider>
              </NetworkProvider>
            )}
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
