import { Platform } from 'react-native';

import type { GarminConnectIqBridge, GarminConnectIqBridgeConfig } from './bridge';
import { garminConnectIqNativeModule } from './native';
import { MockGarminConnectIqBridge } from './mockBridge';
import { RealGarminConnectIqBridge } from './realBridge';

export function createGarminConnectIqBridge(
  config: GarminConnectIqBridgeConfig,
): GarminConnectIqBridge {
  if (Platform.OS === 'android' && garminConnectIqNativeModule) {
    return new RealGarminConnectIqBridge(config);
  }

  return new MockGarminConnectIqBridge(config);
}
