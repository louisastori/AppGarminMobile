import { describe, expect, it } from "vitest";
import { MockGarminConnectIqBridge } from "./mockBridge";
import { WatchAckService } from "./ackService";
import { WatchIngressService } from "./ingressService";
import { WatchLinkService } from "./linkService";
import { WatchStorageService } from "./storageService";
import { createGarminConnectIqBridgeStatus } from "./bridge";

describe("mobile Connect IQ services", () => {
  const hello = {
    messageType: "device_hello" as const,
    deviceId: "device-1",
    deviceKind: "fenix" as const,
    deviceModel: "fenix 7 Pro",
    firmwareVersion: "18.22",
    appVersion: "0.1.0",
    timezoneOffsetMinutes: 120,
  };

  const batch = {
    messageType: "batch_envelope" as const,
    batchId: "batch-001",
    sequence: 1,
    createdAt: "2026-04-03T10:00:00.000Z",
    lastSampleId: "sample-001",
    items: [
      {
        messageType: "metric_sample" as const,
        sampleId: "sample-001",
        recordedAt: "2026-04-03T10:00:00.000Z",
        metricKey: "heart_rate_bpm" as const,
        metricValue: 141,
        metricUnit: "bpm",
        sourceDomain: "activity" as const,
        quality: "live" as const,
      },
    ],
  };

  it("stores ingress messages and exposes diagnostic views", () => {
    const storage = new WatchStorageService();
    const ingress = new WatchIngressService(storage);
    const link = new WatchLinkService(storage);

    expect(ingress.ingestMessage("device-1", hello).accepted).toBe(true);
    expect(
      ingress.ingestMessage("device-1", {
        messageType: "device_capabilities",
        supportedMetrics: ["heart_rate_bpm"],
        supportsBufferedSync: true,
        supportsLiveMode: true,
        maxBatchItems: 32,
        maxBufferedSamples: 256,
      }).accepted,
    ).toBe(true);
    expect(
      ingress.ingestMessage("device-1", {
        messageType: "link_status",
        recordedAt: "2026-04-03T10:00:10.000Z",
        health: "connected",
        pendingBatchCount: 1,
        lastBatchId: null,
        lastErrorCode: null,
      }).accepted,
    ).toBe(true);
    const batchResult = ingress.ingestMessage("device-1", batch);
    expect(batchResult.ack?.batchId).toBe("batch-001");
    expect(ingress.ingestMessage("device-1", batch).reason).toBe("duplicate_batch");

    storage.recordDiagnostic("device-1", {
      messageType: "sync_diagnostic",
      code: "phone_unreachable",
      message: "Phone unreachable",
      recordedAt: "2026-04-03T10:01:00.000Z",
      batchId: null,
    });

    expect(link.getDiagnosticView("device-1")?.lastDiagnosticMessage).toBe(
      "Phone unreachable",
    );
    expect(link.getLiveMetrics("device-1")).toHaveLength(1);
    expect(link.getDiagnosticView("missing-device")).toBeNull();
  });

  it("builds ACKs and persists/rehydrates storage state", () => {
    const storage = new WatchStorageService();
    storage.recordDeviceHello(hello);
    storage.ingestBatch("device-1", batch);
    storage.recordCapabilities("device-1", {
      messageType: "device_capabilities",
      supportedMetrics: ["heart_rate_bpm"],
      supportsBufferedSync: true,
      supportsLiveMode: true,
      maxBatchItems: 8,
      maxBufferedSamples: 16,
    });
    storage.recordLinkStatus("device-1", {
      messageType: "link_status",
      recordedAt: "2026-04-03T10:01:00.000Z",
      health: "connected",
      pendingBatchCount: 0,
      lastBatchId: "batch-001",
      lastErrorCode: null,
    });
    expect(storage.listDevices()).toHaveLength(1);
    expect(storage.getStatusView("device-1")?.latestMetrics).toHaveLength(1);
    expect(storage.getMetricHistory("device-1")).toHaveLength(1);

    const ackService = new WatchAckService();
    expect(ackService.acknowledgeBatch(batch).batchId).toBe("batch-001");

    const restored = new WatchStorageService(storage.exportState());
    expect(restored.getStatusSummary("device-1")?.latestMetrics).toHaveLength(1);
  });

  it("rejects mismatched, unknown and watch error payloads", () => {
    const storage = new WatchStorageService();
    const ingress = new WatchIngressService(storage);

    expect(
      ingress.ingestMessage("device-1", {
        ...hello,
        deviceId: "device-2",
      }).reason,
    ).toBe("device_id_mismatch");

    expect(
      ingress.ingestMessage("device-1", {
        messageType: "watch_error",
        code: "invalid_payload",
        message: "bad payload",
        recordedAt: "2026-04-03T10:00:00.000Z",
        batchId: null,
      }).reason,
    ).toBe("invalid_payload");

    expect(ingress.ingestMessage("device-1", { nope: true }).reason).toBe(
      "unknown_message",
    );
    expect(storage.getHub().getRejections("device-1")).toHaveLength(3);
  });

  it("simulates bridge traffic through the mock bridge", async () => {
    const bridge = new MockGarminConnectIqBridge({
      appId: "app-id",
      preferredDeviceKind: "edge",
    });

    const statuses: string[] = [];
    let lastBatchId: string | null = null;

    await bridge.connect({
      onStatusChanged(status) {
        statuses.push(status.health);
      },
      onBatchReceived(batchEnvelope) {
        lastBatchId = batchEnvelope.batchId;
      },
    });

    expect(statuses).toContain("connected");
    expect(lastBatchId).toContain("ciq-edge");
    await bridge.requestSyncNow();
    expect((await bridge.getStatus()).pendingBatchCount).toBeGreaterThan(0);

    if (lastBatchId) {
      await bridge.acknowledgeBatch({
        messageType: "batch_ack",
        batchId: lastBatchId,
        acknowledgedAt: "2026-04-03T10:02:00.000Z",
        lastSampleId: null,
      });
    }

    expect((await bridge.getStatus()).lastBatchId).toBe(lastBatchId);
    await bridge.disconnect();
    expect((await bridge.getStatus()).health).toBe("disconnected");
  });

  it("surfaces the disconnected manual sync diagnostic in the mock bridge", async () => {
    const bridge = new MockGarminConnectIqBridge({
      appId: "app-id",
    });

    let diagnosticCode: string | null = null;
    await bridge.connect();
    await bridge.disconnect();
    await bridge.connect({
      onDiagnostic(diagnostic) {
        diagnosticCode = diagnostic.code;
      },
    });
    await bridge.disconnect();
    await bridge.requestSyncNow();
    expect(diagnosticCode).toBe("phone_unreachable");
  });

  it("creates an empty bridge status snapshot", () => {
    expect(createGarminConnectIqBridgeStatus()).toEqual({
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
    });
  });
});
