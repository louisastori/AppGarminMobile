import { describe, expect, it } from "vitest";
import { GarminWatchHub } from "./watch-hub";

describe("GarminWatchHub", () => {
  const hello = {
    messageType: "device_hello" as const,
    deviceId: "fenix-demo",
    deviceKind: "fenix" as const,
    deviceModel: "fenix 7 Pro",
    firmwareVersion: "18.22",
    appVersion: "0.1.0",
    timezoneOffsetMinutes: 120,
  };

  const capabilities = {
    messageType: "device_capabilities" as const,
    supportedMetrics: ["heart_rate_bpm", "steps"] as const,
    supportsBufferedSync: true,
    supportsLiveMode: true,
    maxBatchItems: 24,
    maxBufferedSamples: 128,
  };

  const batch = {
    messageType: "batch_envelope" as const,
    batchId: "batch-001",
    sequence: 1,
    createdAt: "2026-04-03T10:00:00.000Z",
    lastSampleId: "sample-002",
    items: [
      {
        messageType: "metric_sample" as const,
        sampleId: "sample-001",
        recordedAt: "2026-04-03T09:59:30.000Z",
        metricKey: "heart_rate_bpm" as const,
        metricValue: 140,
        metricUnit: "bpm",
        sourceDomain: "activity" as const,
        quality: "live" as const,
      },
      {
        messageType: "snapshot" as const,
        snapshotId: "daily-001",
        snapshotType: "daily" as const,
        recordedAt: "2026-04-03T10:00:00.000Z",
        items: [
          {
            messageType: "metric_sample" as const,
            sampleId: "sample-002",
            recordedAt: "2026-04-03T10:00:00.000Z",
            metricKey: "steps" as const,
            metricValue: 8244,
            metricUnit: null,
            sourceDomain: "activity_monitor" as const,
            quality: "snapshot" as const,
          },
        ],
      },
    ],
  };

  it("records hello, capabilities and batches with deduplication", () => {
    const hub = new GarminWatchHub();
    hub.recordDeviceHello(hello);
    hub.recordCapabilities(hello.deviceId, capabilities);

    const firstResult = hub.ingestBatch(hello.deviceId, batch);
    expect(firstResult.accepted).toBe(true);
    expect(firstResult.acceptedSampleCount).toBe(2);
    expect(hub.getLatestMetrics(hello.deviceId)).toHaveLength(2);
    expect(hub.getSnapshots(hello.deviceId)).toHaveLength(1);

    const duplicateResult = hub.ingestBatch(hello.deviceId, batch);
    expect(duplicateResult.duplicateBatch).toBe(true);
    expect(hub.getSyncJobs(hello.deviceId)[0]?.outcome).toBe("duplicate");

    const summary = hub.listDevices()[0];
    expect(summary).toMatchObject({
      deviceId: hello.deviceId,
      metricsTracked: 2,
      snapshotsTracked: 1,
      totalAcceptedSamples: 2,
    });
  });

  it("serializes and restores state", () => {
    const hub = new GarminWatchHub();
    hub.recordDeviceHello(hello);
    hub.ingestBatch(hello.deviceId, batch);
    hub.recordDiagnostic(hello.deviceId, {
      messageType: "sync_diagnostic",
      code: "phone_unreachable",
      message: "Watch not connected",
      recordedAt: "2026-04-03T10:01:00.000Z",
      batchId: null,
    });

    const restored = GarminWatchHub.fromState(hub.toState());
    expect(restored.getDevice(hello.deviceId)?.deviceModel).toBe("fenix 7 Pro");
    expect(restored.getMetricHistory(hello.deviceId)).toHaveLength(2);
    expect(restored.getStatusSummary(hello.deviceId)?.lastDiagnostic?.code).toBe(
      "phone_unreachable",
    );
  });
});
