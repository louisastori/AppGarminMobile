import type {
  GarminConnectIqBatchAck,
  GarminConnectIqBatchEnvelope,
  GarminConnectIqDeviceCapabilities,
  GarminConnectIqDeviceHello,
  GarminConnectIqLinkHealth,
  GarminConnectIqLinkStatus,
  GarminConnectIqSyncDiagnostic,
} from "./types";

export interface GarminConnectIqBridgeConfig {
  appId: string;
  preferredDeviceName?: string;
  preferredDeviceKind?: "fenix" | "edge";
}

export type GarminConnectIqAutoSyncMode = "off" | "idle" | "activity";

export interface GarminConnectIqBridgeStatus {
  health: GarminConnectIqLinkHealth;
  linkStatus: GarminConnectIqLinkStatus | null;
  deviceHello: GarminConnectIqDeviceHello | null;
  capabilities: GarminConnectIqDeviceCapabilities | null;
  lastBatchId: string | null;
  pendingBatchCount: number;
  lastBatch: GarminConnectIqBatchEnvelope | null;
  lastDiagnostic: GarminConnectIqSyncDiagnostic | null;
  autoSyncMode: GarminConnectIqAutoSyncMode;
  autoSyncIntervalMs: number | null;
  autoSyncNextAt: string | null;
  activityActive: boolean;
}

export function createGarminConnectIqBridgeStatus(): GarminConnectIqBridgeStatus {
  return {
    health: "disconnected",
    linkStatus: null,
    deviceHello: null,
    capabilities: null,
    lastBatchId: null,
    pendingBatchCount: 0,
    lastBatch: null,
    lastDiagnostic: null,
    autoSyncMode: "off",
    autoSyncIntervalMs: null,
    autoSyncNextAt: null,
    activityActive: false,
  };
}

export interface GarminConnectIqBridgeListener {
  onStatusChanged?(status: GarminConnectIqBridgeStatus): void;
  onBatchReceived?(batch: GarminConnectIqBatchEnvelope): void;
  onDiagnostic?(diagnostic: GarminConnectIqSyncDiagnostic): void;
}

export interface GarminConnectIqBridge {
  getStatus(): Promise<GarminConnectIqBridgeStatus>;
  connect(listener?: GarminConnectIqBridgeListener): Promise<void>;
  disconnect(): Promise<void>;
  acknowledgeBatch(ack: GarminConnectIqBatchAck): Promise<void>;
  requestSyncNow(): Promise<void>;
}
