import { describe, expect, it } from "vitest";
import { GarminWatchHub } from "@nouvelle-app/domain";
import { NouvelleAppApi } from "./index";

describe("NouvelleAppApi", () => {
  it("ingests watch payloads and exposes status endpoints", () => {
    const api = new NouvelleAppApi(new GarminWatchHub());

    const helloResponse = api.handle({
      method: "POST",
      url: "/watch-links/device-1/hello",
      body: {
        messageType: "device_hello",
        deviceId: "device-1",
        deviceKind: "fenix",
        deviceModel: "fenix 7 Pro",
        firmwareVersion: "18.22",
        appVersion: "0.1.0",
        timezoneOffsetMinutes: 120,
      },
    });
    expect(helloResponse.status).toBe(202);

    const batchResponse = api.handle({
      method: "POST",
      url: "/watch-links/device-1/batches",
      body: {
        messageType: "batch_envelope",
        batchId: "batch-001",
        sequence: 1,
        createdAt: "2026-04-03T10:00:00.000Z",
        lastSampleId: "sample-001",
        items: [
          {
            messageType: "metric_sample",
            sampleId: "sample-001",
            recordedAt: "2026-04-03T10:00:00.000Z",
            metricKey: "heart_rate_bpm",
            metricValue: 141,
            metricUnit: "bpm",
            sourceDomain: "activity",
            quality: "live",
          },
        ],
      },
    });
    expect(batchResponse.status).toBe(201);

    const latest = api.handle({
      method: "GET",
      url: "/devices/device-1/metrics/latest",
    });
    expect(latest.status).toBe(200);
    expect((latest.body as { metrics: unknown[] }).metrics).toHaveLength(1);

    const status = api.handle({
      method: "GET",
      url: "/watch-links/device-1/status",
    });
    expect(status.status).toBe(200);
  });

  it("rejects unsupported payloads and query params", () => {
    const api = new NouvelleAppApi(new GarminWatchHub());

    expect(
      api.handle({
        method: "POST",
        url: "/watch-links/device-1/hello",
        body: { nope: true },
      }).status,
    ).toBe(400);

    expect(
      api.handle({
        method: "GET",
        url: "/devices/device-1/metrics/history?metricKey=unknown",
      }).status,
    ).toBe(400);

    expect(
      api.handle({
        method: "GET",
        url: "/devices/device-1/metrics/history?limit=0",
      }).status,
    ).toBe(400);

    expect(
      api.handle({
        method: "GET",
        url: "/watch-links/device-1/status",
      }).status,
    ).toBe(404);
  });
});
