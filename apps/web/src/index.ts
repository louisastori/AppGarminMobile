import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDemoGarminWatchHub } from "@nouvelle-app/domain";
import { renderDeviceDashboard } from "@nouvelle-app/ui";

export function renderWebDashboard(title = "nouvelleApp Connect IQ Dashboard"): string {
  const hub = createDemoGarminWatchHub();
  const devices = hub.listDevices();
  const firstDeviceId = devices[0]?.deviceId ?? null;
  const statusView = firstDeviceId ? hub.getStatusView(firstDeviceId) : null;
  return renderDeviceDashboard(title, devices, statusView);
}

export async function buildWebDashboard(outputDir: string): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  await writeFile(join(outputDir, "index.html"), renderWebDashboard(), "utf8");
}

export async function buildWebDashboardFromCwd(): Promise<void> {
  await buildWebDashboard(join(process.cwd(), "dist"));
}
