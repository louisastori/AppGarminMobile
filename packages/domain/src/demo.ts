import {
  GARMIN_CONNECT_IQ_METRIC_KEYS,
  type GarminConnectIqBatchEnvelope,
  type GarminConnectIqDeviceCapabilities,
  type GarminConnectIqDeviceHello,
  type GarminConnectIqLinkStatus,
  type GarminConnectIqMetricKey,
  type GarminConnectIqMetricSample,
  type GarminConnectIqSnapshot,
  type GarminConnectIqSyncDiagnostic,
} from "@nouvelle-app/shared";
import type { GarminWatchHubSeed } from "./watch-models";
import { GarminWatchHub } from "./watch-hub";

function createMetricSample(
  metricKey: GarminConnectIqMetricKey,
  metricValue: number | string | boolean | null,
  metricUnit: string | null,
  recordedAt: string,
  sampleIndex: number,
): GarminConnectIqMetricSample {
  return {
    messageType: "metric_sample",
    sampleId: `sample-${sampleIndex.toString().padStart(4, "0")}`,
    recordedAt,
    metricKey,
    metricValue,
    metricUnit,
    sourceDomain: metricKey.startsWith("activity_") ? "activity" : "activity_monitor",
    quality: metricKey.startsWith("activity_") ? "live" : "snapshot",
  };
}

function createDemoSeed(): GarminWatchHubSeed {
  const hello: GarminConnectIqDeviceHello = {
    messageType: "device_hello",
    deviceId: "fenix7pro-demo",
    deviceKind: "fenix",
    deviceModel: "fenix 7 Pro",
    firmwareVersion: "18.22",
    appVersion: "0.1.0",
    timezoneOffsetMinutes: 120,
  };

  const capabilities: GarminConnectIqDeviceCapabilities = {
    messageType: "device_capabilities",
    supportedMetrics: GARMIN_CONNECT_IQ_METRIC_KEYS,
    supportsBufferedSync: true,
    supportsLiveMode: true,
    maxBatchItems: 32,
    maxBufferedSamples: 512,
  };

  const linkStatus: GarminConnectIqLinkStatus = {
    messageType: "link_status",
    recordedAt: "2026-04-03T10:00:00.000Z",
    health: "connected",
    pendingBatchCount: 1,
    lastBatchId: "batch-0002",
    lastErrorCode: null,
  };

  const snapshot: GarminConnectIqSnapshot = {
    messageType: "snapshot",
    snapshotId: "daily-0001",
    snapshotType: "daily",
    recordedAt: "2026-04-03T09:55:00.000Z",
    items: [
      createMetricSample("steps", 8244, null, "2026-04-03T09:55:00.000Z", 1),
      createMetricSample(
        "time_to_recovery_h",
        18,
        "h",
        "2026-04-03T09:55:00.000Z",
        2,
      ),
      createMetricSample(
        "body_battery_percent",
        76,
        "%",
        "2026-04-03T09:55:00.000Z",
        3,
      ),
    ],
  };

  const batchOne: GarminConnectIqBatchEnvelope = {
    messageType: "batch_envelope",
    batchId: "batch-0001",
    sequence: 1,
    createdAt: "2026-04-03T09:56:00.000Z",
    lastSampleId: "sample-0003",
    items: [snapshot],
  };

  const batchTwo: GarminConnectIqBatchEnvelope = {
    messageType: "batch_envelope",
    batchId: "batch-0002",
    sequence: 2,
    createdAt: "2026-04-03T10:00:30.000Z",
    lastSampleId: "sample-0006",
    items: [
      createMetricSample(
        "heart_rate_bpm",
        141,
        "bpm",
        "2026-04-03T10:00:30.000Z",
        4,
      ),
      createMetricSample(
        "stress_score",
        21,
        null,
        "2026-04-03T10:00:31.000Z",
        5,
      ),
      createMetricSample(
        "respiration_rate_bpm",
        14,
        "rpm",
        "2026-04-03T10:00:32.000Z",
        6,
      ),
    ],
  };

  const diagnostics: GarminConnectIqSyncDiagnostic[] = [
    {
      messageType: "sync_diagnostic",
      code: "phone_unreachable",
      message: "Le mobile n etait pas disponible pendant 18 secondes.",
      recordedAt: "2026-04-03T09:50:00.000Z",
      batchId: null,
    },
  ];

  return {
    hello,
    capabilities,
    linkStatus,
    batches: [batchOne, batchTwo],
    diagnostics,
  };
}

export function createDemoGarminWatchHub(): GarminWatchHub {
  return GarminWatchHub.fromSeed(createDemoSeed());
}
