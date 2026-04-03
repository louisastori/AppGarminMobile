import type { GarminConnectIqMetricKey } from "./types";
import { WatchStorageService } from "./storageService";

const DEFAULT_LIVE_METRICS: GarminConnectIqMetricKey[] = [
  "heart_rate_bpm",
  "stress_score",
  "respiration_rate_bpm",
  "steps",
  "time_to_recovery_h",
];

export interface WatchDiagnosticView {
  readonly deviceId: string;
  readonly health: string;
  readonly lastBatchId: string | null;
  readonly pendingBatchCount: number;
  readonly lastSuccessfulSyncAt: string | null;
  readonly lastDiagnosticMessage: string | null;
}

export class WatchLinkService {
  constructor(private readonly storage: WatchStorageService) {}

  getDiagnosticView(deviceId: string): WatchDiagnosticView | null {
    const status = this.storage.getStatusSummary(deviceId);
    if (!status) {
      return null;
    }

    return {
      deviceId,
      health: status.health,
      lastBatchId: status.lastBatchId,
      pendingBatchCount: status.pendingBatchCount,
      lastSuccessfulSyncAt: status.lastSuccessfulSyncAt,
      lastDiagnosticMessage: status.lastDiagnostic?.message ?? null,
    };
  }

  getLiveMetrics(
    deviceId: string,
    metricKeys: readonly GarminConnectIqMetricKey[] = DEFAULT_LIVE_METRICS,
  ) {
    const latest = this.storage.getStatusSummary(deviceId)?.latestMetrics ?? [];
    return latest.filter((metric) => metricKeys.includes(metric.metricKey));
  }
}
