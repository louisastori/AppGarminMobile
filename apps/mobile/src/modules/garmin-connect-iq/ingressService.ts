import {
  isGarminConnectIqBatchEnvelope,
  isGarminConnectIqDeviceCapabilities,
  isGarminConnectIqDeviceHello,
  isGarminConnectIqLinkStatus,
  isGarminConnectIqSyncDiagnostic,
  isGarminConnectIqWatchError,
} from "./contract";
import type { GarminConnectIqBatchAck } from "./types";
import { WatchAckService } from "./ackService";
import { WatchStorageService } from "./storageService";

export interface WatchIngressResult {
  readonly accepted: boolean;
  readonly reason: string;
  readonly ack: GarminConnectIqBatchAck | null;
}

export class WatchIngressService {
  constructor(
    private readonly storage: WatchStorageService,
    private readonly ackService: WatchAckService = new WatchAckService(),
  ) {}

  ingestMessage(deviceId: string, payload: unknown): WatchIngressResult {
    if (isGarminConnectIqDeviceHello(payload)) {
      if (payload.deviceId !== deviceId) {
        this.storage.rejectPayload(deviceId, "device_id_mismatch", payload);
        return {
          accepted: false,
          reason: "device_id_mismatch",
          ack: null,
        };
      }

      this.storage.recordDeviceHello(payload);
      return {
        accepted: true,
        reason: "device_hello_recorded",
        ack: null,
      };
    }

    if (isGarminConnectIqDeviceCapabilities(payload)) {
      this.storage.recordCapabilities(deviceId, payload);
      return {
        accepted: true,
        reason: "device_capabilities_recorded",
        ack: null,
      };
    }

    if (isGarminConnectIqLinkStatus(payload)) {
      this.storage.recordLinkStatus(deviceId, payload);
      return {
        accepted: true,
        reason: "link_status_recorded",
        ack: null,
      };
    }

    if (isGarminConnectIqBatchEnvelope(payload)) {
      const result = this.storage.ingestBatch(deviceId, payload);
      const ack = this.ackService.acknowledgeBatch(payload, result.ack.acknowledgedAt);
      return {
        accepted: result.accepted || result.duplicateBatch,
        reason: result.duplicateBatch ? "duplicate_batch" : "batch_recorded",
        ack,
      };
    }

    if (isGarminConnectIqSyncDiagnostic(payload)) {
      this.storage.recordDiagnostic(deviceId, payload);
      return {
        accepted: true,
        reason: "diagnostic_recorded",
        ack: null,
      };
    }

    if (isGarminConnectIqWatchError(payload)) {
      this.storage.rejectPayload(deviceId, payload.code, payload);
      return {
        accepted: false,
        reason: payload.code,
        ack: null,
      };
    }

    this.storage.rejectPayload(deviceId, "unknown_message", payload);
    return {
      accepted: false,
      reason: "unknown_message",
      ack: null,
    };
  }
}
