export type DashboardTab = 'overview' | 'devices' | 'timeline' | 'diagnostics';

export type HealthState = 'connected' | 'ready' | 'attention';

export type SyncState = 'success' | 'partial' | 'pending';

export type DiagnosticSeverity = 'high' | 'medium' | 'low';

export type DeviceDataState = 'received' | 'pending' | 'blocked';

export interface DeviceDataPoint {
  id: string;
  label: string;
  value: string;
  state: DeviceDataState;
  note: string;
}

export interface Device {
  id: string;
  name: string;
  role: string;
  transport: string;
  status: HealthState;
  integration: string;
  lastSeen: string;
  note: string;
  metrics: string[];
  dataPoints: DeviceDataPoint[];
}

export interface TimelineSession {
  id: string;
  title: string;
  sport: string;
  time: string;
  duration: string;
  primaryDevice: string;
  summary: string;
  sources: string[];
}

export interface SyncJob {
  id: string;
  title: string;
  status: SyncState;
  finishedAt: string;
  detail: string;
}

export interface CarbonController {
  connected: boolean;
  workoutActive: boolean;
  speedKph: number;
  inclinePct: number;
  targetMinutes: number;
}

export interface DiagnosticItem {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  action: string;
}