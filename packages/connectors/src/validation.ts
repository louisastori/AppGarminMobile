import type { GarminConnectIqMetricKey } from "@nouvelle-app/shared";
import type { WatchBatchRecord, WatchMetricRecord } from "@nouvelle-app/domain";
import type { ImportedFitDataset } from "./fit-import";

export interface ValidationMetricDelta {
  readonly metricKey: GarminConnectIqMetricKey;
  readonly watchCount: number;
  readonly fitCount: number;
  readonly watchLast: number | null;
  readonly fitLast: number | null;
  readonly delta: number | null;
  readonly withinTolerance: boolean | null;
}

export interface ValidationLatency {
  readonly watchToMobileMs: number | null;
  readonly mobileToBackendMs: number | null;
}

export interface ValidationReport {
  readonly generatedAt: string;
  readonly deviceId: string;
  readonly lastReceivedBatchId: string | null;
  readonly metricDeltas: ValidationMetricDelta[];
  readonly latencies: ValidationLatency;
  readonly findings: string[];
}

function buildMetricSeries(
  records: readonly WatchMetricRecord[],
): Map<GarminConnectIqMetricKey, number[]> {
  const metrics = new Map<GarminConnectIqMetricKey, number[]>();
  for (const record of records) {
    if (typeof record.metricValue !== "number") {
      continue;
    }

    const values = metrics.get(record.metricKey) ?? [];
    values.push(record.metricValue);
    metrics.set(record.metricKey, values);
  }
  return metrics;
}

function buildFitSeries(
  dataset: ImportedFitDataset,
): Map<GarminConnectIqMetricKey, number[]> {
  const metrics = new Map<GarminConnectIqMetricKey, number[]>();
  for (const record of dataset.records) {
    for (const [metricKey, value] of Object.entries(record.metrics)) {
      if (typeof value !== "number") {
        continue;
      }

      const values = metrics.get(metricKey as GarminConnectIqMetricKey) ?? [];
      values.push(value);
      metrics.set(metricKey as GarminConnectIqMetricKey, values);
    }
  }

  return metrics;
}

export function createValidationReport(
  input: {
    readonly deviceId: string;
    readonly watchMetrics: readonly WatchMetricRecord[];
    readonly importedFit: ImportedFitDataset;
    readonly batches?: readonly WatchBatchRecord[];
    readonly mobileReceivedAt?: string | null;
    readonly backendAcceptedAt?: string | null;
    readonly tolerances?: Partial<Record<GarminConnectIqMetricKey, number>>;
  },
  generatedAt: string = new Date().toISOString(),
): ValidationReport {
  const watchSeries = buildMetricSeries(input.watchMetrics);
  const fitSeries = buildFitSeries(input.importedFit);
  const metricKeys = new Set<GarminConnectIqMetricKey>([
    ...watchSeries.keys(),
    ...fitSeries.keys(),
  ]);

  const metricDeltas = [...metricKeys]
    .sort((left, right) => left.localeCompare(right))
    .map<ValidationMetricDelta>((metricKey) => {
      const watchValues = watchSeries.get(metricKey) ?? [];
      const fitValues = fitSeries.get(metricKey) ?? [];
      const watchLast = watchValues.length > 0 ? watchValues[watchValues.length - 1]! : null;
      const fitLast = fitValues.length > 0 ? fitValues[fitValues.length - 1]! : null;
      const delta =
        watchLast !== null && fitLast !== null ? Number((watchLast - fitLast).toFixed(3)) : null;
      const tolerance = input.tolerances?.[metricKey] ?? 0;

      return {
        metricKey,
        watchCount: watchValues.length,
        fitCount: fitValues.length,
        watchLast,
        fitLast,
        delta,
        withinTolerance: delta === null ? null : Math.abs(delta) <= tolerance,
      };
    });

  const findings = metricDeltas.flatMap((delta) => {
    if (delta.delta === null) {
      return [`${delta.metricKey}: series incomplete between watch and FIT import.`];
    }

    if (delta.withinTolerance) {
      return [];
    }

    return [
      `${delta.metricKey}: delta ${delta.delta} exceeds tolerance.`,
    ];
  });

  const newestBatch = input.batches?.[0] ?? null;
  const watchToMobileMs =
    newestBatch && input.mobileReceivedAt
      ? Date.parse(input.mobileReceivedAt) - Date.parse(newestBatch.createdAt)
      : null;
  const mobileToBackendMs =
    input.mobileReceivedAt && input.backendAcceptedAt
      ? Date.parse(input.backendAcceptedAt) - Date.parse(input.mobileReceivedAt)
      : null;

  return {
    generatedAt,
    deviceId: input.deviceId,
    lastReceivedBatchId: newestBatch?.batchId ?? null,
    metricDeltas,
    latencies: {
      watchToMobileMs,
      mobileToBackendMs,
    },
    findings:
      findings.length > 0
        ? findings
        : ["No blocking discrepancy detected on compared metrics."],
  };
}

export function renderValidationReport(report: ValidationReport): string {
  const header = [
    `Validation report for ${report.deviceId}`,
    `Generated at: ${report.generatedAt}`,
    `Last batch: ${report.lastReceivedBatchId ?? "none"}`,
    `Latency watch->mobile: ${
      report.latencies.watchToMobileMs === null
        ? "n/a"
        : `${report.latencies.watchToMobileMs} ms`
    }`,
    `Latency mobile->backend: ${
      report.latencies.mobileToBackendMs === null
        ? "n/a"
        : `${report.latencies.mobileToBackendMs} ms`
    }`,
    "",
    "Metric deltas:",
  ];

  const metrics = report.metricDeltas.map((delta) => {
    const verdict =
      delta.withinTolerance === null
        ? "incomplete"
        : delta.withinTolerance
          ? "ok"
          : "mismatch";
    return `- ${delta.metricKey}: watch=${delta.watchLast ?? "n/a"} fit=${delta.fitLast ?? "n/a"} delta=${delta.delta ?? "n/a"} status=${verdict}`;
  });

  return [...header, ...metrics, "", "Findings:", ...report.findings.map((item) => `- ${item}`)].join("\n");
}
