export const GARMIN_CONNECT_IQ_PROTOCOL_VERSION = 1 as const;

export const GARMIN_CONNECT_IQ_DEVICE_KINDS = ["fenix", "edge"] as const;
export type GarminConnectIqDeviceKind =
  (typeof GARMIN_CONNECT_IQ_DEVICE_KINDS)[number];

export const GARMIN_CONNECT_IQ_SOURCE_DOMAINS = [
  "activity_monitor",
  "sensor",
  "activity",
  "user_profile",
  "sensor_history",
] as const;
export type GarminConnectIqSourceDomain =
  (typeof GARMIN_CONNECT_IQ_SOURCE_DOMAINS)[number];

export const GARMIN_CONNECT_IQ_SAMPLE_QUALITIES = [
  "live",
  "snapshot",
  "history",
  "derived",
] as const;
export type GarminConnectIqSampleQuality =
  (typeof GARMIN_CONNECT_IQ_SAMPLE_QUALITIES)[number];

export const GARMIN_CONNECT_IQ_LINK_HEALTHS = [
  "disconnected",
  "connecting",
  "connected",
  "degraded",
  "error",
] as const;
export type GarminConnectIqLinkHealth =
  (typeof GARMIN_CONNECT_IQ_LINK_HEALTHS)[number];

export const GARMIN_CONNECT_IQ_SNAPSHOT_TYPES = [
  "daily",
  "activity",
  "profile",
] as const;
export type GarminConnectIqSnapshotType =
  (typeof GARMIN_CONNECT_IQ_SNAPSHOT_TYPES)[number];

export const GARMIN_CONNECT_IQ_SYNC_DIAGNOSTIC_CODES = [
  "sensor_unavailable",
  "permission_missing",
  "storage_full",
  "phone_unreachable",
  "batch_rejected",
  "device_missing",
  "device_not_connected",
  "app_not_installed",
  "service_unavailable",
  "invalid_state",
  "empty_message",
  "unknown_message",
] as const;
export type GarminConnectIqSyncDiagnosticCode =
  (typeof GARMIN_CONNECT_IQ_SYNC_DIAGNOSTIC_CODES)[number];

export type GarminConnectIqWatchErrorCode =
  GarminConnectIqSyncDiagnosticCode | "unsupported_metric" | "invalid_payload";

export const GARMIN_CONNECT_IQ_P0_LIVE_METRICS = [
  "heart_rate_bpm",
  "stress_score",
  "respiration_rate_bpm",
  "spo2_percent",
  "activity_timer_state",
  "activity_elapsed_time_s",
  "activity_elapsed_distance_m",
  "activity_current_speed_mps",
  "activity_current_cadence_rpm",
] as const;

export const GARMIN_CONNECT_IQ_P0_SNAPSHOT_METRICS = [
  "steps",
  "step_goal",
  "calories_kcal",
  "distance_m",
  "floors_climbed",
  "floors_descended",
  "move_bar_level",
  "time_to_recovery_h",
  "resting_heart_rate_bpm",
  "average_resting_heart_rate_bpm",
  "vo2max_running",
  "vo2max_cycling",
] as const;

export const GARMIN_CONNECT_IQ_P1_CONDITIONAL_METRICS = [
  "heart_beat_interval_ms",
  "temperature_c",
  "pressure_pa",
  "heading_deg",
  "power_w",
  "body_battery_percent",
] as const;

export const GARMIN_CONNECT_IQ_METRIC_KEYS = [
  ...GARMIN_CONNECT_IQ_P0_LIVE_METRICS,
  ...GARMIN_CONNECT_IQ_P0_SNAPSHOT_METRICS,
  ...GARMIN_CONNECT_IQ_P1_CONDITIONAL_METRICS,
] as const;
export type GarminConnectIqMetricKey =
  (typeof GARMIN_CONNECT_IQ_METRIC_KEYS)[number];

export type GarminConnectIqMetricTier =
  | "p0_live"
  | "p0_snapshot"
  | "p1_conditional";

export type GarminConnectIqMetricValue = number | string | boolean | null;

export interface GarminConnectIqMetricDefinition {
  readonly tier: GarminConnectIqMetricTier;
  readonly unit: string | null;
  readonly sourceDomain: GarminConnectIqSourceDomain;
  readonly sourcePath: string;
  readonly livePreferred: boolean;
}

export const GARMIN_CONNECT_IQ_METRIC_DEFINITIONS = {
  heart_rate_bpm: {
    tier: "p0_live",
    unit: "bpm",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.currentHeartRate",
    livePreferred: true,
  },
  stress_score: {
    tier: "p0_live",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.stressScore",
    livePreferred: true,
  },
  respiration_rate_bpm: {
    tier: "p0_live",
    unit: "rpm",
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.respirationRate",
    livePreferred: true,
  },
  spo2_percent: {
    tier: "p0_live",
    unit: "%",
    sourceDomain: "sensor",
    sourcePath: "Toybox.Sensor.Info.oxygenSaturation",
    livePreferred: true,
  },
  activity_timer_state: {
    tier: "p0_live",
    unit: null,
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.timerState",
    livePreferred: true,
  },
  activity_elapsed_time_s: {
    tier: "p0_live",
    unit: "s",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.elapsedTime",
    livePreferred: true,
  },
  activity_elapsed_distance_m: {
    tier: "p0_live",
    unit: "m",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.elapsedDistance",
    livePreferred: true,
  },
  activity_current_speed_mps: {
    tier: "p0_live",
    unit: "m/s",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.currentSpeed",
    livePreferred: true,
  },
  activity_current_cadence_rpm: {
    tier: "p0_live",
    unit: "rpm",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.currentCadence",
    livePreferred: true,
  },
  steps: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.steps",
    livePreferred: false,
  },
  step_goal: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.stepGoal",
    livePreferred: false,
  },
  calories_kcal: {
    tier: "p0_snapshot",
    unit: "kcal",
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.calories",
    livePreferred: false,
  },
  distance_m: {
    tier: "p0_snapshot",
    unit: "m",
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.distance",
    livePreferred: false,
  },
  floors_climbed: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.floorsClimbed",
    livePreferred: false,
  },
  floors_descended: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.floorsDescended",
    livePreferred: false,
  },
  move_bar_level: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.moveBarLevel",
    livePreferred: false,
  },
  time_to_recovery_h: {
    tier: "p0_snapshot",
    unit: "h",
    sourceDomain: "activity_monitor",
    sourcePath: "Toybox.ActivityMonitor.Info.timeToRecovery",
    livePreferred: false,
  },
  resting_heart_rate_bpm: {
    tier: "p0_snapshot",
    unit: "bpm",
    sourceDomain: "user_profile",
    sourcePath: "Toybox.UserProfile.Profile.restingHeartRate",
    livePreferred: false,
  },
  average_resting_heart_rate_bpm: {
    tier: "p0_snapshot",
    unit: "bpm",
    sourceDomain: "user_profile",
    sourcePath: "Toybox.UserProfile.Profile.averageRestingHeartRate",
    livePreferred: false,
  },
  vo2max_running: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "user_profile",
    sourcePath: "Toybox.UserProfile.Profile.vo2maxRunning",
    livePreferred: false,
  },
  vo2max_cycling: {
    tier: "p0_snapshot",
    unit: null,
    sourceDomain: "user_profile",
    sourcePath: "Toybox.UserProfile.Profile.vo2maxCycling",
    livePreferred: false,
  },
  heart_beat_interval_ms: {
    tier: "p1_conditional",
    unit: "ms",
    sourceDomain: "sensor",
    sourcePath: "Toybox.Sensor.HeartRateData.heartBeatIntervals",
    livePreferred: true,
  },
  temperature_c: {
    tier: "p1_conditional",
    unit: "C",
    sourceDomain: "sensor",
    sourcePath: "Toybox.Sensor.Info.temperature",
    livePreferred: true,
  },
  pressure_pa: {
    tier: "p1_conditional",
    unit: "Pa",
    sourceDomain: "sensor",
    sourcePath: "Toybox.Sensor.Info.pressure",
    livePreferred: true,
  },
  heading_deg: {
    tier: "p1_conditional",
    unit: "deg",
    sourceDomain: "sensor",
    sourcePath: "Toybox.Sensor.Info.heading",
    livePreferred: true,
  },
  power_w: {
    tier: "p1_conditional",
    unit: "W",
    sourceDomain: "activity",
    sourcePath: "Toybox.Activity.Info.currentPower",
    livePreferred: true,
  },
  body_battery_percent: {
    tier: "p1_conditional",
    unit: "%",
    sourceDomain: "sensor_history",
    sourcePath: "Toybox.SensorHistory.getBodyBatteryHistory",
    livePreferred: false,
  },
} as const satisfies Record<
  GarminConnectIqMetricKey,
  GarminConnectIqMetricDefinition
>;

export interface GarminConnectIqDeviceHello {
  readonly messageType: "device_hello";
  readonly deviceId: string;
  readonly deviceKind: GarminConnectIqDeviceKind;
  readonly deviceModel: string;
  readonly firmwareVersion: string;
  readonly appVersion: string;
  readonly timezoneOffsetMinutes: number;
}

export interface GarminConnectIqDeviceCapabilities {
  readonly messageType: "device_capabilities";
  readonly supportedMetrics: readonly GarminConnectIqMetricKey[];
  readonly supportsBufferedSync: boolean;
  readonly supportsLiveMode: boolean;
  readonly maxBatchItems: number;
  readonly maxBufferedSamples: number;
}

export interface GarminConnectIqLinkStatus {
  readonly messageType: "link_status";
  readonly recordedAt: string;
  readonly health: GarminConnectIqLinkHealth;
  readonly pendingBatchCount: number;
  readonly lastBatchId: string | null;
  readonly lastErrorCode: GarminConnectIqSyncDiagnosticCode | null;
}

export interface GarminConnectIqMetricSample {
  readonly messageType: "metric_sample";
  readonly sampleId: string;
  readonly recordedAt: string;
  readonly metricKey: GarminConnectIqMetricKey;
  readonly metricValue: GarminConnectIqMetricValue;
  readonly metricUnit: string | null;
  readonly sourceDomain: GarminConnectIqSourceDomain;
  readonly quality: GarminConnectIqSampleQuality;
}

export interface GarminConnectIqSnapshot {
  readonly messageType: "snapshot";
  readonly snapshotId: string;
  readonly snapshotType: GarminConnectIqSnapshotType;
  readonly recordedAt: string;
  readonly items: readonly GarminConnectIqMetricSample[];
}

export type GarminConnectIqBatchItem =
  | GarminConnectIqMetricSample
  | GarminConnectIqSnapshot;

export interface GarminConnectIqBatchEnvelope {
  readonly messageType: "batch_envelope";
  readonly batchId: string;
  readonly sequence: number;
  readonly createdAt: string;
  readonly lastSampleId: string | null;
  readonly items: readonly GarminConnectIqBatchItem[];
}

export interface GarminConnectIqBatchAck {
  readonly messageType: "batch_ack";
  readonly batchId: string;
  readonly acknowledgedAt: string;
  readonly lastSampleId: string | null;
}

export interface GarminConnectIqWatchError {
  readonly messageType: "watch_error";
  readonly code: GarminConnectIqWatchErrorCode;
  readonly message: string;
  readonly recordedAt: string;
  readonly batchId: string | null;
}

export interface GarminConnectIqSyncDiagnostic {
  readonly messageType: "sync_diagnostic";
  readonly code: GarminConnectIqSyncDiagnosticCode;
  readonly message: string;
  readonly recordedAt: string;
  readonly batchId: string | null;
}

export type GarminConnectIqMessage =
  | GarminConnectIqDeviceHello
  | GarminConnectIqDeviceCapabilities
  | GarminConnectIqLinkStatus
  | GarminConnectIqMetricSample
  | GarminConnectIqSnapshot
  | GarminConnectIqBatchEnvelope
  | GarminConnectIqBatchAck
  | GarminConnectIqWatchError
  | GarminConnectIqSyncDiagnostic;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isGarminConnectIqMetricKey(
  value: unknown,
): value is GarminConnectIqMetricKey {
  return (
    typeof value === "string" &&
    GARMIN_CONNECT_IQ_METRIC_KEYS.includes(value as GarminConnectIqMetricKey)
  );
}

export function isGarminConnectIqSourceDomain(
  value: unknown,
): value is GarminConnectIqSourceDomain {
  return (
    typeof value === "string" &&
    GARMIN_CONNECT_IQ_SOURCE_DOMAINS.includes(
      value as GarminConnectIqSourceDomain,
    )
  );
}

export function isGarminConnectIqSampleQuality(
  value: unknown,
): value is GarminConnectIqSampleQuality {
  return (
    typeof value === "string" &&
    GARMIN_CONNECT_IQ_SAMPLE_QUALITIES.includes(
      value as GarminConnectIqSampleQuality,
    )
  );
}

export function isGarminConnectIqMetricSample(
  value: unknown,
): value is GarminConnectIqMetricSample {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.messageType === "metric_sample" &&
    typeof value.sampleId === "string" &&
    typeof value.recordedAt === "string" &&
    isGarminConnectIqMetricKey(value.metricKey) &&
    (value.metricValue === null ||
      typeof value.metricValue === "number" ||
      typeof value.metricValue === "string" ||
      typeof value.metricValue === "boolean") &&
    (value.metricUnit === null || typeof value.metricUnit === "string") &&
    isGarminConnectIqSourceDomain(value.sourceDomain) &&
    isGarminConnectIqSampleQuality(value.quality)
  );
}

export function isGarminConnectIqSnapshot(
  value: unknown,
): value is GarminConnectIqSnapshot {
  if (!isRecord(value) || value.messageType !== "snapshot") {
    return false;
  }

  return (
    typeof value.snapshotId === "string" &&
    typeof value.recordedAt === "string" &&
    typeof value.snapshotType === "string" &&
    GARMIN_CONNECT_IQ_SNAPSHOT_TYPES.includes(
      value.snapshotType as GarminConnectIqSnapshotType,
    ) &&
    Array.isArray(value.items) &&
    value.items.every((item) => isGarminConnectIqMetricSample(item))
  );
}

export function isGarminConnectIqBatchEnvelope(
  value: unknown,
): value is GarminConnectIqBatchEnvelope {
  if (!isRecord(value) || value.messageType !== "batch_envelope") {
    return false;
  }

  return (
    typeof value.batchId === "string" &&
    typeof value.sequence === "number" &&
    typeof value.createdAt === "string" &&
    (value.lastSampleId === null || typeof value.lastSampleId === "string") &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isGarminConnectIqMetricSample(item) || isGarminConnectIqSnapshot(item),
    )
  );
}

export function isGarminConnectIqBatchAck(
  value: unknown,
): value is GarminConnectIqBatchAck {
  if (!isRecord(value) || value.messageType !== "batch_ack") {
    return false;
  }

  return (
    typeof value.batchId === "string" &&
    typeof value.acknowledgedAt === "string" &&
    (value.lastSampleId === null || typeof value.lastSampleId === "string")
  );
}

export function isGarminConnectIqDeviceCapabilities(
  value: unknown,
): value is GarminConnectIqDeviceCapabilities {
  if (!isRecord(value) || value.messageType !== "device_capabilities") {
    return false;
  }

  return (
    isStringArray(value.supportedMetrics) &&
    value.supportedMetrics.every((metric) => isGarminConnectIqMetricKey(metric)) &&
    typeof value.supportsBufferedSync === "boolean" &&
    typeof value.supportsLiveMode === "boolean" &&
    typeof value.maxBatchItems === "number" &&
    typeof value.maxBufferedSamples === "number"
  );
}

export function isGarminConnectIqSyncDiagnostic(
  value: unknown,
): value is GarminConnectIqSyncDiagnostic {
  if (!isRecord(value) || value.messageType !== "sync_diagnostic") {
    return false;
  }

  return (
    typeof value.code === "string" &&
    GARMIN_CONNECT_IQ_SYNC_DIAGNOSTIC_CODES.includes(
      value.code as GarminConnectIqSyncDiagnosticCode,
    ) &&
    typeof value.message === "string" &&
    typeof value.recordedAt === "string" &&
    (value.batchId === null || typeof value.batchId === "string")
  );
}

export function createGarminConnectIqBatchAck(
  batchId: string,
  lastSampleId: string | null,
  acknowledgedAt: string = new Date().toISOString(),
): GarminConnectIqBatchAck {
  return {
    messageType: "batch_ack",
    batchId,
    acknowledgedAt,
    lastSampleId,
  };
}
