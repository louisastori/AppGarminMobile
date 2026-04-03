import { createGarminConnectIqBatchAck } from "./contract";
import type { GarminConnectIqBatchEnvelope, GarminConnectIqBatchAck } from "./types";

export class WatchAckService {
  acknowledgeBatch(
    batch: GarminConnectIqBatchEnvelope,
    acknowledgedAt?: string,
  ): GarminConnectIqBatchAck {
    return createGarminConnectIqBatchAck(
      batch.batchId,
      batch.lastSampleId,
      acknowledgedAt,
    );
  }
}
