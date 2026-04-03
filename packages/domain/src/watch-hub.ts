import {
  createGarminConnectIqBatchAck,
  type GarminConnectIqBatchEnvelope,
  type GarminConnectIqDeviceCapabilities,
  type GarminConnectIqDeviceHello,
  type GarminConnectIqLinkStatus,
  type GarminConnectIqMetricKey,
  type GarminConnectIqMetricSample,
  type GarminConnectIqSnapshot,
  type GarminConnectIqSyncDiagnostic,
} from "@nouvelle-app/shared";
import type {
  GarminWatchHubSeed,
  GarminWatchHubState,
  MetricHistoryQuery,
  WatchBatchIngestResult,
  WatchBatchRecord,
  WatchDeviceRecord,
  WatchDeviceSummary,
  WatchIngestRejectionRecord,
  WatchMetricRecord,
  WatchSnapshotRecord,
  WatchStatusSummary,
  WatchStatusView,
  WatchSyncJobKind,
  WatchSyncJobOutcome,
  WatchSyncJobRecord,
} from "./watch-models";

function sortByRecordedAt<T extends { recordedAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    left.recordedAt.localeCompare(right.recordedAt),
  );
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export class GarminWatchHub {
  private readonly devices = new Map<string, WatchDeviceRecord>();
  private readonly metricsByDevice = new Map<string, Map<string, WatchMetricRecord>>();
  private readonly snapshotsByDevice = new Map<
    string,
    Map<string, WatchSnapshotRecord>
  >();
  private readonly batchesByDevice = new Map<string, Map<string, WatchBatchRecord>>();
  private readonly syncJobsByDevice = new Map<string, WatchSyncJobRecord[]>();
  private readonly rejectionsByDevice = new Map<
    string,
    WatchIngestRejectionRecord[]
  >();
  private nextJobSequence = 1;

  constructor(state?: GarminWatchHubState) {
    if (!state) {
      return;
    }

    this.nextJobSequence = state.nextJobSequence;

    for (const device of state.devices) {
      this.devices.set(device.deviceId, device);
    }

    for (const metric of state.metrics) {
      this.metricMap(metric.deviceId).set(metric.sampleId, metric);
    }

    for (const snapshot of state.snapshots) {
      this.snapshotMap(snapshot.deviceId).set(snapshot.snapshotId, snapshot);
    }

    for (const batch of state.batches) {
      this.batchMap(batch.deviceId).set(batch.batchId, batch);
    }

    for (const syncJob of state.syncJobs) {
      this.syncJobs(syncJob.deviceId).push(syncJob);
    }

    for (const rejection of state.rejections) {
      this.rejections(rejection.deviceId).push(rejection);
    }
  }

  static fromState(state: GarminWatchHubState): GarminWatchHub {
    return new GarminWatchHub(state);
  }

  static fromSeed(seed: GarminWatchHubSeed): GarminWatchHub {
    const hub = new GarminWatchHub();
    hub.recordDeviceHello(seed.hello);
    hub.recordCapabilities(seed.hello.deviceId, seed.capabilities);
    hub.recordLinkStatus(seed.hello.deviceId, seed.linkStatus);

    for (const batch of seed.batches) {
      hub.ingestBatch(seed.hello.deviceId, batch);
    }

    for (const diagnostic of seed.diagnostics ?? []) {
      hub.recordDiagnostic(seed.hello.deviceId, diagnostic);
    }

    return hub;
  }

  toState(): GarminWatchHubState {
    return {
      devices: [...this.devices.values()],
      metrics: [...this.metricsByDevice.values()].flatMap((metrics) => [...metrics.values()]),
      snapshots: [...this.snapshotsByDevice.values()].flatMap((snapshots) => [
        ...snapshots.values(),
      ]),
      batches: [...this.batchesByDevice.values()].flatMap((batches) => [
        ...batches.values(),
      ]),
      syncJobs: [...this.syncJobsByDevice.values()].flatMap((jobs) => jobs),
      rejections: [...this.rejectionsByDevice.values()].flatMap((items) => items),
      nextJobSequence: this.nextJobSequence,
    };
  }

  recordDeviceHello(
    hello: GarminConnectIqDeviceHello,
    observedAt: string = new Date().toISOString(),
  ): WatchDeviceRecord {
    const current = this.ensureDevice(hello.deviceId, observedAt);
    const next: WatchDeviceRecord = {
      ...current,
      deviceKind: hello.deviceKind,
      deviceModel: hello.deviceModel,
      firmwareVersion: hello.firmwareVersion,
      appVersion: hello.appVersion,
      timezoneOffsetMinutes: hello.timezoneOffsetMinutes,
      lastSeenAt: observedAt,
    };
    this.devices.set(hello.deviceId, next);
    return next;
  }

  recordCapabilities(
    deviceId: string,
    capabilities: GarminConnectIqDeviceCapabilities,
    observedAt: string = new Date().toISOString(),
  ): WatchDeviceRecord {
    const current = this.ensureDevice(deviceId, observedAt);
    const next: WatchDeviceRecord = {
      ...current,
      capabilities,
      lastSeenAt: observedAt,
    };
    this.devices.set(deviceId, next);
    return next;
  }

  recordLinkStatus(
    deviceId: string,
    linkStatus: GarminConnectIqLinkStatus,
    observedAt: string = new Date().toISOString(),
  ): WatchSyncJobRecord {
    const current = this.ensureDevice(deviceId, observedAt);
    const next: WatchDeviceRecord = {
      ...current,
      health: linkStatus.health,
      pendingBatchCount: linkStatus.pendingBatchCount,
      lastBatchId: linkStatus.lastBatchId,
      lastSeenAt: observedAt,
    };
    this.devices.set(deviceId, next);

    const job = this.createJob(
      deviceId,
      "link_status",
      "recorded",
      observedAt,
      linkStatus.lastBatchId,
      0,
      0,
      `Link health ${linkStatus.health}, pending ${linkStatus.pendingBatchCount}`,
      linkStatus,
    );
    this.syncJobs(deviceId).push(job);
    return job;
  }

  recordDiagnostic(
    deviceId: string,
    diagnostic: GarminConnectIqSyncDiagnostic,
    observedAt: string = new Date().toISOString(),
  ): WatchSyncJobRecord {
    const current = this.ensureDevice(deviceId, observedAt);
    const next: WatchDeviceRecord = {
      ...current,
      health: "error",
      lastDiagnostic: diagnostic,
      lastSeenAt: observedAt,
    };
    this.devices.set(deviceId, next);

    const job = this.createJob(
      deviceId,
      "diagnostic",
      "recorded",
      observedAt,
      diagnostic.batchId,
      0,
      0,
      `Diagnostic ${diagnostic.code}: ${diagnostic.message}`,
      diagnostic,
    );
    this.syncJobs(deviceId).push(job);
    return job;
  }

  rejectPayload(
    deviceId: string,
    reason: string,
    rawPayload: unknown,
    batchId: string | null = null,
    recordedAt: string = new Date().toISOString(),
  ): WatchIngestRejectionRecord {
    this.ensureDevice(deviceId, recordedAt);
    const rejection: WatchIngestRejectionRecord = {
      deviceId,
      batchId,
      recordedAt,
      reason,
      rawPayload,
    };
    this.rejections(deviceId).push(rejection);
    return rejection;
  }

  ingestBatch(
    deviceId: string,
    batch: GarminConnectIqBatchEnvelope,
    ingestedAt: string = new Date().toISOString(),
  ): WatchBatchIngestResult {
    const current = this.ensureDevice(deviceId, ingestedAt);
    const batches = this.batchMap(deviceId);

    if (batches.has(batch.batchId)) {
      const duplicateJob = this.createJob(
        deviceId,
        "batch",
        "duplicate",
        ingestedAt,
        batch.batchId,
        0,
        0,
        `Duplicate batch ${batch.batchId} ignored`,
        batch,
      );
      this.syncJobs(deviceId).push(duplicateJob);

      const ack = createGarminConnectIqBatchAck(
        batch.batchId,
        batch.lastSampleId,
        ingestedAt,
      );

      this.devices.set(deviceId, {
        ...current,
        lastSeenAt: ingestedAt,
        lastAckCursor: ack.lastSampleId,
      });

      return {
        deviceId,
        accepted: false,
        duplicateBatch: true,
        acceptedSampleCount: 0,
        duplicateSampleCount: 0,
        snapshotCount: 0,
        ack,
        job: duplicateJob,
      };
    }

    const metrics = this.metricMap(deviceId);
    const snapshots = this.snapshotMap(deviceId);
    let acceptedSampleCount = 0;
    let duplicateSampleCount = 0;
    let snapshotCount = 0;

    for (const item of batch.items) {
      if (item.messageType === "snapshot") {
        const snapshotResult = this.upsertSnapshot(
          deviceId,
          batch.batchId,
          ingestedAt,
          snapshots,
          metrics,
          item,
        );
        snapshotCount += snapshotResult.snapshotCount;
        acceptedSampleCount += snapshotResult.acceptedSampleCount;
        duplicateSampleCount += snapshotResult.duplicateSampleCount;
        continue;
      }

      if (metrics.has(item.sampleId)) {
        duplicateSampleCount += 1;
        continue;
      }

      metrics.set(
        item.sampleId,
        this.toMetricRecord(deviceId, batch.batchId, null, ingestedAt, item),
      );
      acceptedSampleCount += 1;
    }

    batches.set(batch.batchId, {
      deviceId,
      batchId: batch.batchId,
      sequence: batch.sequence,
      createdAt: batch.createdAt,
      ingestedAt,
      itemCount: batch.items.length,
      lastSampleId: batch.lastSampleId,
      rawBatch: batch,
    });

    const ack = createGarminConnectIqBatchAck(
      batch.batchId,
      batch.lastSampleId,
      ingestedAt,
    );

    this.devices.set(deviceId, {
      ...current,
      health: current.health === "error" ? "degraded" : "connected",
      lastSeenAt: ingestedAt,
      lastSuccessfulSyncAt: ingestedAt,
      lastBatchId: batch.batchId,
      lastAckCursor: ack.lastSampleId,
      totalAcceptedSamples: current.totalAcceptedSamples + acceptedSampleCount,
      totalDuplicateSamples: current.totalDuplicateSamples + duplicateSampleCount,
    });

    const job = this.createJob(
      deviceId,
      "batch",
      "accepted",
      ingestedAt,
      batch.batchId,
      acceptedSampleCount,
      duplicateSampleCount,
      `Accepted batch ${batch.batchId} with ${acceptedSampleCount} sample(s) and ${snapshotCount} snapshot(s)`,
      batch,
    );
    this.syncJobs(deviceId).push(job);

    return {
      deviceId,
      accepted: true,
      duplicateBatch: false,
      acceptedSampleCount,
      duplicateSampleCount,
      snapshotCount,
      ack,
      job,
    };
  }

  listDevices(): WatchDeviceSummary[] {
    return [...this.devices.values()]
      .map((device) => ({
        deviceId: device.deviceId,
        deviceKind: device.deviceKind,
        deviceModel: device.deviceModel,
        health: device.health,
        pendingBatchCount: device.pendingBatchCount,
        lastBatchId: device.lastBatchId,
        lastSuccessfulSyncAt: device.lastSuccessfulSyncAt,
        metricsTracked: this.metricMap(device.deviceId).size,
        snapshotsTracked: this.snapshotMap(device.deviceId).size,
        totalAcceptedSamples: device.totalAcceptedSamples,
        totalDuplicateSamples: device.totalDuplicateSamples,
        lastDiagnosticCode: device.lastDiagnostic?.code ?? null,
      }))
      .sort((left, right) => left.deviceId.localeCompare(right.deviceId));
  }

  getDevice(deviceId: string): WatchDeviceRecord | null {
    return this.devices.get(deviceId) ?? null;
  }

  getLatestMetrics(deviceId: string): WatchMetricRecord[] {
    const latestByMetric = new Map<GarminConnectIqMetricKey, WatchMetricRecord>();

    for (const metric of this.metricMap(deviceId).values()) {
      const current = latestByMetric.get(metric.metricKey);
      if (!current || current.recordedAt.localeCompare(metric.recordedAt) < 0) {
        latestByMetric.set(metric.metricKey, metric);
      }
    }

    return [...latestByMetric.values()].sort((left, right) =>
      left.metricKey.localeCompare(right.metricKey),
    );
  }

  getMetricHistory(
    deviceId: string,
    query: MetricHistoryQuery = {},
  ): WatchMetricRecord[] {
    const records = sortByRecordedAt([...this.metricMap(deviceId).values()]).filter(
      (record) => !query.metricKey || record.metricKey === query.metricKey,
    );

    if (!query.limit || query.limit >= records.length) {
      return records;
    }

    return records.slice(-query.limit);
  }

  getSnapshots(deviceId: string): WatchSnapshotRecord[] {
    return sortByRecordedAt([...this.snapshotMap(deviceId).values()]);
  }

  getBatches(deviceId: string): WatchBatchRecord[] {
    return sortByCreatedAtDesc([...this.batchMap(deviceId).values()]);
  }

  getSyncJobs(deviceId: string, limit = 20): WatchSyncJobRecord[] {
    return sortByCreatedAtDesc(this.syncJobs(deviceId)).slice(0, limit);
  }

  getRejections(deviceId: string, limit = 20): WatchIngestRejectionRecord[] {
    return [...this.rejections(deviceId)]
      .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .slice(0, limit);
  }

  getStatusSummary(deviceId: string): WatchStatusSummary | null {
    const device = this.getDevice(deviceId);
    if (!device) {
      return null;
    }

    return {
      deviceId,
      health: device.health,
      lastBatchId: device.lastBatchId,
      lastSuccessfulSyncAt: device.lastSuccessfulSyncAt,
      pendingBatchCount: device.pendingBatchCount,
      lastDiagnostic: device.lastDiagnostic,
      latestMetrics: this.getLatestMetrics(deviceId),
    };
  }

  getStatusView(deviceId: string): WatchStatusView | null {
    const device = this.getDevice(deviceId);
    if (!device) {
      return null;
    }

    return {
      device,
      latestMetrics: this.getLatestMetrics(deviceId),
      recentSyncJobs: this.getSyncJobs(deviceId),
      recentRejections: this.getRejections(deviceId),
    };
  }

  private ensureDevice(deviceId: string, observedAt: string): WatchDeviceRecord {
    const current = this.devices.get(deviceId);
    if (current) {
      return current;
    }

    const created: WatchDeviceRecord = {
      deviceId,
      deviceKind: null,
      deviceModel: null,
      firmwareVersion: null,
      appVersion: null,
      timezoneOffsetMinutes: null,
      firstSeenAt: observedAt,
      lastSeenAt: observedAt,
      lastSuccessfulSyncAt: null,
      lastBatchId: null,
      lastAckCursor: null,
      pendingBatchCount: 0,
      health: "connecting",
      capabilities: null,
      lastDiagnostic: null,
      totalAcceptedSamples: 0,
      totalDuplicateSamples: 0,
    };
    this.devices.set(deviceId, created);
    return created;
  }

  private metricMap(deviceId: string): Map<string, WatchMetricRecord> {
    const current = this.metricsByDevice.get(deviceId);
    if (current) {
      return current;
    }

    const created = new Map<string, WatchMetricRecord>();
    this.metricsByDevice.set(deviceId, created);
    return created;
  }

  private snapshotMap(deviceId: string): Map<string, WatchSnapshotRecord> {
    const current = this.snapshotsByDevice.get(deviceId);
    if (current) {
      return current;
    }

    const created = new Map<string, WatchSnapshotRecord>();
    this.snapshotsByDevice.set(deviceId, created);
    return created;
  }

  private batchMap(deviceId: string): Map<string, WatchBatchRecord> {
    const current = this.batchesByDevice.get(deviceId);
    if (current) {
      return current;
    }

    const created = new Map<string, WatchBatchRecord>();
    this.batchesByDevice.set(deviceId, created);
    return created;
  }

  private syncJobs(deviceId: string): WatchSyncJobRecord[] {
    const current = this.syncJobsByDevice.get(deviceId);
    if (current) {
      return current;
    }

    const created: WatchSyncJobRecord[] = [];
    this.syncJobsByDevice.set(deviceId, created);
    return created;
  }

  private rejections(deviceId: string): WatchIngestRejectionRecord[] {
    const current = this.rejectionsByDevice.get(deviceId);
    if (current) {
      return current;
    }

    const created: WatchIngestRejectionRecord[] = [];
    this.rejectionsByDevice.set(deviceId, created);
    return created;
  }

  private upsertSnapshot(
    deviceId: string,
    batchId: string,
    ingestedAt: string,
    snapshots: Map<string, WatchSnapshotRecord>,
    metrics: Map<string, WatchMetricRecord>,
    snapshot: GarminConnectIqSnapshot,
  ): {
    snapshotCount: number;
    acceptedSampleCount: number;
    duplicateSampleCount: number;
  } {
    let snapshotCount = 0;
    if (!snapshots.has(snapshot.snapshotId)) {
      snapshots.set(snapshot.snapshotId, {
        ...snapshot,
        deviceId,
        batchId,
        ingestedAt,
      });
      snapshotCount = 1;
    }

    let acceptedSampleCount = 0;
    let duplicateSampleCount = 0;
    for (const sample of snapshot.items) {
      if (metrics.has(sample.sampleId)) {
        duplicateSampleCount += 1;
        continue;
      }

      metrics.set(
        sample.sampleId,
        this.toMetricRecord(
          deviceId,
          batchId,
          snapshot.snapshotId,
          ingestedAt,
          sample,
        ),
      );
      acceptedSampleCount += 1;
    }

    return {
      snapshotCount,
      acceptedSampleCount,
      duplicateSampleCount,
    };
  }

  private toMetricRecord(
    deviceId: string,
    batchId: string | null,
    snapshotId: string | null,
    ingestedAt: string,
    sample: GarminConnectIqMetricSample,
  ): WatchMetricRecord {
    return {
      ...sample,
      deviceId,
      batchId,
      snapshotId,
      ingestedAt,
    };
  }

  private createJob(
    deviceId: string,
    kind: WatchSyncJobKind,
    outcome: WatchSyncJobOutcome,
    createdAt: string,
    batchId: string | null,
    sampleCount: number,
    duplicateSampleCount: number,
    summary: string,
    rawPayload: unknown,
  ): WatchSyncJobRecord {
    const jobId = `job-${this.nextJobSequence.toString().padStart(5, "0")}`;
    this.nextJobSequence += 1;
    return {
      jobId,
      deviceId,
      kind,
      outcome,
      createdAt,
      batchId,
      sampleCount,
      duplicateSampleCount,
      summary,
      rawPayload,
    };
  }
}
