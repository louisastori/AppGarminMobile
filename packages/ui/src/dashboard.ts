import type {
  WatchDeviceSummary,
  WatchMetricRecord,
  WatchStatusView,
  WatchSyncJobRecord,
} from "@nouvelle-app/domain";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatMetricValue(metric: WatchMetricRecord): string {
  if (metric.metricValue === null) {
    return "n/a";
  }

  if (typeof metric.metricValue === "boolean") {
    return metric.metricValue ? "yes" : "no";
  }

  if (typeof metric.metricValue === "string") {
    return metric.metricValue;
  }

  const rounded =
    Number.isInteger(metric.metricValue) || Math.abs(metric.metricValue) >= 100
      ? metric.metricValue.toFixed(0)
      : metric.metricValue.toFixed(2);
  return metric.metricUnit ? `${rounded} ${metric.metricUnit}` : rounded;
}

function renderMetricCards(metrics: readonly WatchMetricRecord[]): string {
  return metrics
    .map(
      (metric) => `
        <article class="card">
          <p class="eyebrow">${escapeHtml(metric.metricKey)}</p>
          <h3>${escapeHtml(formatMetricValue(metric))}</h3>
          <p class="meta">Recorded ${escapeHtml(metric.recordedAt)}</p>
        </article>`,
    )
    .join("");
}

function renderSyncJobs(syncJobs: readonly WatchSyncJobRecord[]): string {
  if (syncJobs.length === 0) {
    return "<p>No sync job has been recorded yet.</p>";
  }

  return `<ul class="jobs">${syncJobs
    .map(
      (job) =>
        `<li><strong>${escapeHtml(job.kind)}</strong> ${escapeHtml(job.outcome)} · ${escapeHtml(job.summary)}</li>`,
    )
    .join("")}</ul>`;
}

function renderDeviceList(devices: readonly WatchDeviceSummary[]): string {
  return `<section class="device-grid">${devices
    .map(
      (device) => `
        <article class="card">
          <p class="eyebrow">${escapeHtml(device.deviceKind ?? "unknown")}</p>
          <h3>${escapeHtml(device.deviceModel ?? device.deviceId)}</h3>
          <p class="meta">Health ${escapeHtml(device.health)}</p>
          <p class="meta">${device.metricsTracked} metrics · ${device.snapshotsTracked} snapshots</p>
        </article>`,
    )
    .join("")}</section>`;
}

export function renderDeviceDashboard(
  title: string,
  devices: readonly WatchDeviceSummary[],
  selectedView: WatchStatusView | null,
): string {
  const metrics = selectedView ? renderMetricCards(selectedView.latestMetrics) : "";
  const syncJobs = selectedView ? renderSyncJobs(selectedView.recentSyncJobs) : "";
  const rejectionCount = selectedView?.recentRejections.length ?? 0;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f3eb;
        --paper: #fffdf8;
        --ink: #18222f;
        --muted: #6a7280;
        --accent: #d88f34;
        --border: #e6ddcf;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: radial-gradient(circle at top right, #f3dcb5, var(--bg));
        color: var(--ink);
      }
      main {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 60px;
      }
      .hero {
        background: var(--paper);
        border: 1px solid var(--border);
        border-radius: 28px;
        padding: 24px;
        margin-bottom: 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        font-size: 12px;
      }
      .device-grid, .metric-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .card {
        background: var(--paper);
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 18px;
      }
      .meta {
        color: var(--muted);
      }
      .jobs {
        padding-left: 18px;
      }
      .diagnostic {
        background: #fff0df;
        border-left: 4px solid var(--accent);
        padding: 14px 16px;
        border-radius: 16px;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">nouvelleApp web</p>
        <h1>${escapeHtml(title)}</h1>
        <p>OpenSpec dashboard for Connect IQ ingestion, diagnostics and validation.</p>
      </section>
      ${renderDeviceList(devices)}
      ${
        selectedView
          ? `<section class="hero">
              <p class="eyebrow">selected device</p>
              <h2>${escapeHtml(selectedView.device.deviceModel ?? selectedView.device.deviceId)}</h2>
              <p>Last batch ${escapeHtml(selectedView.device.lastBatchId ?? "none")} · health ${escapeHtml(selectedView.device.health)}</p>
              <div class="diagnostic">Pending batches ${selectedView.device.pendingBatchCount} · recent rejections ${rejectionCount}</div>
            </section>
            <section class="metric-grid">${metrics}</section>
            <section class="hero">
              <p class="eyebrow">sync jobs</p>
              ${syncJobs}
            </section>`
          : ""
      }
    </main>
  </body>
</html>`;
}
