import type { GarminConnectIqMetricKey } from "@nouvelle-app/shared";
import FitParser from "fit-file-parser";

export interface ImportedFitRecord {
  readonly recordedAt: string;
  readonly metrics: Partial<Record<GarminConnectIqMetricKey, number>>;
}

export interface ImportedFitMetricSummary {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly average: number;
  readonly last: number;
}

export interface ImportedFitDataset {
  readonly sourceName: string;
  readonly records: ImportedFitRecord[];
  readonly summary: Partial<
    Record<GarminConnectIqMetricKey, ImportedFitMetricSummary>
  >;
}

export type BinaryFitParser = (binary: Buffer) => Promise<ImportedFitDataset>;

const FIELD_TO_METRIC_KEY: Record<string, GarminConnectIqMetricKey> = {
  heart_rate: "heart_rate_bpm",
  heart_rate_bpm: "heart_rate_bpm",
  stress_score: "stress_score",
  respiration_rate: "respiration_rate_bpm",
  respiration_rate_bpm: "respiration_rate_bpm",
  spo2: "spo2_percent",
  spo2_percent: "spo2_percent",
  distance: "activity_elapsed_distance_m",
  activity_elapsed_distance_m: "activity_elapsed_distance_m",
  elapsed_time: "activity_elapsed_time_s",
  activity_elapsed_time_s: "activity_elapsed_time_s",
  speed: "activity_current_speed_mps",
  enhanced_speed: "activity_current_speed_mps",
  activity_current_speed_mps: "activity_current_speed_mps",
  cadence: "activity_current_cadence_rpm",
  activity_current_cadence_rpm: "activity_current_cadence_rpm",
  steps: "steps",
  time_to_recovery: "time_to_recovery_h",
  time_to_recovery_h: "time_to_recovery_h",
  body_battery: "body_battery_percent",
  body_battery_percent: "body_battery_percent",
  power: "power_w",
  power_w: "power_w",
  temperature: "temperature_c",
  temperature_c: "temperature_c",
};

function normalizeFieldName(fieldName: string): GarminConnectIqMetricKey | null {
  return FIELD_TO_METRIC_KEY[fieldName.trim().toLowerCase()] ?? null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeRecordedAt(record: Record<string, unknown>, rowIndex: number): string {
  const raw =
    record.recordedAt ??
    record.recorded_at ??
    record.timestamp ??
    record.time ??
    null;

  if (typeof raw === "string" && raw.length > 0) {
    return new Date(raw).toISOString();
  }

  return new Date(Date.UTC(2026, 0, 1, 0, 0, rowIndex)).toISOString();
}

function buildSummary(
  records: readonly ImportedFitRecord[],
): ImportedFitDataset["summary"] {
  const valuesByMetric = new Map<GarminConnectIqMetricKey, number[]>();

  for (const record of records) {
    for (const [metricKey, metricValue] of Object.entries(record.metrics)) {
      if (typeof metricValue !== "number") {
        continue;
      }

      const values = valuesByMetric.get(metricKey as GarminConnectIqMetricKey) ?? [];
      values.push(metricValue);
      valuesByMetric.set(metricKey as GarminConnectIqMetricKey, values);
    }
  }

  const summary: ImportedFitDataset["summary"] = {};
  for (const [metricKey, values] of valuesByMetric.entries()) {
    const total = values.reduce((running, value) => running + value, 0);
    summary[metricKey] = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      average: total / values.length,
      last: values[values.length - 1]!,
    };
  }

  return summary;
}

function normalizeRecords(
  sourceName: string,
  records: readonly Record<string, unknown>[],
): ImportedFitDataset {
  const normalized = records.map<ImportedFitRecord>((record, rowIndex) => {
    const metrics: Partial<Record<GarminConnectIqMetricKey, number>> = {};

    for (const [fieldName, rawValue] of Object.entries(record)) {
      const metricKey = normalizeFieldName(fieldName);
      if (!metricKey) {
        continue;
      }

      const metricValue = toNumber(rawValue);
      if (metricValue === null) {
        continue;
      }

      metrics[metricKey] = metricValue;
    }

    return {
      recordedAt: normalizeRecordedAt(record, rowIndex),
      metrics,
    };
  });

  return {
    sourceName,
    records: normalized,
    summary: buildSummary(normalized),
  };
}

export function importFitCsv(
  sourceName: string,
  csvContent: string,
): ImportedFitDataset {
  const lines = csvContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      sourceName,
      records: [],
      summary: {},
    };
  }

  const headers = lines[0]!.split(",").map((header) => header.trim());
  const records = lines.slice(1).map<Record<string, unknown>>((line) => {
    const cells = line.split(",");
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? "";
    });
    return record;
  });

  return normalizeRecords(sourceName, records);
}

export function importFitJson(
  sourceName: string,
  jsonContent: string,
): ImportedFitDataset {
  const parsed = JSON.parse(jsonContent) as unknown;

  if (Array.isArray(parsed)) {
    return normalizeRecords(sourceName, parsed as Record<string, unknown>[]);
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    if (Array.isArray(record.records)) {
      return normalizeRecords(
        sourceName,
        record.records as Record<string, unknown>[],
      );
    }

    return normalizeRecords(sourceName, [record]);
  }

  return {
    sourceName,
    records: [],
    summary: {},
  };
}

async function defaultBinaryFitParser(binary: Buffer): Promise<ImportedFitDataset> {
  const parser = new FitParser({
    force: true,
    mode: "both",
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
  });

  const records = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
    parser.parse(binary, (error, data) => {
      if (error) {
        reject(error);
        return;
      }

      const payload =
        data && typeof data === "object" && Array.isArray((data as { records?: unknown[] }).records)
          ? ((data as { records: Record<string, unknown>[] }).records ?? [])
          : [];
      resolve(payload);
    });
  });

  return normalizeRecords("fit-binary", records);
}

export async function importFitFile(
  fileName: string,
  content: string | Buffer,
  options: {
    readonly binaryFitParser?: BinaryFitParser;
  } = {},
): Promise<ImportedFitDataset> {
  if (fileName.endsWith(".csv")) {
    return importFitCsv(fileName, typeof content === "string" ? content : content.toString("utf8"));
  }

  if (fileName.endsWith(".json")) {
    return importFitJson(fileName, typeof content === "string" ? content : content.toString("utf8"));
  }

  if (fileName.endsWith(".fit")) {
    const parser = options.binaryFitParser ?? defaultBinaryFitParser;
    return parser(Buffer.isBuffer(content) ? content : Buffer.from(content));
  }

  throw new Error(`Unsupported validation import format for ${fileName}`);
}
