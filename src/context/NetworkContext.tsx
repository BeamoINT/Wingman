import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { NetworkStatus, useNetworkStatus } from '../hooks/useNetworkStatus';

interface NetworkContextValue extends NetworkStatus {
  /**
   * Queue a function to be called when network is restored.
   * Useful for retrying failed requests.
   */
  queueOnReconnect: (callback: () => void) => void;
  /**
   * Clear all queued callbacks.
   */
  clearQueue: () => void;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

/**
 * Provides network status to the entire app and manages
 * a queue of callbacks to execute when connection is restored.
 */
export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const networkStatus = useNetworkStatus();
  const reconnectQueue = useRef<Array<() => void>>([]);
  const wasOffline = useRef(false);

  const queueOnReconnect = useCallback((callback: () => void) => {
    reconnectQueue.current.push(callback);
  }, []);

  const clearQueue = useCallback(() => {
    reconnectQueue.current = [];
  }, []);

  // When connection is restored, execute queued callbacks
  useEffect(() => {
    const isOnline = networkStatus.isConnected &&
      (networkStatus.isInternetReachable === true || networkStatus.isInternetReachable === null);

    if (isOnline && wasOffline.current) {
      // Connection restored - execute queued callbacks
      const callbacks = [...reconnectQueue.current];
      reconnectQueue.current = [];

      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          if (__DEV__) {
            console.warn('Reconnect callback failed:', error);
          }
        }
      });
    }

    wasOffline.current = !isOnline;
  }, [networkStatus.isConnected, networkStatus.isInternetReachable]);

  const value: NetworkContextValue = {
    ...networkStatus,
    queueOnReconnect,
    clearQueue,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

/**
 * Hook to access network status and reconnection queue.
 */
export function useNetwork(): NetworkContextValue {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

/**
 * Simple hook that returns just the online/offline status.
 */
export function useIsConnected(): boolean {
  const { isConnected, isInternetReachable } = useNetwork();
  return isConnected && (isInternetReachable === true || isInternetReachable === null);
}
