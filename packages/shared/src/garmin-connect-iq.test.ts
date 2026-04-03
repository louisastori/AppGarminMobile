import { describe, it, expect } from "vitest";
import {
  createGarminConnectIqBatchAck,
  createGarminConnectIqSyncRequest,
  isGarminConnectIqBatchEnvelope,
  isGarminConnectIqDeviceCapabilities,
  isGarminConnectIqDeviceHello,
  isGarminConnectIqLinkStatus,
  isGarminConnectIqMetricSample,
  isGarminConnectIqSnapshot,
  isGarminConnectIqSyncDiagnostic,
} from "./garmin-connect-iq";

describe("garmin-connect-iq shared contract", () => {
  const hello = {
    messageType: "device_hello" as const,
    deviceId: "device-1",
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
    maxBatchItems: 32,
    maxBufferedSamples: 256,
  };

  const metric = {
    messageType: "metric_sample" as const,
    sampleId: "sample-1",
    recordedAt: "2026-04-03T10:00:00.000Z",
    metricKey: "heart_rate_bpm" as const,
    metricValue: 142,
    metricUnit: "bpm",
    sourceDomain: "activity" as const,
    quality: "live" as const,
  };

  const snapshot = {
    messageType: "snapshot" as const,
    snapshotId: "daily-1",
    snapshotType: "daily" as const,
    recordedAt: "2026-04-03T10:00:00.000Z",
    items: [metric],
  };

  const batch = {
    messageType: "batch_envelope" as const,
    batchId: "batch-1",
    sequence: 1,
    createdAt: "2026-04-03T10:01:00.000Z",
    lastSampleId: "sample-1",
    items: [snapshot, metric],
  };

  it("validates the core payload shapes", () => {
    expect(isGarminConnectIqDeviceHello(hello)).toBe(true);
    expect(isGarminConnectIqDeviceCapabilities(capabilities)).toBe(true);
    expect(isGarminConnectIqMetricSample(metric)).toBe(true);
    expect(isGarminConnectIqSnapshot(snapshot)).toBe(true);
    expect(isGarminConnectIqBatchEnvelope(batch)).toBe(true);
    expect(
      isGarminConnectIqLinkStatus({
        messageType: "link_status",
        recordedAt: "2026-04-03T10:01:00.000Z",
        health: "connected",
        pendingBatchCount: 1,
        lastBatchId: "batch-1",
        lastErrorCode: null,
      }),
    ).toBe(true);
    expect(
      isGarminConnectIqSyncDiagnostic({
        messageType: "sync_diagnostic",
        code: "phone_unreachable",
        message: "Device unreachable",
        recordedAt: "2026-04-03T10:01:00.000Z",
        batchId: null,
      }),
    ).toBe(true);
  });

  it("builds ACK and sync request helpers", () => {
    expect(
      createGarminConnectIqBatchAck(
        "batch-1",
        "sample-1",
        "2026-04-03T10:02:00.000Z",
      ),
    ).toEqual({
      messageType: "batch_ack",
      batchId: "batch-1",
      acknowledgedAt: "2026-04-03T10:02:00.000Z",
      lastSampleId: "sample-1",
    });

    expect(
      createGarminConnectIqSyncRequest(
        "manual",
        "request-1",
        "2026-04-03T10:03:00.000Z",
      ),
    ).toEqual({
      messageType: "sync_request",
      requestedAt: "2026-04-03T10:03:00.000Z",
      requestId: "request-1",
      reason: "manual",
    });
  });

  it("rejects malformed payloads", () => {
    expect(isGarminConnectIqDeviceHello({ ...hello, deviceKind: "unknown" })).toBe(
      false,
    );
    expect(
      isGarminConnectIqBatchEnvelope({ ...batch, sequence: "one" }),
    ).toBe(false);
    expect(
      isGarminConnectIqMetricSample({ ...metric, metricValue: { raw: 12 } }),
    ).toBe(false);
  });
});
