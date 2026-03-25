import type {
  GarminConnectIqBridge,
  GarminConnectIqBridgeListener,
  GarminConnectIqBridgeStatus,
} from "./bridge";
import { createGarminConnectIqBridgeStatus } from "./bridge";
import { GARMIN_CONNECT_IQ_METRIC_KEYS } from "./contract";
import type {
  GarminConnectIqBatchAck,
  GarminConnectIqBatchEnvelope,
  GarminConnectIqDeviceCapabilities,
  GarminConnectIqDeviceHello,
  GarminConnectIqLinkHealth,
  GarminConnectIqLinkStatus,
  GarminConnectIqMetricKey,
  GarminConnectIqMetricSample,
  GarminConnectIqSampleQuality,
  GarminConnectIqSourceDomain,
  GarminConnectIqSnapshot,
  GarminConnectIqSyncDiagnostic,
} from "./types";

const MOCK_DEVICE_ID = "fenix7pro-ciq-dev";
const MOCK_APP_VERSION = "0.1.0-alpha";
const MOCK_FIRMWARE_VERSION = "18.22";

export class MockGarminConnectIqBridge implements GarminConnectIqBridge {
  private status: GarminConnectIqBridgeStatus = createGarminConnectIqBridgeStatus();
  private listener?: GarminConnectIqBridgeListener;
  private batchSequence = 0;
  private sampleSequence = 0;

  async getStatus(): Promise<GarminConnectIqBridgeStatus> {
    return this.status;
  }

  async connect(listener?: GarminConnectIqBridgeListener): Promise<void> {
    this.listener = listener;
    this.updateStatus("connecting");
    this.status = {
      ...this.status,
      deviceHello: this.buildDeviceHello(),
      capabilities: this.buildCapabilities(),
    };
    this.notifyStatus();
    this.updateStatus("connected");
    this.emitBatch("initial-connect");
  }

  async disconnect(): Promise<void> {
    this.status = {
      ...createGarminConnectIqBridgeStatus(),
      deviceHello: this.status.deviceHello,
      capabilities: this.status.capabilities,
    };
    this.notifyStatus();
  }

  async acknowledgeBatch(ack: GarminConnectIqBatchAck): Promise<void> {
    this.status = {
      ...this.status,
      lastBatchId: ack.batchId,
      pendingBatchCount: Math.max(0, this.status.pendingBatchCount - 1),
      linkStatus: this.buildLinkStatus(
        this.status.health,
        Math.max(0, this.status.pendingBatchCount - 1),
        ack.batchId,
        null,
      ),
    };
    this.notifyStatus();
  }

  async requestSyncNow(): Promise<void> {
    if (this.status.health !== "connected") {
      const diagnostic = this.buildDiagnostic(
        "phone_unreachable",
        "Le companion Connect IQ n est pas encore connecte.",
        null,
      );
      this.status = {
        ...this.status,
        health: "error",
        lastDiagnostic: diagnostic,
        linkStatus: this.buildLinkStatus("error", this.status.pendingBatchCount, null, diagnostic.code),
      };
      this.notifyStatus();
      this.listener?.onDiagnostic?.(diagnostic);
      return;
    }

    this.emitBatch("manual-sync");
  }

  private notifyStatus(): void {
    this.listener?.onStatusChanged?.(this.status);
  }

  private updateStatus(health: GarminConnectIqLinkHealth): void {
    this.status = {
      ...this.status,
      health,
      linkStatus: this.buildLinkStatus(
        health,
        this.status.pendingBatchCount,
        this.status.lastBatchId,
        this.status.lastDiagnostic?.code ?? null,
      ),
    };
    this.notifyStatus();
  }

  private emitBatch(reason: "initial-connect" | "manual-sync"): void {
    const batch = this.buildBatchEnvelope(reason);
    const pendingBatchCount = this.status.pendingBatchCount + 1;

    this.status = {
      ...this.status,
      health: "connected",
      lastBatchId: batch.batchId,
      pendingBatchCount,
      lastDiagnostic: null,
      linkStatus: this.buildLinkStatus("connected", pendingBatchCount, batch.batchId, null),
    };
    this.notifyStatus();
    this.listener?.onBatchReceived?.(batch);
  }

  private buildDeviceHello(): GarminConnectIqDeviceHello {
    return {
      messageType: "device_hello",
      deviceId: MOCK_DEVICE_ID,
      deviceKind: "fenix",
      deviceModel: "fenix 7 Pro",
      firmwareVersion: MOCK_FIRMWARE_VERSION,
      appVersion: MOCK_APP_VERSION,
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
    };
  }

  private buildCapabilities(): GarminConnectIqDeviceCapabilities {
    return {
      messageType: "device_capabilities",
      supportedMetrics: GARMIN_CONNECT_IQ_METRIC_KEYS,
      supportsBufferedSync: true,
      supportsLiveMode: true,
      maxBatchItems: 24,
      maxBufferedSamples: 240,
    };
  }

  private buildLinkStatus(
    health: GarminConnectIqLinkHealth,
    pendingBatchCount: number,
    lastBatchId: string | null,
    lastErrorCode: GarminConnectIqSyncDiagnostic["code"] | null,
  ): GarminConnectIqLinkStatus {
    return {
      messageType: "link_status",
      recordedAt: new Date().toISOString(),
      health,
      pendingBatchCount,
      lastBatchId,
      lastErrorCode,
    };
  }

  private buildBatchEnvelope(
    reason: "initial-connect" | "manual-sync",
  ): GarminConnectIqBatchEnvelope {
    this.batchSequence += 1;
    const createdAt = new Date().toISOString();
    const liveItems = this.buildLiveMetrics(createdAt, reason);
    const snapshot = this.buildDailySnapshot(createdAt);
    const lastSampleId = snapshot.items[snapshot.items.length - 1]?.sampleId ?? null;

    return {
      messageType: "batch_envelope",
      batchId: `ciq-fenix-${this.batchSequence.toString().padStart(4, "0")}`,
      sequence: this.batchSequence,
      createdAt,
      lastSampleId,
      items: [...liveItems, snapshot],
    };
  }

  private buildLiveMetrics(
    recordedAt: string,
    reason: "initial-connect" | "manual-sync",
  ): GarminConnectIqMetricSample[] {
    const batchOffset = reason === "initial-connect" ? 0 : this.batchSequence * 2;

    return [
      this.buildMetricSample(
        "heart_rate_bpm",
        138 + (batchOffset % 6),
        "bpm",
        "activity",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "stress_score",
        22 + (batchOffset % 5),
        null,
        "activity_monitor",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "respiration_rate_bpm",
        15 + (batchOffset % 3),
        "rpm",
        "activity_monitor",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "spo2_percent",
        97,
        "%",
        "sensor",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "activity_elapsed_time_s",
        1240 + this.batchSequence * 85,
        "s",
        "activity",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "activity_elapsed_distance_m",
        3120 + this.batchSequence * 220,
        "m",
        "activity",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "activity_current_speed_mps",
        3.1 + this.batchSequence * 0.04,
        "m/s",
        "activity",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "activity_current_cadence_rpm",
        168 + (this.batchSequence % 4),
        "rpm",
        "activity",
        "live",
        recordedAt,
      ),
      this.buildMetricSample(
        "activity_timer_state",
        reason === "initial-connect" ? "running" : "syncing",
        null,
        "activity",
        "derived",
        recordedAt,
      ),
    ];
  }

  private buildDailySnapshot(recordedAt: string): GarminConnectIqSnapshot {
    const dailyItems = [
      this.buildMetricSample("steps", 7842 + this.batchSequence * 14, null, "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("step_goal", 10000, null, "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("calories_kcal", 612, "kcal", "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("distance_m", 6240, "m", "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("floors_climbed", 8, null, "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("floors_descended", 7, null, "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("move_bar_level", 1, null, "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("time_to_recovery_h", 18, "h", "activity_monitor", "snapshot", recordedAt),
      this.buildMetricSample("resting_heart_rate_bpm", 52, "bpm", "user_profile", "snapshot", recordedAt),
      this.buildMetricSample("average_resting_heart_rate_bpm", 55, "bpm", "user_profile", "snapshot", recordedAt),
      this.buildMetricSample("vo2max_running", 51, null, "user_profile", "snapshot", recordedAt),
      this.buildMetricSample("vo2max_cycling", 49, null, "user_profile", "snapshot", recordedAt),
      this.buildMetricSample("body_battery_percent", 78, "%", "sensor_history", "history", recordedAt),
    ];

    return {
      messageType: "snapshot",
      snapshotId: `fenix-daily-${this.batchSequence.toString().padStart(4, "0")}`,
      snapshotType: "daily",
      recordedAt,
      items: dailyItems,
    };
  }

  private buildMetricSample(
    metricKey: GarminConnectIqMetricKey,
    metricValue: number | string | boolean | null,
    metricUnit: string | null,
    sourceDomain: GarminConnectIqSourceDomain,
    quality: GarminConnectIqSampleQuality,
    recordedAt: string,
  ): GarminConnectIqMetricSample {
    this.sampleSequence += 1;

    return {
      messageType: "metric_sample",
      sampleId: `fenix-sample-${this.sampleSequence.toString().padStart(5, "0")}`,
      recordedAt,
      metricKey,
      metricValue,
      metricUnit,
      sourceDomain,
      quality,
    };
  }

  private buildDiagnostic(
    code: GarminConnectIqSyncDiagnostic["code"],
    message: string,
    batchId: string | null,
  ): GarminConnectIqSyncDiagnostic {
    return {
      messageType: "sync_diagnostic",
      code,
      message,
      recordedAt: new Date().toISOString(),
      batchId,
    };
  }
}
