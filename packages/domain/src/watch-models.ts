import type {
  GarminConnectIqBatchAck,
  GarminConnectIqBatchEnvelope,
  GarminConnectIqDeviceCapabilities,
  GarminConnectIqDeviceHello,
  GarminConnectIqDeviceKind,
  GarminConnectIqLinkHealth,
  GarminConnectIqLinkStatus,
  GarminConnectIqMetricKey,
  GarminConnectIqMetricSample,
  GarminConnectIqSnapshot,
  GarminConnectIqSyncDiagnostic,
  GarminConnectIqSyncDiagnosticCode,
} from "@nouvelle-app/shared";

export type WatchSyncJobKind = "batch" | "diagnostic" | "link_status";
export type WatchSyncJobOutcome =
  | "accepted"
  | "duplicate"
  | "rejected"
  | "recorded";

export interface WatchDeviceRecord {
  readonly deviceId: string;
  readonly deviceKind: GarminConnectIqDeviceKind | null;
  readonly deviceModel: string | null;
  readonly firmwareVersion: string | null;
  readonly appVersion: string | null;
  readonly timezoneOffsetMinutes: number | null;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly lastSuccessfulSyncAt: string | null;
  readonly lastBatchId: string | null;
  readonly lastAckCursor: string | null;
  readonly pendingBatchCount: number;
  readonly health: GarminConnectIqLinkHealth;
  readonly capabilities: GarminConnectIqDeviceCapabilities | null;
  readonly lastDiagnostic: GarminConnectIqSyncDiagnostic | null;
  readonly totalAcceptedSamples: number;
  readonly totalDuplicateSamples: number;
}

export interface WatchMetricRecord extends GarminConnectIqMetricSample {
  readonly deviceId: string;
  readonly batchId: string | null;
  readonly snapshotId: string | null;
  readonly ingestedAt: string;
}

export interface WatchSnapshotRecord extends GarminConnectIqSnapshot {
  readonly deviceId: string;
  readonly batchId: string;
  readonly ingestedAt: string;
}

export interface WatchBatchRecord {
  readonly deviceId: string;
  readonly batchId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly ingestedAt: string;
  readonly itemCount: number;
  readonly lastSampleId: string | null;
  readonly rawBatch: GarminConnectIqBatchEnvelope;
}

export interface WatchSyncJobRecord {
  readonly jobId: string;
  readonly deviceId: string;
  readonly kind: WatchSyncJobKind;
  readonly outcome: WatchSyncJobOutcome;
  readonly createdAt: string;
  readonly batchId: string | null;
  readonly sampleCount: number;
  readonly duplicateSampleCount: number;
  readonly summary: string;
  readonly rawPayload: unknown;
}

export interface WatchIngestRejectionRecord {
  readonly deviceId: string;
  readonly batchId: string | null;
  readonly recordedAt: string;
  readonly reason: string;
  readonly rawPayload: unknown;
}

export interface WatchDeviceSummary {
  readonly deviceId: string;
  readonly deviceKind: GarminConnectIqDeviceKind | null;
  readonly deviceModel: string | null;
  readonly health: GarminConnectIqLinkHealth;
  readonly pendingBatchCount: number;
  readonly lastBatchId: string | null;
  readonly lastSuccessfulSyncAt: string | null;
  readonly metricsTracked: number;
  readonly snapshotsTracked: number;
  readonly totalAcceptedSamples: number;
  readonly totalDuplicateSamples: number;
  readonly lastDiagnosticCode: GarminConnectIqSyncDiagnosticCode | null;
}

export interface WatchStatusView {
  readonly device: WatchDeviceRecord;
  readonly latestMetrics: WatchMetricRecord[];
  readonly recentSyncJobs: WatchSyncJobRecord[];
  readonly recentRejections: WatchIngestRejectionRecord[];
}

export interface WatchBatchIngestResult {
  readonly deviceId: string;
  readonly accepted: boolean;
  readonly duplicateBatch: boolean;
  readonly acceptedSampleCount: number;
  readonly duplicateSampleCount: number;
  readonly snapshotCount: number;
  readonly ack: GarminConnectIqBatchAck;
  readonly job: WatchSyncJobRecord;
}

export interface GarminWatchHubState {
  readonly devices: WatchDeviceRecord[];
  readonly metrics: WatchMetricRecord[];
  readonly snapshots: WatchSnapshotRecord[];
  readonly batches: WatchBatchRecord[];
  readonly syncJobs: WatchSyncJobRecord[];
  readonly rejections: WatchIngestRejectionRecord[];
  readonly nextJobSequence: number;
}

export interface MetricHistoryQuery {
  readonly metricKey?: GarminConnectIqMetricKey;
  readonly limit?: number;
}

export interface WatchStatusSummary {
  readonly deviceId: string;
  readonly health: GarminConnectIqLinkHealth;
  readonly lastBatchId: string | null;
  readonly lastSuccessfulSyncAt: string | null;
  readonly pendingBatchCount: number;
  readonly lastDiagnostic: GarminConnectIqSyncDiagnostic | null;
  readonly latestMetrics: WatchMetricRecord[];
}

export interface GarminWatchHubSeed {
  readonly hello: GarminConnectIqDeviceHello;
  readonly capabilities: GarminConnectIqDeviceCapabilities;
  readonly linkStatus: GarminConnectIqLinkStatus;
  readonly batches: GarminConnectIqBatchEnvelope[];
  readonly diagnostics?: GarminConnectIqSyncDiagnostic[];
}
