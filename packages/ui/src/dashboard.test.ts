import { describe, expect, it } from "vitest";
import { renderDeviceDashboard, formatMetricValue } from "./dashboard";

describe("dashboard ui", () => {
  it("formats metric values", () => {
    expect(
      formatMetricValue({
        messageType: "metric_sample",
        sampleId: "sample-001",
        recordedAt: "2026-04-03T10:00:00.000Z",
        metricKey: "heart_rate_bpm",
        metricValue: 141,
        metricUnit: "bpm",
        sourceDomain: "activity",
        quality: "live",
        deviceId: "device-1",
        batchId: "batch-1",
        snapshotId: null,
        ingestedAt: "2026-04-03T10:00:01.000Z",
      }),
    ).toBe("141 bpm");
  });

  it("formats null, boolean and string metric values", () => {
    expect(
      formatMetricValue({
        messageType: "metric_sample",
        sampleId: "sample-002",
        recordedAt: "2026-04-03T10:00:00.000Z",
        metricKey: "activity_timer_state",
        metricValue: "running",
        metricUnit: null,
        sourceDomain: "activity",
        quality: "live",
        deviceId: "device-1",
        batchId: "batch-1",
        snapshotId: null,
        ingestedAt: "2026-04-03T10:00:01.000Z",
      }),
    ).toBe("running");

    expect(
      formatMetricValue({
        messageType: "metric_sample",
        sampleId: "sample-003",
        recordedAt: "2026-04-03T10:00:00.000Z",
        metricKey: "activity_timer_state",
        metricValue: true,
        metricUnit: null,
        sourceDomain: "activity",
        quality: "live",
        deviceId: "device-1",
        batchId: "batch-1",
        snapshotId: null,
        ingestedAt: "2026-04-03T10:00:01.000Z",
      }),
    ).toBe("yes");

    expect(
      formatMetricValue({
        messageType: "metric_sample",
        sampleId: "sample-004",
        recordedAt: "2026-04-03T10:00:00.000Z",
        metricKey: "spo2_percent",
        metricValue: null,
        metricUnit: "%",
        sourceDomain: "sensor",
        quality: "live",
        deviceId: "device-1",
        batchId: "batch-1",
        snapshotId: null,
        ingestedAt: "2026-04-03T10:00:01.000Z",
      }),
    ).toBe("n/a");
  });

  it("renders an HTML dashboard", () => {
    const html = renderDeviceDashboard(
      "Test Dashboard",
      [
        {
          deviceId: "device-1",
          deviceKind: "fenix",
          deviceModel: "fenix 7 Pro",
          health: "connected",
          pendingBatchCount: 0,
          lastBatchId: "batch-1",
          lastSuccessfulSyncAt: "2026-04-03T10:00:01.000Z",
          metricsTracked: 1,
          snapshotsTracked: 1,
          totalAcceptedSamples: 1,
          totalDuplicateSamples: 0,
          lastDiagnosticCode: null,
        },
      ],
      {
        device: {
          deviceId: "device-1",
          deviceKind: "fenix",
          deviceModel: "fenix 7 Pro",
          firmwareVersion: "18.22",
          appVersion: "0.1.0",
          timezoneOffsetMinutes: 120,
          firstSeenAt: "2026-04-03T10:00:00.000Z",
          lastSeenAt: "2026-04-03T10:00:01.000Z",
          lastSuccessfulSyncAt: "2026-04-03T10:00:01.000Z",
          lastBatchId: "batch-1",
          lastAckCursor: "sample-1",
          pendingBatchCount: 0,
          health: "connected",
          capabilities: null,
          lastDiagnostic: null,
          totalAcceptedSamples: 1,
          totalDuplicateSamples: 0,
        },
        latestMetrics: [
          {
            messageType: "metric_sample",
            sampleId: "sample-1",
            recordedAt: "2026-04-03T10:00:00.000Z",
            metricKey: "heart_rate_bpm",
            metricValue: 141,
            metricUnit: "bpm",
            sourceDomain: "activity",
            quality: "live",
            deviceId: "device-1",
            batchId: "batch-1",
            snapshotId: null,
            ingestedAt: "2026-04-03T10:00:01.000Z",
          },
        ],
        recentSyncJobs: [],
        recentRejections: [],
      },
    );

    expect(html).toContain("Test Dashboard");
    expect(html).toContain("heart_rate_bpm");
    expect(html).toContain("fenix 7 Pro");
  });

  it("renders the empty-state dashboard when no device is selected", () => {
    const html = renderDeviceDashboard("Empty", [], null);
    expect(html).toContain("Empty");
    expect(html).not.toContain("selected device");
  });
});
