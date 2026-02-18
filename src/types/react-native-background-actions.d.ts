declare module 'react-native-background-actions' {
  export interface BackgroundTaskOptions {
    taskName: string;
    taskTitle: string;
    taskDesc: string;
    taskIcon?: {
      name: string;
      type: string;
      package?: string;
    };
    color?: string;
    linkingURI?: string;
    parameters?: Record<string, unknown>;
  }

  interface BackgroundActionsModule {
    start(task: () => Promise<void>, options: BackgroundTaskOptions): Promise<void>;
    stop(): Promise<void>;
    isRunning(): boolean;
    updateNotification?(options: Partial<BackgroundTaskOptions>): Promise<void>;
  }

  const BackgroundActions: BackgroundActionsModule;
  export default BackgroundActions;
}

