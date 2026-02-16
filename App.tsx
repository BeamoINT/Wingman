import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary, LoadingScreen } from './src/components';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { RequirementsProvider } from './src/context/RequirementsContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { VerificationProvider } from './src/context/VerificationContext';
import { RootNavigator } from './src/navigation';
import { captureError, initializeSentry } from './src/services/monitoring/sentry';

// Disable strict mode warnings for shared value reads during render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

/**
 * Inner app component that has access to contexts.
 */
function AppContent() {
  const { isRestoringSession } = useAuth();
  const { isDark, isThemeReady } = useTheme();

  if (!isThemeReady) {
    return <LoadingScreen message="Loading your appearance..." />;
  }

  if (isRestoringSession) {
    return <LoadingScreen message="Restoring your session..." />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
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
  initializeSentry();

  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary onError={handleError}>
        <SafeAreaProvider>
          <ThemeProvider>
            {!fontsReady ? (
              <LoadingScreen message="Loading fonts..." />
            ) : (
              <NetworkProvider>
                <AuthProvider>
                  <VerificationProvider>
                    <RequirementsProvider>
                      <AppContent />
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
