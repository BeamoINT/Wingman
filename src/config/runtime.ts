import Constants from 'expo-constants';
import { Platform } from 'react-native';

const executionEnvironment = String(Constants.executionEnvironment || '').toLowerCase();
const appOwnership = String(Constants.appOwnership || '').toLowerCase();

export const isExpoGo = executionEnvironment === 'storeclient' || appOwnership === 'expo';
export const isNativeMobile = Platform.OS === 'ios' || Platform.OS === 'android';
export const supportsNativeMediaCompression = isNativeMobile && !isExpoGo;

