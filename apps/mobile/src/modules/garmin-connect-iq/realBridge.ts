import type { EmitterSubscription } from 'react-native';

import {
  createGarminConnectIqBatchAck,
  isGarminConnectIqBatchEnvelope,
  isGarminConnectIqDeviceCapabilities,
  isGarminConnectIqSyncDiagnostic,
} from './contract';
import {
  GARMIN_CONNECT_IQ_NATIVE_EVENTS,
  GARMIN_CONNECT_IQ_WATCH_APP_ID,
  garminConnectIqNativeEventEmitter,
  garminConnectIqNativeModule,
} from './native';
import type {
  GarminConnectIqBridge,
  GarminConnectIqBridgeListener,
  GarminConnectIqBridgeStatus,
} from './bridge';
import { createGarminConnectIqBridgeStatus } from './bridge';
import type {
  GarminConnectIqBatchAck,
  GarminConnectIqBatchEnvelope,
  GarminConnectIqDeviceCapabilities,
  GarminConnectIqDeviceHello,
  GarminConnectIqSyncDiagnostic,
} from './types';

type NativeStatusPayload = Partial<GarminConnectIqBridgeStatus> & {
  deviceHello?: GarminConnectIqDeviceHello | null;
  capabilities?: GarminConnectIqDeviceCapabilities | null;
  lastDiagnostic?: GarminConnectIqSyncDiagnostic | null;
};

function isStatusPayload(value: unknown): value is NativeStatusPayload {
  return typeof value === 'object' && value !== null;
}

export class RealGarminConnectIqBridge implements GarminConnectIqBridge {
  private status: GarminConnectIqBridgeStatus = createGarminConnectIqBridgeStatus();
  private listener?: GarminConnectIqBridgeListener;
  private subscriptions: EmitterSubscription[] = [];

  async getStatus(): Promise<GarminConnectIqBridgeStatus> {
    if (!garminConnectIqNativeModule) {
      console.log('[GarminConnectIqBridge] native module unavailable during getStatus');
      return this.status;
    }

    const payload = await garminConnectIqNativeModule.getStatus();
    this.status = this.mergeStatusPayload(payload);
    console.log('[GarminConnectIqBridge] getStatus', JSON.stringify(this.status));
    return this.status;
  }

  async connect(listener?: GarminConnectIqBridgeListener): Promise<void> {
    if (!garminConnectIqNativeModule || !garminConnectIqNativeEventEmitter) {
      throw new Error('Garmin Connect IQ native bridge unavailable');
    }

    this.listener = listener;
    this.attachSubscriptions();
    console.log('[GarminConnectIqBridge] initialize start');
    const payload = await garminConnectIqNativeModule.initialize({
      appId: GARMIN_CONNECT_IQ_WATCH_APP_ID,
      preferredDeviceName: 'fenix',
      preferredDeviceKind: 'fenix',
    });

    this.status = this.mergeStatusPayload(payload);
    console.log('[GarminConnectIqBridge] initialize result', JSON.stringify(this.status));
    this.listener?.onStatusChanged?.(this.status);
  }

  async disconnect(): Promise<void> {
    this.detachSubscriptions();
    this.listener = undefined;

    if (garminConnectIqNativeModule) {
      await garminConnectIqNativeModule.shutdown();
    }

    this.status = createGarminConnectIqBridgeStatus();
  }

  async acknowledgeBatch(ack: GarminConnectIqBatchAck): Promise<void> {
    if (!garminConnectIqNativeModule) {
      return;
    }

    await garminConnectIqNativeModule.acknowledgeBatch(JSON.stringify(ack));
  }

  async requestSyncNow(): Promise<void> {
    if (!garminConnectIqNativeModule) {
      return;
    }

    await garminConnectIqNativeModule.requestSyncNow();
  }

  private attachSubscriptions(): void {
    this.detachSubscriptions();

    if (!garminConnectIqNativeEventEmitter) {
      return;
    }

    this.subscriptions = [
      garminConnectIqNativeEventEmitter.addListener(
        GARMIN_CONNECT_IQ_NATIVE_EVENTS.statusChanged,
        (payload: unknown) => {
          this.status = this.mergeStatusPayload(payload);
          console.log('[GarminConnectIqBridge] statusChanged', JSON.stringify(this.status));
          this.listener?.onStatusChanged?.(this.status);
        },
      ),
      garminConnectIqNativeEventEmitter.addListener(
        GARMIN_CONNECT_IQ_NATIVE_EVENTS.batchReceived,
        (payload: { batchJson?: string } | undefined) => {
          if (!payload?.batchJson) {
            return;
          }

          try {
            const parsed = JSON.parse(payload.batchJson) as unknown;
            if (isGarminConnectIqBatchEnvelope(parsed)) {
              console.log('[GarminConnectIqBridge] batchReceived', parsed.batchId);
              this.listener?.onBatchReceived?.(parsed);
              void this.acknowledgeBatch(
                createGarminConnectIqBatchAck(parsed.batchId, parsed.lastSampleId),
              );
            }
          } catch {
            // Ignore malformed batches and rely on diagnostics from native.
          }
        },
      ),
      garminConnectIqNativeEventEmitter.addListener(
        GARMIN_CONNECT_IQ_NATIVE_EVENTS.diagnostic,
        (payload: unknown) => {
          if (isGarminConnectIqSyncDiagnostic(payload)) {
            console.log('[GarminConnectIqBridge] diagnostic', JSON.stringify(payload));
            this.status = {
              ...this.status,
              lastDiagnostic: payload,
            };
            this.listener?.onDiagnostic?.(payload);
            this.listener?.onStatusChanged?.(this.status);
          }
        },
      ),
    ];
  }

  private detachSubscriptions(): void {
    for (const subscription of this.subscriptions) {
      subscription.remove();
    }

    this.subscriptions = [];
  }

  private mergeStatusPayload(payload: unknown): GarminConnectIqBridgeStatus {
    if (!isStatusPayload(payload)) {
      return this.status;
    }

    return {
      health: payload.health ?? this.status.health,
      linkStatus: payload.linkStatus ?? this.status.linkStatus,
      deviceHello: payload.deviceHello ?? this.status.deviceHello,
      capabilities:
        payload.capabilities && isGarminConnectIqDeviceCapabilities(payload.capabilities)
          ? payload.capabilities
          : this.status.capabilities,
      lastBatchId: payload.lastBatchId ?? this.status.lastBatchId,
      pendingBatchCount:
        typeof payload.pendingBatchCount === 'number'
          ? payload.pendingBatchCount
          : this.status.pendingBatchCount,
      lastDiagnostic:
        payload.lastDiagnostic && isGarminConnectIqSyncDiagnostic(payload.lastDiagnostic)
          ? payload.lastDiagnostic
          : this.status.lastDiagnostic,
    };
  }
}
