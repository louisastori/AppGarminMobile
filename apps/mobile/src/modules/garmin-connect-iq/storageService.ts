import {
  GarminWatchHub,
  type GarminWatchHubState,
  type MetricHistoryQuery,
} from "@nouvelle-app/domain";
import type {
  GarminConnectIqBatchEnvelope,
  GarminConnectIqDeviceCapabilities,
  GarminConnectIqDeviceHello,
  GarminConnectIqLinkStatus,
  GarminConnectIqSyncDiagnostic,
} from "./types";

export class WatchStorageService {
  private hub: GarminWatchHub;

  constructor(initialState?: GarminWatchHubState) {
    this.hub = initialState ? GarminWatchHub.fromState(initialState) : new GarminWatchHub();
  }

  getHub(): GarminWatchHub {
    return this.hub;
  }

  recordDeviceHello(payload: GarminConnectIqDeviceHello) {
    return this.hub.recordDeviceHello(payload);
  }

  recordCapabilities(
    deviceId: string,
    payload: GarminConnectIqDeviceCapabilities,
  ) {
    return this.hub.recordCapabilities(deviceId, payload);
  }

  recordLinkStatus(deviceId: string, payload: GarminConnectIqLinkStatus) {
    return this.hub.recordLinkStatus(deviceId, payload);
  }

  recordDiagnostic(deviceId: string, payload: GarminConnectIqSyncDiagnostic) {
    return this.hub.recordDiagnostic(deviceId, payload);
  }

  ingestBatch(deviceId: string, payload: GarminConnectIqBatchEnvelope) {
    return this.hub.ingestBatch(deviceId, payload);
  }

  rejectPayload(deviceId: string, reason: string, rawPayload: unknown) {
    return this.hub.rejectPayload(deviceId, reason, rawPayload);
  }

  listDevices() {
    return this.hub.listDevices();
  }

  getStatusSummary(deviceId: string) {
    return this.hub.getStatusSummary(deviceId);
  }

  getStatusView(deviceId: string) {
    return this.hub.getStatusView(deviceId);
  }

  getMetricHistory(deviceId: string, query: MetricHistoryQuery = {}) {
    return this.hub.getMetricHistory(deviceId, query);
  }

  exportState(): GarminWatchHubState {
    return this.hub.toState();
  }

  importState(state: GarminWatchHubState): void {
    this.hub = GarminWatchHub.fromState(state);
  }
}
