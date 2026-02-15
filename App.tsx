import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary, LoadingScreen, OfflineBanner } from './src/components';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NetworkProvider } from './src/context/NetworkContext';
import { RequirementsProvider } from './src/context/RequirementsContext';
import { VerificationProvider } from './src/context/VerificationContext';
import { RootNavigator } from './src/navigation';

// Disable strict mode warnings for shared value reads during render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

/**
 * Inner app component that has access to auth context.
 * Shows loading screen while restoring session.
 */
function AppContent() {
  const { isRestoringSession } = useAuth();

  if (isRestoringSession) {
    return <LoadingScreen message="Restoring your session..." />;
  }

  return (
    <>
      <OfflineBanner />
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
  // In production: send to crash reporting service
  // crashlytics.recordError(error);
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ErrorBoundary onError={handleError}>
        <SafeAreaProvider>
          <NetworkProvider>
            <AuthProvider>
              <VerificationProvider>
                <RequirementsProvider>
                  <StatusBar style="light" />
                  <AppContent />
                </RequirementsProvider>
              </VerificationProvider>
            </AuthProvider>
          </NetworkProvider>
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
