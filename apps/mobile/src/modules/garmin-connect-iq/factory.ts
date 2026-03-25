import { Platform } from 'react-native';

import type { GarminConnectIqBridge } from './bridge';
import { garminConnectIqNativeModule } from './native';
import { MockGarminConnectIqBridge } from './mockBridge';
import { RealGarminConnectIqBridge } from './realBridge';

export function createGarminConnectIqBridge(): GarminConnectIqBridge {
  if (Platform.OS === 'android' && garminConnectIqNativeModule) {
    return new RealGarminConnectIqBridge();
  }

  return new MockGarminConnectIqBridge();
}
