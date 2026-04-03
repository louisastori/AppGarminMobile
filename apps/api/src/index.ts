import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import {
  createDemoGarminWatchHub,
  GarminWatchHub,
  type MetricHistoryQuery,
} from "@nouvelle-app/domain";
import {
  isGarminConnectIqBatchEnvelope,
  isGarminConnectIqDeviceCapabilities,
  isGarminConnectIqDeviceHello,
  isGarminConnectIqLinkStatus,
  isGarminConnectIqMetricKey,
  isGarminConnectIqSyncDiagnostic,
} from "@nouvelle-app/shared";

export interface ApiRequest {
  readonly method: string;
  readonly url: string;
  readonly body?: unknown;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

export interface ApiRouteDefinition {
  readonly method: string;
  readonly path: string;
  readonly description: string;
}

export const API_ROUTES: ApiRouteDefinition[] = [
  {
    method: "POST",
    path: "/watch-links/:deviceId/hello",
    description: "Registers device hello payloads from the mobile companion.",
  },
  {
    method: "POST",
    path: "/watch-links/:deviceId/capabilities",
    description: "Stores watch capabilities negotiated by the companion.",
  },
  {
    method: "POST",
    path: "/watch-links/:deviceId/status",
    description: "Records mobile link status snapshots.",
  },
  {
    method: "POST",
    path: "/watch-links/:deviceId/batches",
    description: "Ingests deduplicated Garmin Connect IQ batches.",
  },
  {
    method: "POST",
    path: "/watch-links/:deviceId/diagnostics",
    description: "Stores mobile/watch diagnostics emitted during sync.",
  },
  {
    method: "GET",
    path: "/watch-links/:deviceId/status",
    description: "Returns the latest device status summary.",
  },
  {
    method: "GET",
    path: "/devices",
    description: "Lists known devices and sync coverage.",
  },
  {
    method: "GET",
    path: "/devices/:deviceId/metrics/latest",
    description: "Returns the latest metric sample per metric key.",
  },
  {
    method: "GET",
    path: "/devices/:deviceId/metrics/history",
    description: "Returns metric history, optionally filtered by metricKey and limit.",
  },
  {
    method: "GET",
    path: "/devices/:deviceId/sync-jobs",
    description: "Returns recent sync jobs for a device.",
  },
  {
    method: "GET",
    path: "/devices/:deviceId/diagnostics",
    description: "Returns recent ingest rejections and diagnostics.",
  },
];

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

function notFound(pathname: string): ApiResponse {
  return json(404, {
    error: `No route matched ${pathname}`,
  });
}

function badRequest(message: string): ApiResponse {
  return json(400, {
    error: message,
  });
}

function getPathParams(
  pathname: string,
  template: string,
): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const templateParts = template.split("/").filter(Boolean);
  if (pathParts.length !== templateParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let index = 0; index < templateParts.length; index += 1) {
    const templatePart = templateParts[index]!;
    const pathPart = pathParts[index]!;
    if (templatePart.startsWith(":")) {
      params[templatePart.slice(1)] = decodeURIComponent(pathPart);
      continue;
    }

    if (templatePart !== pathPart) {
      return null;
    }
  }

  return params;
}

export class NouvelleAppApi {
  constructor(private readonly hub: GarminWatchHub = createDemoGarminWatchHub()) {}

  handle(request: ApiRequest): ApiResponse {
    const url = new URL(request.url, "http://localhost");
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/devices") {
      return json(200, {
        devices: this.hub.listDevices(),
      });
    }

    const helloParams = getPathParams(pathname, "/watch-links/:deviceId/hello");
    if (request.method === "POST" && helloParams) {
      if (!isGarminConnectIqDeviceHello(request.body)) {
        return badRequest("Expected a GarminConnectIqDeviceHello payload.");
      }

      if (request.body.deviceId !== helloParams.deviceId) {
        return badRequest("deviceId mismatch between path and payload.");
      }

      const device = this.hub.recordDeviceHello(request.body);
      return json(202, { device });
    }

    const capabilitiesParams = getPathParams(
      pathname,
      "/watch-links/:deviceId/capabilities",
    );
    if (request.method === "POST" && capabilitiesParams) {
      if (!isGarminConnectIqDeviceCapabilities(request.body)) {
        return badRequest("Expected a GarminConnectIqDeviceCapabilities payload.");
      }

      const deviceId = capabilitiesParams.deviceId!;
      const device = this.hub.recordCapabilities(deviceId, request.body);
      return json(202, { device });
    }

    const linkStatusParams = getPathParams(pathname, "/watch-links/:deviceId/status");
    if (request.method === "POST" && linkStatusParams) {
      if (!isGarminConnectIqLinkStatus(request.body)) {
        return badRequest("Expected a GarminConnectIqLinkStatus payload.");
      }

      const deviceId = linkStatusParams.deviceId!;
      const syncJob = this.hub.recordLinkStatus(deviceId, request.body);
      return json(202, { syncJob });
    }

    if (request.method === "GET" && linkStatusParams) {
      const deviceId = linkStatusParams.deviceId!;
      const status = this.hub.getStatusSummary(deviceId);
      if (!status) {
        return notFound(pathname);
      }

      return json(200, status);
    }

    const batchParams = getPathParams(pathname, "/watch-links/:deviceId/batches");
    if (request.method === "POST" && batchParams) {
      if (!isGarminConnectIqBatchEnvelope(request.body)) {
        return badRequest("Expected a GarminConnectIqBatchEnvelope payload.");
      }

      const deviceId = batchParams.deviceId!;
      const result = this.hub.ingestBatch(deviceId, request.body);
      return json(201, result);
    }

    const diagnosticsParams = getPathParams(
      pathname,
      "/watch-links/:deviceId/diagnostics",
    );
    if (request.method === "POST" && diagnosticsParams) {
      if (!isGarminConnectIqSyncDiagnostic(request.body)) {
        return badRequest("Expected a GarminConnectIqSyncDiagnostic payload.");
      }

      const deviceId = diagnosticsParams.deviceId!;
      const syncJob = this.hub.recordDiagnostic(deviceId, request.body);
      return json(202, { syncJob });
    }

    const latestMetricParams = getPathParams(
      pathname,
      "/devices/:deviceId/metrics/latest",
    );
    if (request.method === "GET" && latestMetricParams) {
      const deviceId = latestMetricParams.deviceId!;
      return json(200, {
        deviceId,
        metrics: this.hub.getLatestMetrics(deviceId),
      });
    }

    const historyParams = getPathParams(pathname, "/devices/:deviceId/metrics/history");
    if (request.method === "GET" && historyParams) {
      let metricKeyFilter: MetricHistoryQuery["metricKey"];
      let limitFilter: number | undefined;
      const metricKey = url.searchParams.get("metricKey");
      if (metricKey !== null) {
        if (!isGarminConnectIqMetricKey(metricKey)) {
          return badRequest(`Unsupported metricKey ${metricKey}`);
        }
        metricKeyFilter = metricKey;
      }

      const limit = url.searchParams.get("limit");
      if (limit !== null) {
        const parsedLimit = Number(limit);
        if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
          return badRequest("limit must be a positive integer.");
        }
        limitFilter = parsedLimit;
      }

      const query: MetricHistoryQuery = {
        ...(metricKeyFilter ? { metricKey: metricKeyFilter } : {}),
        ...(limitFilter ? { limit: limitFilter } : {}),
      };

      const deviceId = historyParams.deviceId!;
      return json(200, {
        deviceId,
        records: this.hub.getMetricHistory(deviceId, query),
      });
    }

    const syncJobParams = getPathParams(pathname, "/devices/:deviceId/sync-jobs");
    if (request.method === "GET" && syncJobParams) {
      const deviceId = syncJobParams.deviceId!;
      return json(200, {
        deviceId,
        syncJobs: this.hub.getSyncJobs(deviceId),
      });
    }

    const diagnosticsViewParams = getPathParams(
      pathname,
      "/devices/:deviceId/diagnostics",
    );
    if (request.method === "GET" && diagnosticsViewParams) {
      const deviceId = diagnosticsViewParams.deviceId!;
      return json(200, {
        deviceId,
        statusView: this.hub.getStatusView(deviceId),
      });
    }

    return notFound(pathname);
  }

  getHub(): GarminWatchHub {
    return this.hub;
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createHttpServer(api: NouvelleAppApi = new NouvelleAppApi()) {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const body =
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await readJsonBody(request);

      const apiResponse = api.handle({
        method: request.method ?? "GET",
        url: request.url ?? "/",
        body,
      });

      response.statusCode = apiResponse.status;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify(apiResponse.body, null, 2));
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(
        JSON.stringify(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unknown API server error",
          },
          null,
          2,
        ),
      );
    }
  });
}

export async function writeApiBuildArtifacts(
  outputDir: string,
  api: NouvelleAppApi = new NouvelleAppApi(),
): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    join(outputDir, "route-manifest.json"),
    JSON.stringify(API_ROUTES, null, 2),
    "utf8",
  );
  await writeFile(
    join(outputDir, "sample-state.json"),
    JSON.stringify(api.getHub().toState(), null, 2),
    "utf8",
  );
}

export async function buildApiArtifactsFromCwd(): Promise<void> {
  const outputDir = join(process.cwd(), "dist");
  await writeApiBuildArtifacts(outputDir);
}
