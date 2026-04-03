import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export const GARMIN_CONNECT_IQ_WATCH_APP_ID =
  '5f9c2f5c-28bc-4af2-9f72-5e515d13a7f0';
export const GARMIN_CONNECT_IQ_EDGE_APP_ID =
  '1cbb5133-7f4d-4e79-a6e5-4b3f8b7de7d1';

export const GARMIN_CONNECT_IQ_NATIVE_EVENTS = {
  statusChanged: 'garminConnectIqStatusChanged',
  batchReceived: 'garminConnectIqBatchReceived',
  diagnostic: 'garminConnectIqDiagnostic',
} as const;

export interface GarminConnectIqNativeInitializeOptions {
  appId: string;
  preferredDeviceName?: string;
  preferredDeviceKind?: 'fenix' | 'edge';
}

export interface GarminConnectIqNativeModule {
  initialize(options: GarminConnectIqNativeInitializeOptions): Promise<unknown>;
  getStatus(): Promise<unknown>;
  shutdown(): Promise<void>;
  requestSyncNow(): Promise<void>;
  acknowledgeBatch(payloadJson: string): Promise<void>;
  sendMessage(payloadJson: string): Promise<void>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const nativeModule =
  Platform.OS === 'android'
    ? (NativeModules.GarminConnectIq as GarminConnectIqNativeModule | undefined)
    : undefined;

export const garminConnectIqNativeModule = nativeModule ?? null;
export const garminConnectIqNativeEventEmitter = nativeModule
  ? new NativeEventEmitter(nativeModule)
  : null;
