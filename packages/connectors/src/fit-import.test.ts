import { describe, expect, it } from "vitest";
import {
  importFitCsv,
  importFitFile,
  importFitJson,
} from "./fit-import";
import { createValidationReport, renderValidationReport } from "./validation";

describe("FIT import and validation", () => {
  it("imports CSV exports into normalized records", () => {
    const dataset = importFitCsv(
      "session.csv",
      "recorded_at,heart_rate_bpm,steps\n2026-04-03T10:00:00.000Z,141,8244\n2026-04-03T10:01:00.000Z,143,8250",
    );

    expect(dataset.records).toHaveLength(2);
    expect(dataset.summary.heart_rate_bpm?.last).toBe(143);
    expect(dataset.summary.steps?.average).toBe(8247);
  });

  it("imports JSON exports and delegates binary FIT parsing", async () => {
    const jsonDataset = importFitJson(
      "session.json",
      JSON.stringify([
        {
          recordedAt: "2026-04-03T10:00:00.000Z",
          heart_rate_bpm: 140,
        },
      ]),
    );
    expect(jsonDataset.summary.heart_rate_bpm?.count).toBe(1);

    const binaryDataset = await importFitFile("session.fit", Buffer.from("fake"), {
      binaryFitParser: async () => ({
        sourceName: "fit-binary",
        records: [
          {
            recordedAt: "2026-04-03T10:00:00.000Z",
            metrics: {
              heart_rate_bpm: 142,
            },
          },
        ],
        summary: {
          heart_rate_bpm: {
            count: 1,
            min: 142,
            max: 142,
            average: 142,
            last: 142,
          },
        },
      }),
    });

    expect(binaryDataset.summary.heart_rate_bpm?.last).toBe(142);
  });

  it("builds a readable validation report", () => {
    const report = createValidationReport(
      {
        deviceId: "fenix-demo",
        importedFit: importFitJson(
          "session.json",
          JSON.stringify([
            {
              recordedAt: "2026-04-03T10:00:00.000Z",
              heart_rate_bpm: 140,
            },
          ]),
        ),
        watchMetrics: [
          {
            messageType: "metric_sample",
            sampleId: "sample-001",
            recordedAt: "2026-04-03T10:00:00.000Z",
            metricKey: "heart_rate_bpm",
            metricValue: 141,
            metricUnit: "bpm",
            sourceDomain: "activity",
            quality: "live",
            deviceId: "fenix-demo",
            batchId: "batch-001",
            snapshotId: null,
            ingestedAt: "2026-04-03T10:00:01.000Z",
          },
        ],
        tolerances: {
          heart_rate_bpm: 2,
        },
      },
      "2026-04-03T10:02:00.000Z",
    );

    expect(report.metricDeltas[0]?.withinTolerance).toBe(true);
    expect(renderValidationReport(report)).toContain("Validation report for fenix-demo");
  });

  it("covers incomplete and mismatching validation branches", async () => {
    await expect(importFitFile("session.txt", "bad")).rejects.toThrow(
      "Unsupported validation import format",
    );

    const report = createValidationReport(
      {
        deviceId: "fenix-demo",
        importedFit: importFitJson("single.json", JSON.stringify({ heart_rate_bpm: 150 })),
        watchMetrics: [],
        batches: [
          {
            deviceId: "fenix-demo",
            batchId: "batch-002",
            sequence: 2,
            createdAt: "2026-04-03T10:00:00.000Z",
            ingestedAt: "2026-04-03T10:00:04.000Z",
            itemCount: 1,
            lastSampleId: "sample-010",
            rawBatch: {
              messageType: "batch_envelope",
              batchId: "batch-002",
              sequence: 2,
              createdAt: "2026-04-03T10:00:00.000Z",
              lastSampleId: "sample-010",
              items: [],
            },
          },
        ],
        mobileReceivedAt: "2026-04-03T10:00:01.000Z",
        backendAcceptedAt: "2026-04-03T10:00:03.000Z",
      },
      "2026-04-03T10:02:00.000Z",
    );

    expect(report.latencies.watchToMobileMs).toBe(1000);
    expect(report.latencies.mobileToBackendMs).toBe(2000);
    expect(report.findings[0]).toContain("incomplete");
  });
});
