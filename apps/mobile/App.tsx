import { StatusBar } from 'expo-status-bar';
import { startTransition, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import {
  initialController,
  initialDevices,
  initialSessions,
  initialSyncJobs,
  overviewBullets,
} from './src/mockData';
import {
  GARMIN_CONNECT_IQ_EDGE_APP_ID,
  GARMIN_CONNECT_IQ_METRIC_DEFINITIONS,
  GARMIN_CONNECT_IQ_WATCH_APP_ID,
  createGarminConnectIqBridge,
  createGarminConnectIqBridgeStatus,
} from './src/modules/garmin-connect-iq';
import { palette } from './src/theme';
import type {
  CarbonController,
  DashboardTab,
  Device,
  DeviceDataPoint,
  DiagnosticItem,
  HealthState,
  SyncJob,
  SyncState,
  TimelineSession,
} from './src/types';
import type {
  GarminConnectIqBatchEnvelope,
  GarminConnectIqBridgeStatus,
  GarminConnectIqMetricKey,
  GarminConnectIqMetricSample,
} from './src/modules/garmin-connect-iq';

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: 'overview', label: 'Vue d ensemble' },
  { key: 'devices', label: 'Appareils' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'diagnostics', label: 'Diagnostic' },
];

type GarminMetricSampleMap = Partial<
  Record<GarminConnectIqMetricKey, GarminConnectIqMetricSample>
>;

type CompanionDeviceKind = 'fenix' | 'edge';

type CompanionDeviceLinkState = {
  known: boolean;
  connected: boolean;
  deviceStatus: HealthState;
};

function formatBridgeHealthLabel(health: GarminConnectIqBridgeStatus['health']) {
  switch (health) {
    case 'connected':
      return 'Connecte';
    case 'connecting':
      return 'Connexion';
    case 'degraded':
      return 'Degrade';
    case 'error':
      return 'Erreur';
    default:
      return 'Hors ligne';
  }
}

function getBridgeTone(health: GarminConnectIqBridgeStatus['health']) {
  switch (health) {
    case 'connected':
      return styles.badgeSuccess;
    case 'connecting':
    case 'degraded':
      return styles.badgeWarm;
    case 'error':
      return styles.badgeAlert;
    default:
      return styles.badgeNeutral;
  }
}

function formatAutoSyncLabel(status: GarminConnectIqBridgeStatus) {
  if (status.autoSyncMode === 'activity') {
    return 'Sync auto 1 min en activite';
  }

  if (status.autoSyncMode === 'idle') {
    return 'Sync auto 30 min hors activite';
  }

  return 'Sync manuel';
}

function extractGarminSamples(batch: GarminConnectIqBatchEnvelope): GarminMetricSampleMap {
  return batch.items.reduce<GarminMetricSampleMap>((current, item) => {
    if (item.messageType === 'metric_sample') {
      current[item.metricKey] = item;
      return current;
    }

    for (const sample of item.items) {
      current[sample.metricKey] = sample;
    }

    return current;
  }, {});
}

function getGarminMetricNumber(
  metrics: GarminMetricSampleMap,
  metricKey: GarminConnectIqMetricKey,
): number | null {
  const sample = metrics[metricKey];
  return typeof sample?.metricValue === 'number' ? sample.metricValue : null;
}

function formatGarminMetric(metrics: GarminMetricSampleMap, metricKey: GarminConnectIqMetricKey) {
  const sample = metrics[metricKey];

  if (!sample || sample.metricValue === null) {
    return null;
  }

  if (typeof sample.metricValue === 'number') {
    const roundedValue =
      Number.isInteger(sample.metricValue) || Math.abs(sample.metricValue) >= 100
        ? sample.metricValue.toFixed(0)
        : sample.metricValue.toFixed(1);

    return sample.metricUnit ? `${roundedValue} ${sample.metricUnit}` : roundedValue;
  }

  if (typeof sample.metricValue === 'boolean') {
    return sample.metricValue ? 'Oui' : 'Non';
  }

  return sample.metricValue;
}

function buildMetricFragment(
  metrics: GarminMetricSampleMap,
  metricKey: GarminConnectIqMetricKey,
  label: string,
) {
  const formatted = formatGarminMetric(metrics, metricKey);
  return formatted ? `${label} ${formatted}` : null;
}

function joinFragments(fragments: Array<string | null>) {
  const availableFragments = fragments.filter((fragment): fragment is string => Boolean(fragment));
  return availableFragments.length > 0 ? availableFragments.join(' · ') : null;
}

function hasAnyGarminMetric(metrics: GarminMetricSampleMap) {
  return Object.values(metrics).some((sample) => sample?.metricValue !== null && sample !== undefined);
}

function isBridgeReallyConnected(status: GarminConnectIqBridgeStatus) {
  return (
    status.health === 'connected' &&
    status.linkStatus?.health === 'connected' &&
    status.lastDiagnostic?.code !== 'device_not_connected' &&
    status.lastDiagnostic?.code !== 'app_not_installed' &&
    status.deviceHello !== null
  );
}

function isBridgeLinkedToDeviceKind(
  status: GarminConnectIqBridgeStatus,
  deviceKind: 'fenix' | 'edge',
) {
  return status.deviceHello?.deviceKind === deviceKind;
}

function isBridgeDeviceConnected(
  status: GarminConnectIqBridgeStatus,
  deviceKind: 'fenix' | 'edge',
) {
  return isBridgeReallyConnected(status) && isBridgeLinkedToDeviceKind(status, deviceKind);
}

function getCompanionDeviceLinkState(
  status: GarminConnectIqBridgeStatus,
  deviceKind: CompanionDeviceKind,
): CompanionDeviceLinkState {
  const known = isBridgeLinkedToDeviceKind(status, deviceKind);
  const connected = isBridgeDeviceConnected(status, deviceKind);

  return {
    known,
    connected,
    deviceStatus: connected ? 'connected' : known ? 'attention' : 'ready',
  };
}

function resolveCompanionDevicePresentation(
  status: GarminConnectIqBridgeStatus,
  deviceKind: CompanionDeviceKind,
  bridgeNow: string,
): Pick<Device, 'status' | 'lastSeen' | 'note'> {
  const linkState = getCompanionDeviceLinkState(status, deviceKind);

  if (deviceKind === 'fenix') {
    return {
      status: linkState.deviceStatus,
      lastSeen: linkState.connected ? bridgeNow : linkState.known ? 'Connexion a confirmer' : 'Jamais',
      note: linkState.connected
        ? `Montre principale reliee a l app. ${formatAutoSyncLabel(status)}. Les mesures affichent uniquement des lots Connect IQ reels.`
        : status.lastDiagnostic?.message ??
          (linkState.known
            ? 'La fenix est connue du companion, mais la liaison n est pas encore confirmee.'
            : 'Montre en attente d une detection Connect IQ reelle.'),
    };
  }

  return {
    status: linkState.deviceStatus,
    lastSeen: linkState.connected ? bridgeNow : linkState.known ? 'Connexion a confirmer' : 'Jamais',
    note: linkState.connected
      ? `Bridge Connect IQ actif. ${formatAutoSyncLabel(status)}. Le chemin Edge -> mobile est confirme.`
      : linkState.known
        ? 'Le Edge repond au companion, mais la liaison mobile n est pas encore confirmee.'
        : 'Aucune connexion Edge reelle detectee. Le compteur reste hors ligne tant qu il est eteint ou non joint.',
  };
}

function isConfirmedCompanionField(value: string | null | undefined) {
  return Boolean(
    value &&
      value !== 'watch-pending' &&
      value !== 'pending-watch-handshake' &&
      value !== 'attente',
  );
}

function buildCompanionHighlights(
  status: GarminConnectIqBridgeStatus,
  metrics: GarminMetricSampleMap,
) {
  if (status.deviceHello?.deviceKind === 'edge') {
    const edgeHighlights = [
      buildMetricFragment(metrics, 'heart_rate_bpm', 'FC'),
      buildMetricFragment(metrics, 'activity_elapsed_time_s', 'Duree'),
      buildMetricFragment(metrics, 'activity_elapsed_distance_m', 'Dist'),
      buildMetricFragment(metrics, 'activity_current_cadence_rpm', 'Cadence'),
      buildMetricFragment(metrics, 'power_w', 'Power'),
    ].filter((item): item is string => Boolean(item));

    if (isBridgeReallyConnected(status) && edgeHighlights.length > 0) {
      return edgeHighlights;
    }
  }

  const metricHighlights = [
    buildMetricFragment(metrics, 'heart_rate_bpm', 'FC'),
    buildMetricFragment(metrics, 'stress_score', 'Stress'),
    buildMetricFragment(metrics, 'steps', 'Pas'),
    buildMetricFragment(metrics, 'time_to_recovery_h', 'Recup'),
    buildMetricFragment(metrics, 'body_battery_percent', 'BodyBat'),
    buildMetricFragment(metrics, 'temperature_c', 'Temp'),
  ].filter((item): item is string => Boolean(item));

  if (isBridgeReallyConnected(status) && metricHighlights.length > 0) {
    return metricHighlights;
  }

  if (status.lastDiagnostic?.code === 'app_not_installed') {
    return ['App montre absente', 'Aucune mesure recue', 'Installer la fenix'];
  }

  if (status.lastDiagnostic?.code === 'device_not_connected') {
    return ['Montre hors ligne', 'Aucune mesure recue', 'Relancer Garmin Connect'];
  }

  return [
    'Aucune mesure recue',
    `Etat ${formatBridgeHealthLabel(status.health)}`,
    status.pendingBatchCount > 0 ? `${status.pendingBatchCount} lot(s) en attente` : 'Premier lot en attente',
  ];
}

function getCompanionKindLabel(kind: CompanionDeviceKind) {
  return kind === 'edge' ? 'Edge 1030' : 'fenix 7 Pro';
}

function formatNow() {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());
}

function buildSyncJob(title: string, status: SyncState, detail: string): SyncJob {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    title,
    status,
    detail,
    finishedAt: formatNow(),
  };
}

function buildDiagnostics(
  devices: Device[],
  controller: CarbonController,
  syncJobs: SyncJob[],
): DiagnosticItem[] {
  const edge = devices.find((device) => device.id === 'edge-1030');
  const fenix = devices.find((device) => device.id === 'fenix-7-pro');
  const carbon = devices.find((device) => device.id === 'carbon-tls');
  const lastJob = syncJobs[0];

  return [
    {
      id: 'carbon-master',
      severity: controller.connected ? 'low' : 'high',
      title: controller.connected
        ? 'Carbon TLS pilote par nouvelleApp'
        : 'Activer le bridge direct du Carbon TLS',
      detail: controller.connected
        ? `Le mobile garde la main sur la vitesse (${controller.speedKph.toFixed(1)} km/h) et l incline (${controller.inclinePct.toFixed(1)}%).`
        : 'Le tapis est detecte, mais le controle local doit etre active pour lancer une seance.',
      action: controller.connected ? 'Controle local actif' : 'Controle local a activer',
    },
    {
      id: 'edge-bridge',
      severity: edge?.status === 'connected' ? 'low' : 'medium',
      title:
        edge?.status === 'connected'
          ? 'Bridge Edge 1030 disponible'
          : 'Terminer la liaison Edge 1030',
      detail:
        edge?.status === 'connected'
          ? 'Le chemin Connect IQ est pret pour les seances velo et le Zumo.'
          : 'Le compteur reste detecte, mais il faut finir la liaison mobile avant la prochaine sortie.',
      action: edge?.status === 'connected' ? 'Bridge pret' : 'Connecter Edge',
    },
    {
      id: 'fenix-sync',
      severity:
        fenix?.status === 'connected' && lastJob?.status === 'success' ? 'low' : 'medium',
      title:
        fenix?.status === 'connected'
          ? 'Sync fenix 7 Pro surveillee'
          : 'Rattacher la fenix 7 Pro',
      detail:
        fenix?.status === 'connected'
          ? `Derniere sync ${fenix.lastSeen}. La liaison montre est active, mais seules les mesures effectivement recues doivent etre affichees.`
          : 'La montre principale doit etre reliee pour remonter des mesures reelles dans l app.',
      action: fenix?.status === 'connected' ? 'Sync stable' : 'Connecter la fenix',
    },
    {
      id: 'sync-health',
      severity:
        lastJob?.status === 'partial'
          ? 'medium'
          : lastJob?.status === 'pending'
            ? 'medium'
            : 'low',
      title: 'Etat des synchronisations',
      detail: lastJob
        ? `${lastJob.title} a ${lastJob.finishedAt}. ${lastJob.detail}`
        : 'Aucune synchronisation n a encore ete lancee.',
      action: lastJob?.status === 'success' ? 'Stack saine' : 'Relancer la sync',
    },
    {
      id: 'migration-note',
      severity: carbon?.status === 'connected' ? 'low' : 'medium',
      title: 'iFIT n est plus maitre du Carbon TLS',
      detail:
        'Le prototype traite iFIT comme un canal legacy d import et garde le pilotage materiel dans nouvelleApp.',
      action: 'Architecture directe',
    },
  ];
}

function getStatusLabel(status: HealthState) {
  switch (status) {
    case 'connected':
      return 'Connecte';
    case 'ready':
      return 'Pret';
    case 'attention':
      return 'Attention';
    default:
      return status;
  }
}

function getStatusTone(status: HealthState) {
  switch (status) {
    case 'connected':
      return styles.badgeSuccess;
    case 'ready':
      return styles.badgeWarm;
    case 'attention':
      return styles.badgeAlert;
    default:
      return styles.badgeNeutral;
  }
}

function getSyncTone(status: SyncState) {
  switch (status) {
    case 'success':
      return styles.badgeSuccess;
    case 'partial':
      return styles.badgeWarm;
    case 'pending':
      return styles.badgeAlert;
    default:
      return styles.badgeNeutral;
  }
}

function getDataStateLabel(state: DeviceDataPoint['state']) {
  switch (state) {
    case 'received':
      return 'Recu';
    case 'pending':
      return 'Attente';
    case 'blocked':
      return 'Bloque';
    default:
      return state;
  }
}

function getDataStateTone(state: DeviceDataPoint['state']) {
  switch (state) {
    case 'received':
      return styles.badgeSuccess;
    case 'pending':
      return styles.badgeWarm;
    case 'blocked':
      return styles.badgeAlert;
    default:
      return styles.badgeNeutral;
  }
}

function getSeverityTone(severity: DiagnosticItem['severity']) {
  switch (severity) {
    case 'high':
      return styles.badgeAlert;
    case 'medium':
      return styles.badgeWarm;
    case 'low':
      return styles.badgeSuccess;
    default:
      return styles.badgeNeutral;
  }
}

function resolveDeviceMetrics(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
) {
  if (device.id === 'phone') {
    return [
      `${syncJobs.length} jobs`,
      'BLE ok',
      controller.connected ? 'Carbon maitre' : 'Carbon attente',
    ];
  }

  if (device.id === 'fenix-7-pro') {
    return ['Mesures reelles', 'Sync Connect IQ', 'Lot en attente'];
  }

  if (device.id === 'edge-1030') {
    return device.status === 'connected'
      ? ['Resume d activite', 'Capteurs velo', 'Bridge Connect IQ']
      : ['Activites en attente', 'Capteurs connus', 'Bridge partiel'];
  }

  if (device.id === 'carbon-tls') {
    return [
      `${controller.speedKph.toFixed(1)} km/h`,
      `${controller.inclinePct.toFixed(1)}%`,
      controller.workoutActive ? 'Seance on' : `${controller.targetMinutes} min`,
    ];
  }

  return device.metrics;
}

function resolveCompanionDeviceDataPoints(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
  companionStatus: GarminConnectIqBridgeStatus,
  companionMetrics: GarminMetricSampleMap,
): DeviceDataPoint[] {
  const lastJob = syncJobs[0];
  const companionHealthLabel = formatBridgeHealthLabel(companionStatus.health);
  const fenixBridgeState = getCompanionDeviceLinkState(companionStatus, 'fenix');
  const edgeBridgeState = getCompanionDeviceLinkState(companionStatus, 'edge');
  const heartRate = getGarminMetricNumber(companionMetrics, 'heart_rate_bpm');
  const stressScore = getGarminMetricNumber(companionMetrics, 'stress_score');
  const respirationRate = getGarminMetricNumber(companionMetrics, 'respiration_rate_bpm');
  const spo2Percent = getGarminMetricNumber(companionMetrics, 'spo2_percent');
  const steps = getGarminMetricNumber(companionMetrics, 'steps');
  const recoveryHours = getGarminMetricNumber(companionMetrics, 'time_to_recovery_h');
  const bodyBatteryPercent = getGarminMetricNumber(companionMetrics, 'body_battery_percent');
  const fenixLinked = fenixBridgeState.connected;
  const cardioValue = joinFragments([
    heartRate !== null ? `FC ${heartRate.toFixed(0)} bpm` : null,
    stressScore !== null ? `stress ${stressScore.toFixed(0)}` : null,
  ]);
  const recoveryValue = joinFragments([
    recoveryHours !== null ? `Recup ${recoveryHours.toFixed(0)} h` : null,
    bodyBatteryPercent !== null ? `Body Battery ${bodyBatteryPercent.toFixed(0)}%` : null,
  ]);
  const dailyValue = joinFragments([
    steps !== null ? `${steps.toFixed(0)} pas` : null,
    respirationRate !== null ? `Resp ${respirationRate.toFixed(0)} rpm` : null,
    spo2Percent !== null ? `SpO2 ${spo2Percent.toFixed(0)}%` : null,
  ]);
  const appVersion = isConfirmedCompanionField(companionStatus.deviceHello?.appVersion)
    ? companionStatus.deviceHello?.appVersion
    : null;
  const firmwareVersion = isConfirmedCompanionField(companionStatus.deviceHello?.firmwareVersion)
    ? companionStatus.deviceHello?.firmwareVersion
    : null;
  const healthValue = joinFragments([
    fenixLinked ? 'Liaison Connect IQ active' : null,
    appVersion ? `app ${appVersion}` : null,
    firmwareVersion ? `firmware ${firmwareVersion}` : null,
    companionStatus.lastBatchId ? `lot ${companionStatus.lastBatchId}` : null,
    companionStatus.pendingBatchCount > 0 ? `buffer ${companionStatus.pendingBatchCount}` : null,
  ]);

  return device.dataPoints.map((point) => {
    if (device.id === 'phone') {
      switch (point.id) {
        case 'mobile-session':
          return {
            ...point,
            value: `Session active · ${syncJobs.length} jobs visibles · ${companionStatus.pendingBatchCount} lot(s) Connect IQ`,
            state: 'received',
          };
        case 'ble-bridge':
          return {
            ...point,
            value: `${companionHealthLabel} · ${companionStatus.deviceHello?.deviceModel ?? 'fenix en attente'} · ${companionStatus.capabilities?.supportedMetrics.length ?? 0} metriques`,
            state: 'received',
          };
        case 'local-diagnostics':
          return {
            ...point,
            value: companionStatus.lastDiagnostic
              ? `${companionStatus.lastDiagnostic.code} · ${companionStatus.lastDiagnostic.message}`
              : lastJob
                ? `Dernier job ${lastJob.title.toLowerCase()} · ${lastJob.status}`
                : 'Aucun job de synchro disponible',
            state: 'received',
          };
        case 'carbon-master':
          return controller.connected
            ? {
                ...point,
                value: controller.workoutActive
                  ? 'nouvelleApp pilote une seance locale en cours'
                  : 'nouvelleApp tient la main locale sur le tapis',
                state: 'received',
              }
            : point;
        default:
          return point;
      }
    }

    if (device.id === 'fenix-7-pro') {
      switch (point.id) {
        case 'heart-rate':
          return {
            ...point,
            value:
              fenixLinked && cardioValue
                ? cardioValue
                : fenixLinked
                  ? 'Aucune mesure cardio recue pour l instant'
                  : point.value,
            state: fenixLinked && cardioValue ? 'received' : 'pending',
          };
        case 'recovery':
          return {
            ...point,
            value:
              fenixLinked && recoveryValue
                ? recoveryValue
                : fenixLinked
                  ? 'Recuperation et indicateurs de fatigue en attente'
                  : point.value,
            state: fenixLinked && recoveryValue ? 'received' : 'pending',
          };
        case 'daily-sync':
          return {
            ...point,
            value:
              fenixLinked && dailyValue
                ? dailyValue
                : fenixLinked
                  ? 'Historique quotidien en attente du premier lot'
                  : point.value,
            state: fenixLinked && dailyValue ? 'received' : 'pending',
          };
        case 'device-health':
          return {
            ...point,
            value:
              (fenixLinked ? healthValue : null) ??
              companionStatus.lastDiagnostic?.message ??
              (fenixLinked ? 'Liaison detectee, aucune mesure exploitable recue' : point.value),
            state: fenixLinked ? 'received' : 'pending',
          };
        default:
          return {
            ...point,
            state: fenixLinked && hasAnyGarminMetric(companionMetrics) ? 'received' : 'pending',
          };
      }
    }

    if (device.id === 'edge-1030') {
      const edgeConnected = edgeBridgeState.connected;

      switch (point.id) {
        case 'bike-activity':
          return {
            ...point,
            value: edgeConnected
              ? 'Le contrat batch et snapshot Connect IQ est pret a etre porte sur le Edge'
              : point.value,
            state: edgeConnected ? 'received' : point.state,
          };
        case 'trainer-bridge':
          return {
            ...point,
            value: edgeConnected
              ? 'Le companion mobile reuse deja le meme schema ACK pour le velo'
              : point.value,
            state: edgeConnected ? 'received' : point.state,
          };
        case 'route-path':
          return {
            ...point,
            value: edgeConnected ? 'Parcours et traces rehydrates dans le mobile' : point.value,
            state: edgeConnected ? 'received' : point.state,
          };
        case 'sensor-map':
          return {
            ...point,
            value: edgeConnected ? 'Capteurs velo relies et exposes dans le bridge' : point.value,
            state: edgeConnected ? 'received' : point.state,
          };
        default:
          return point;
      }
    }

    if (device.id === 'carbon-tls') {
      switch (point.id) {
        case 'treadmill-speed':
          return controller.connected
            ? {
                ...point,
                value: `${controller.speedKph.toFixed(1)} km/h recupere et pilotable`,
                state: 'received',
              }
            : point;
        case 'treadmill-incline':
          return controller.connected
            ? {
                ...point,
                value: `${controller.inclinePct.toFixed(1)}% recupere et pilotable`,
                state: 'received',
              }
            : point;
        case 'workout-state':
          return controller.connected
            ? {
                ...point,
                value: controller.workoutActive
                  ? `Seance en cours · cible ${controller.targetMinutes} min`
                  : 'Bridge local actif, pret a demarrer',
                state: 'received',
              }
            : point;
        case 'safety-state':
          return controller.connected
            ? {
                ...point,
                value: 'Etat machine visible, arret urgence non remonte',
                state: 'received',
              }
            : point;
        default:
          return point;
      }
    }

    return point;
  });
}

function resolveCompanionDeviceMetrics(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
  companionStatus: GarminConnectIqBridgeStatus,
  companionMetrics: GarminMetricSampleMap,
) {
  if (device.id === 'phone') {
    return [
      `${syncJobs.length} jobs`,
      `CIQ ${formatBridgeHealthLabel(companionStatus.health)}`,
      controller.connected ? 'Carbon maitre' : 'Carbon attente',
    ];
  }

  if (device.id === 'fenix-7-pro') {
    const fenixLinked = getCompanionDeviceLinkState(companionStatus, 'fenix').connected;
    const heartRate = getGarminMetricNumber(companionMetrics, 'heart_rate_bpm');
    const steps = getGarminMetricNumber(companionMetrics, 'steps');
    const recoveryHours = getGarminMetricNumber(companionMetrics, 'time_to_recovery_h');
    const metricChips = [
      heartRate !== null ? `FC ${heartRate.toFixed(0)} bpm` : null,
      steps !== null ? `${steps.toFixed(0)} pas` : null,
      recoveryHours !== null ? `Recup ${recoveryHours.toFixed(0)} h` : null,
    ].filter((item): item is string => Boolean(item));

    if (fenixLinked && metricChips.length > 0) {
      return metricChips;
    }

    return [
      companionStatus.deviceHello?.deviceModel ?? 'fenix en attente',
      `CIQ ${formatBridgeHealthLabel(companionStatus.health)}`,
      fenixLinked && companionStatus.lastBatchId ? 'Lot recu' : 'Aucune mesure',
    ];
  }

  return resolveDeviceMetrics(device, controller, syncJobs);
}

function resolveDualCompanionDeviceDataPoints(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
  activeCompanionStatus: GarminConnectIqBridgeStatus,
  fenixStatus: GarminConnectIqBridgeStatus,
  fenixMetrics: GarminMetricSampleMap,
  edgeStatus: GarminConnectIqBridgeStatus,
  edgeMetrics: GarminMetricSampleMap,
): DeviceDataPoint[] {
  const lastJob = syncJobs[0];
  const companionHealthLabel = formatBridgeHealthLabel(activeCompanionStatus.health);
  const fenixBridgeState = getCompanionDeviceLinkState(fenixStatus, 'fenix');
  const edgeBridgeState = getCompanionDeviceLinkState(edgeStatus, 'edge');
  const heartRate = getGarminMetricNumber(fenixMetrics, 'heart_rate_bpm');
  const stressScore = getGarminMetricNumber(fenixMetrics, 'stress_score');
  const respirationRate = getGarminMetricNumber(fenixMetrics, 'respiration_rate_bpm');
  const spo2Percent = getGarminMetricNumber(fenixMetrics, 'spo2_percent');
  const steps = getGarminMetricNumber(fenixMetrics, 'steps');
  const recoveryHours = getGarminMetricNumber(fenixMetrics, 'time_to_recovery_h');
  const bodyBatteryPercent = getGarminMetricNumber(fenixMetrics, 'body_battery_percent');
  const fenixLinked = fenixBridgeState.connected;
  const edgeLinked = edgeBridgeState.connected;
  const edgeHeartRate = getGarminMetricNumber(edgeMetrics, 'heart_rate_bpm');
  const edgeElapsedTime = getGarminMetricNumber(edgeMetrics, 'activity_elapsed_time_s');
  const edgeDistance = getGarminMetricNumber(edgeMetrics, 'activity_elapsed_distance_m');
  const edgeSpeed = getGarminMetricNumber(edgeMetrics, 'activity_current_speed_mps');
  const edgeCadence = getGarminMetricNumber(edgeMetrics, 'activity_current_cadence_rpm');
  const cardioValue = joinFragments([
    heartRate !== null ? `FC ${heartRate.toFixed(0)} bpm` : null,
    stressScore !== null ? `stress ${stressScore.toFixed(0)}` : null,
  ]);
  const recoveryValue = joinFragments([
    recoveryHours !== null ? `Recup ${recoveryHours.toFixed(0)} h` : null,
    bodyBatteryPercent !== null ? `Body Battery ${bodyBatteryPercent.toFixed(0)}%` : null,
  ]);
  const dailyValue = joinFragments([
    steps !== null ? `${steps.toFixed(0)} pas` : null,
    respirationRate !== null ? `Resp ${respirationRate.toFixed(0)} rpm` : null,
    spo2Percent !== null ? `SpO2 ${spo2Percent.toFixed(0)}%` : null,
  ]);
  const appVersion = isConfirmedCompanionField(fenixStatus.deviceHello?.appVersion)
    ? fenixStatus.deviceHello?.appVersion
    : null;
  const firmwareVersion = isConfirmedCompanionField(fenixStatus.deviceHello?.firmwareVersion)
    ? fenixStatus.deviceHello?.firmwareVersion
    : null;
  const fenixHealthValue = joinFragments([
    fenixLinked ? 'Liaison Connect IQ active' : null,
    appVersion ? `app ${appVersion}` : null,
    firmwareVersion ? `firmware ${firmwareVersion}` : null,
    fenixStatus.lastBatchId ? `lot ${fenixStatus.lastBatchId}` : null,
    fenixStatus.pendingBatchCount > 0 ? `buffer ${fenixStatus.pendingBatchCount}` : null,
  ]);
  const edgeActivityValue = joinFragments([
    edgeHeartRate !== null ? `FC ${edgeHeartRate.toFixed(0)} bpm` : null,
    edgeElapsedTime !== null ? `${edgeElapsedTime.toFixed(0)} s` : null,
    edgeDistance !== null ? `${edgeDistance.toFixed(0)} m` : null,
  ]);
  const edgeTrainerValue = joinFragments([
    edgeSpeed !== null ? `${edgeSpeed.toFixed(1)} m/s` : null,
    edgeCadence !== null ? `${edgeCadence.toFixed(0)} rpm` : null,
  ]);
  const edgeHealthValue = joinFragments([
    edgeLinked ? 'Bridge Connect IQ Edge actif' : null,
    edgeStatus.deviceHello?.appVersion ? `app ${edgeStatus.deviceHello.appVersion}` : null,
    edgeStatus.lastBatchId ? `lot ${edgeStatus.lastBatchId}` : null,
    edgeStatus.pendingBatchCount > 0 ? `buffer ${edgeStatus.pendingBatchCount}` : null,
  ]);

  if (device.id === 'carbon-tls') {
    return resolveCompanionDeviceDataPoints(
      device,
      controller,
      syncJobs,
      activeCompanionStatus,
      activeCompanionStatus.deviceHello?.deviceKind === 'edge' ? edgeMetrics : fenixMetrics,
    );
  }

  return device.dataPoints.map((point) => {
    if (device.id === 'phone') {
      switch (point.id) {
        case 'mobile-session':
          return {
            ...point,
            value: `Session active · ${syncJobs.length} jobs visibles · ${fenixStatus.pendingBatchCount + edgeStatus.pendingBatchCount} lot(s) Connect IQ`,
            state: 'received',
          };
        case 'ble-bridge':
          return {
            ...point,
            value: `${companionHealthLabel} · actif ${getCompanionKindLabel(activeCompanionStatus.deviceHello?.deviceKind ?? 'fenix')} · ${activeCompanionStatus.capabilities?.supportedMetrics.length ?? 0} metriques`,
            state: 'received',
          };
        case 'local-diagnostics':
          return {
            ...point,
            value: activeCompanionStatus.lastDiagnostic
              ? `${activeCompanionStatus.lastDiagnostic.code} · ${activeCompanionStatus.lastDiagnostic.message}`
              : lastJob
                ? `Dernier job ${lastJob.title.toLowerCase()} · ${lastJob.status}`
                : 'Aucun job de synchro disponible',
            state: 'received',
          };
        case 'carbon-master':
          return controller.connected
            ? {
                ...point,
                value: controller.workoutActive
                  ? 'nouvelleApp pilote une seance locale en cours'
                  : 'nouvelleApp tient la main locale sur le tapis',
                state: 'received',
              }
            : point;
        default:
          return point;
      }
    }

    if (device.id === 'fenix-7-pro') {
      switch (point.id) {
        case 'heart-rate':
          return {
            ...point,
            value:
              fenixLinked && cardioValue
                ? cardioValue
                : fenixLinked
                  ? 'Aucune mesure cardio recue pour l instant'
                  : point.value,
            state: fenixLinked && cardioValue ? 'received' : 'pending',
          };
        case 'recovery':
          return {
            ...point,
            value:
              fenixLinked && recoveryValue
                ? recoveryValue
                : fenixLinked
                  ? 'Recuperation et indicateurs de fatigue en attente'
                  : point.value,
            state: fenixLinked && recoveryValue ? 'received' : 'pending',
          };
        case 'daily-sync':
          return {
            ...point,
            value:
              fenixLinked && dailyValue
                ? dailyValue
                : fenixLinked
                  ? 'Historique quotidien en attente du premier lot'
                  : point.value,
            state: fenixLinked && dailyValue ? 'received' : 'pending',
          };
        case 'device-health':
          return {
            ...point,
            value:
              (fenixLinked ? fenixHealthValue : null) ??
              fenixStatus.lastDiagnostic?.message ??
              (fenixLinked ? 'Liaison detectee, aucune mesure exploitable recue' : point.value),
            state: fenixLinked ? 'received' : 'pending',
          };
        default:
          return {
            ...point,
            state: fenixLinked && hasAnyGarminMetric(fenixMetrics) ? 'received' : 'pending',
          };
      }
    }

    if (device.id === 'edge-1030') {
      switch (point.id) {
        case 'bike-activity':
          return {
            ...point,
            value: edgeLinked
              ? edgeActivityValue ?? 'Premier resume d activite Edge recu'
              : point.value,
            state: edgeLinked ? 'received' : point.state,
          };
        case 'trainer-bridge':
          return {
            ...point,
            value: edgeLinked
              ? edgeTrainerValue ?? 'Le companion mobile reuse deja le meme schema ACK pour le velo'
              : point.value,
            state: edgeLinked ? 'received' : point.state,
          };
        case 'route-path':
          return {
            ...point,
            value: edgeLinked
              ? `Dernier lot ${edgeStatus.lastBatchId ?? 'edge'} recu et pret a hydrater`
              : point.value,
            state: edgeLinked ? 'received' : point.state,
          };
        case 'sensor-map':
          return {
            ...point,
            value:
              (edgeLinked ? edgeHealthValue : null) ??
              edgeStatus.lastDiagnostic?.message ??
              point.value,
            state: edgeLinked ? 'received' : point.state,
          };
        default:
          return point;
      }
    }

    return point;
  });
}

function resolveDualCompanionDeviceMetrics(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
  activeCompanionStatus: GarminConnectIqBridgeStatus,
  fenixStatus: GarminConnectIqBridgeStatus,
  fenixMetrics: GarminMetricSampleMap,
  edgeStatus: GarminConnectIqBridgeStatus,
  edgeMetrics: GarminMetricSampleMap,
) {
  if (device.id === 'phone') {
    return [
      `${syncJobs.length} jobs`,
      `CIQ ${formatBridgeHealthLabel(activeCompanionStatus.health)}`,
      controller.connected ? 'Carbon maitre' : 'Carbon attente',
    ];
  }

  if (device.id === 'fenix-7-pro') {
    const fenixLinked = getCompanionDeviceLinkState(fenixStatus, 'fenix').connected;
    const heartRate = getGarminMetricNumber(fenixMetrics, 'heart_rate_bpm');
    const steps = getGarminMetricNumber(fenixMetrics, 'steps');
    const recoveryHours = getGarminMetricNumber(fenixMetrics, 'time_to_recovery_h');
    const metricChips = [
      heartRate !== null ? `FC ${heartRate.toFixed(0)} bpm` : null,
      steps !== null ? `${steps.toFixed(0)} pas` : null,
      recoveryHours !== null ? `Recup ${recoveryHours.toFixed(0)} h` : null,
    ].filter((item): item is string => Boolean(item));

    if (fenixLinked && metricChips.length > 0) {
      return metricChips;
    }

    return [
      fenixStatus.deviceHello?.deviceModel ?? 'fenix en attente',
      `CIQ ${formatBridgeHealthLabel(fenixStatus.health)}`,
      fenixLinked && fenixStatus.lastBatchId ? 'Lot recu' : 'Aucune mesure',
    ];
  }

  if (device.id === 'edge-1030') {
    const edgeLinked = getCompanionDeviceLinkState(edgeStatus, 'edge').connected;
    const edgeElapsedTime = getGarminMetricNumber(edgeMetrics, 'activity_elapsed_time_s');
    const edgeDistance = getGarminMetricNumber(edgeMetrics, 'activity_elapsed_distance_m');
    const edgeCadence = getGarminMetricNumber(edgeMetrics, 'activity_current_cadence_rpm');
    const metricChips = [
      edgeElapsedTime !== null ? `${edgeElapsedTime.toFixed(0)} s` : null,
      edgeDistance !== null ? `${edgeDistance.toFixed(0)} m` : null,
      edgeCadence !== null ? `${edgeCadence.toFixed(0)} rpm` : null,
    ].filter((item): item is string => Boolean(item));

    if (edgeLinked && metricChips.length > 0) {
      return metricChips;
    }

    return [
      edgeStatus.deviceHello?.deviceModel ?? 'Edge en attente',
      `CIQ ${formatBridgeHealthLabel(edgeStatus.health)}`,
      edgeLinked && edgeStatus.lastBatchId ? 'Lot recu' : 'Aucune mesure',
    ];
  }

  return resolveDeviceMetrics(device, controller, syncJobs);
}

function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === 'primary'
          ? styles.buttonPrimary
          : variant === 'ghost'
            ? styles.buttonGhost
            : styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'deep' | 'warm' | 'mint' | 'paper';
}) {
  return (
    <View
      style={[
        styles.statCard,
        tone === 'deep'
          ? styles.statCardDeep
          : tone === 'warm'
            ? styles.statCardWarm
            : tone === 'mint'
              ? styles.statCardMint
              : styles.statCardPaper,
      ]}
    >
      <Text style={[styles.statLabel, tone === 'deep' ? styles.statLabelInverse : null]}>
        {label}
      </Text>
      <Text style={[styles.statValue, tone === 'deep' ? styles.statValueInverse : null]}>
        {value}
      </Text>
    </View>
  );
}

export default function App() {
  const [email, setEmail] = useState('louis@nouvelle.app');
  const [password, setPassword] = useState('carbontls');
  const [loginError, setLoginError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountName, setAccountName] = useState('Louis');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [sessions, setSessions] = useState<TimelineSession[]>(initialSessions);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>(initialSyncJobs);
  const [controller, setController] = useState<CarbonController>(initialController);
  const [activeCompanionKind, setActiveCompanionKind] = useState<CompanionDeviceKind>('fenix');
  const [fenixBridge] = useState(() =>
    createGarminConnectIqBridge({
      appId: GARMIN_CONNECT_IQ_WATCH_APP_ID,
      preferredDeviceName: 'fenix',
      preferredDeviceKind: 'fenix',
    }),
  );
  const [edgeBridge] = useState(() =>
    createGarminConnectIqBridge({
      appId: GARMIN_CONNECT_IQ_EDGE_APP_ID,
      preferredDeviceName: 'edge',
      preferredDeviceKind: 'edge',
    }),
  );
  const [fenixStatus, setFenixStatus] = useState<GarminConnectIqBridgeStatus>(() =>
    createGarminConnectIqBridgeStatus(),
  );
  const [edgeStatus, setEdgeStatus] = useState<GarminConnectIqBridgeStatus>(() =>
    createGarminConnectIqBridgeStatus(),
  );
  const [lastFenixBatch, setLastFenixBatch] = useState<GarminConnectIqBatchEnvelope | null>(
    null,
  );
  const [lastEdgeBatch, setLastEdgeBatch] = useState<GarminConnectIqBatchEnvelope | null>(null);
  const [fenixMetrics, setFenixMetrics] = useState<GarminMetricSampleMap>({});
  const [edgeMetrics, setEdgeMetrics] = useState<GarminMetricSampleMap>({});
  const [notice, setNotice] = useState(
    'Companion Android local actif. Les valeurs Garmin ne s affichent qu apres reception de mesures reelles.',
  );
  const activeBridge = activeCompanionKind === 'fenix' ? fenixBridge : edgeBridge;
  const activeCompanionStatus = activeCompanionKind === 'fenix' ? fenixStatus : edgeStatus;
  const activeGarminMetrics = activeCompanionKind === 'fenix' ? fenixMetrics : edgeMetrics;
  const activeGarminBatch = activeCompanionKind === 'fenix' ? lastFenixBatch : lastEdgeBatch;
  const companionHighlights = buildCompanionHighlights(activeCompanionStatus, activeGarminMetrics);

  useEffect(() => {
    let active = true;
    const applyBridgeStatus = (
      kind: CompanionDeviceKind,
      status: GarminConnectIqBridgeStatus,
    ) => {
      if (kind === 'fenix') {
        setFenixStatus(status);
      } else {
        setEdgeStatus(status);
      }

      if (!status.lastBatch) {
        return;
      }

      const restoredBatch = status.lastBatch;

      if (kind === 'fenix') {
        setLastFenixBatch((currentBatch) =>
          currentBatch?.batchId === restoredBatch.batchId ? currentBatch : restoredBatch,
        );
        setFenixMetrics((currentMetrics) => ({
          ...currentMetrics,
          ...extractGarminSamples(restoredBatch),
        }));
        return;
      }

      setLastEdgeBatch((currentBatch) =>
        currentBatch?.batchId === restoredBatch.batchId ? currentBatch : restoredBatch,
      );
      setEdgeMetrics((currentMetrics) => ({
        ...currentMetrics,
        ...extractGarminSamples(restoredBatch),
      }));
    };

    void activeBridge.connect({
      onStatusChanged: (status) => {
        if (active) {
          applyBridgeStatus(activeCompanionKind, status);
        }
      },
      onBatchReceived: (batch) => {
        if (!active) {
          return;
        }

        if (activeCompanionKind === 'fenix') {
          setLastFenixBatch(batch);
          setFenixMetrics((currentMetrics) => ({
            ...currentMetrics,
            ...extractGarminSamples(batch),
          }));
        } else {
          setLastEdgeBatch(batch);
          setEdgeMetrics((currentMetrics) => ({
            ...currentMetrics,
            ...extractGarminSamples(batch),
          }));
        }

        setNotice(
          `Lot Connect IQ ${batch.batchId} recu depuis ${getCompanionKindLabel(activeCompanionKind)}.`,
        );
      },
      onDiagnostic: (diagnostic) => {
        if (active) {
          setNotice(`Diagnostic Connect IQ: ${diagnostic.message}`);
        }
      },
    });

    return () => {
      active = false;
      void activeBridge.disconnect();
    };
  }, [activeBridge, activeCompanionKind]);

  useEffect(() => {
    const bridgeNow = formatNow();

    setDevices((currentDevices) =>
      currentDevices.map((device) => {
        if (device.id === 'fenix-7-pro') {
          return {
            ...device,
            ...resolveCompanionDevicePresentation(fenixStatus, 'fenix', bridgeNow),
          };
        }

        if (device.id === 'edge-1030') {
          return {
            ...device,
            ...resolveCompanionDevicePresentation(edgeStatus, 'edge', bridgeNow),
          };
        }

        return device;
      }),
    );
  }, [edgeStatus, fenixStatus]);

  const diagnostics = buildDiagnostics(devices, controller, syncJobs);
  const connectedDevices = devices.filter((device) => device.status === 'connected').length;
  const alertCount = diagnostics.filter((item) => item.severity === 'high').length;
  const latestSync = syncJobs[0]?.finishedAt ?? 'Jamais';

  const updateDevice = (deviceId: string, updater: (device: Device) => Device) => {
    setDevices((currentDevices) =>
      currentDevices.map((device) => (device.id === deviceId ? updater(device) : device)),
    );
  };

  const prependSyncJob = (job: SyncJob) => {
    setSyncJobs((currentJobs) => [job, ...currentJobs.slice(0, 5)]);
  };

  const requestGarminSync = (message: string) => {
    void activeBridge.requestSyncNow();
    setNotice(message);
  };

  const handleLogin = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@') || trimmedPassword.length < 4) {
      setLoginError('Saisis un email valide et un mot de passe de 4 caracteres minimum.');
      return;
    }

    setLoginError('');
    setAccountName(trimmedEmail.split('@')[0] || 'Utilisateur');
    setLoggedIn(true);
    setActiveTab('devices');
    setNotice(
      'Session locale ouverte. Le companion Connect IQ publie maintenant des lots visibles dans Appareils.',
    );
  };

  const connectFenix = () => {
    const switchingBridge = activeCompanionKind !== 'fenix';
    setActiveCompanionKind('fenix');
    prependSyncJob(
      buildSyncJob(
        'Verification fenix 7 Pro',
        'pending',
        'La fenix ne sera marquee connectee qu apres confirmation reelle du bridge Connect IQ.',
      ),
    );
    if (switchingBridge) {
      setNotice('Bridge fenix active. La prochaine sync Connect IQ ciblera la montre.');
      return;
    }

    requestGarminSync(
      'Verification de la fenix demandee. Le statut Connecte apparaitra uniquement apres une liaison reelle.',
    );
  };

  const connectEdge = () => {
    const switchingBridge = activeCompanionKind !== 'edge';
    setActiveCompanionKind('edge');
    updateDevice('edge-1030', (device) => ({
      ...device,
      status: device.status === 'connected' ? 'connected' : 'ready',
      lastSeen: device.status === 'connected' ? formatNow() : 'Jamais',
      note:
        'Verification Edge demandee. Le compteur ne passe a Connecte qu apres une liaison mobile reelle.',
    }));
    prependSyncJob(
      buildSyncJob(
        'Verification Edge 1030',
        'pending',
        'Aucune connexion Edge n est consideree active tant qu un bridge reel ne l a pas confirmee.',
      ),
    );
    if (switchingBridge) {
      setNotice('Bridge Edge active. La prochaine sync Connect IQ ciblera le compteur.');
      return;
    }

    requestGarminSync(
      'Verification Edge 1030 demandee. Le statut Connecte ne sera affiche qu apres une liaison reelle.',
    );
  };

  const syncFenixNow = () => {
    if (activeCompanionKind !== 'fenix') {
      setActiveCompanionKind('fenix');
      setNotice('Bridge fenix active. Lance la sync une fois la montre selectionnee.');
      return;
    }

    requestGarminSync('Un nouveau lot Connect IQ vient d etre demande a la fenix.');
  };

  const syncEdgeNow = () => {
    if (activeCompanionKind !== 'edge') {
      setActiveCompanionKind('edge');
      setNotice('Bridge Edge active. Lance la sync une fois le compteur selectionne.');
      return;
    }

    requestGarminSync('Un lot Connect IQ edge-compatible vient d etre demande.');
  };

  const activateCarbonControl = () => {
    setController((currentController) => ({
      ...currentController,
      connected: true,
    }));
    updateDevice('carbon-tls', (device) => ({
      ...device,
      status: 'connected',
      lastSeen: formatNow(),
      note: 'Pilotage direct du tapis active depuis le telephone.',
    }));
    prependSyncJob(
      buildSyncJob(
        'Bridge Carbon TLS',
        'success',
        'Le tapis peut maintenant etre pilote directement depuis nouvelleApp.',
      ),
    );
    setNotice('Controle local du Carbon TLS active.');
  };

  const setTab = (tab: DashboardTab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  const relaunchSync = () => {
    const hasAttentionDevice = devices.some((device) => device.status === 'attention');
    const now = formatNow();

    setDevices((currentDevices) =>
      currentDevices.map((device) =>
        device.status === 'connected' ? { ...device, lastSeen: now } : device,
      ),
    );
    prependSyncJob(
      buildSyncJob(
        'Relance manuelle',
        hasAttentionDevice ? 'partial' : 'success',
        hasAttentionDevice
          ? 'Tous les connecteurs actifs ont ete rafraichis, sauf les bridges encore incomplets.'
          : 'Tous les connecteurs actifs ont ete rafraichis avec succes.',
      ),
    );
    requestGarminSync('Une nouvelle synchronisation locale et Connect IQ vient d etre lancee.');
  };

  const adjustController = (field: 'speedKph' | 'inclinePct', delta: number) => {
    if (!controller.connected) {
      setNotice('Active d abord le bridge direct du Carbon TLS pour ajuster le tapis.');
      return;
    }

    setController((currentController) => {
      const nextValue =
        field === 'speedKph'
          ? Math.min(18, Math.max(4, currentController.speedKph + delta))
          : Math.min(12, Math.max(0, currentController.inclinePct + delta));

      return {
        ...currentController,
        [field]: Number(nextValue.toFixed(1)),
      };
    });
  };

  const handleCarbonPrimary = () => {
    if (!controller.connected) {
      activateCarbonControl();
      return;
    }

    if (!controller.workoutActive) {
      setController((currentController) => ({
        ...currentController,
        workoutActive: true,
      }));
      prependSyncJob(
        buildSyncJob(
          'Seance Carbon TLS',
          'success',
          'Une seance locale vient d etre demarree depuis le mobile.',
        ),
      );
      setNotice('Seance Carbon TLS demarree. Les commandes vitesse et incline sont actives.');
      return;
    }

    setController((currentController) => ({
      ...currentController,
      workoutActive: false,
    }));
    prependSyncJob(
      buildSyncJob(
        'Fin de seance Carbon TLS',
        'success',
        'La seance locale a ete cloturee et ajoutee a la timeline.',
      ),
    );
    setSessions((currentSessions) => [
      {
        id: `session-${Date.now()}`,
        title: 'Seance Carbon TLS pilotee depuis le mobile',
        sport: 'Treadmill',
        time: formatNow(),
        duration: `${controller.targetMinutes} min`,
        primaryDevice: 'Carbon TLS',
        summary: `${controller.speedKph.toFixed(1)} km/h moyen, ${controller.inclinePct.toFixed(1)}% incline cible`,
        sources: ['nouvelleApp', 'Carbon TLS', 'fenix 7 Pro'],
      },
      ...currentSessions,
    ]);
    setNotice('Seance Carbon TLS terminee. La timeline a ete mise a jour.');
  };

  const renderOverview = () => (
    <>
      <View style={styles.statGrid}>
        <StatCard label="Devices relies" value={`${connectedDevices}/4`} tone="deep" />
        <StatCard label="Derniere sync" value={latestSync} tone="mint" />
        <StatCard label="Sessions visibles" value={`${sessions.length}`} tone="paper" />
        <StatCard label="Alertes hautes" value={`${alertCount}`} tone="warm" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelEyebrow}>Architecture active</Text>
        <Text style={styles.panelTitle}>MVP mobile oriente Connect IQ + Carbon TLS local</Text>
        {overviewBullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelEyebrow}>Companion mobile</Text>
            <Text style={styles.panelTitle}>Connect IQ Bridge</Text>
          </View>
          <View style={[styles.badgeBase, getBridgeTone(activeCompanionStatus.health)]}>
            <Text style={styles.badgeText}>{formatBridgeHealthLabel(activeCompanionStatus.health)}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <Text style={styles.metaLabel}>Bridge actif</Text>
          <Text style={styles.metaValue}>{getCompanionKindLabel(activeCompanionKind)}</Text>
          <Text style={styles.metaLabel}>Appareil</Text>
          <Text style={styles.metaValue}>
            {activeCompanionStatus.deviceHello?.deviceModel ??
              `${getCompanionKindLabel(activeCompanionKind)} en attente`}
          </Text>
          <Text style={styles.metaLabel}>Protocole</Text>
          <Text style={styles.metaValue}>
            v1 · {Object.keys(GARMIN_CONNECT_IQ_METRIC_DEFINITIONS).length} metriques
          </Text>
          <Text style={styles.metaLabel}>Dernier lot</Text>
          <Text style={styles.metaValue}>
            {activeGarminBatch?.batchId ?? activeCompanionStatus.lastBatchId ?? 'Aucun lot'}
          </Text>
          <Text style={styles.metaLabel}>Tampon</Text>
          <Text style={styles.metaValue}>{activeCompanionStatus.pendingBatchCount} lot(s) en attente</Text>
        </View>

        <View style={styles.chipRow}>
          {companionHighlights.map((item) => (
            <View key={item} style={styles.metricChip}>
              <Text style={styles.metricChipText}>{item}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.deviceNote}>
          {activeCompanionStatus.lastDiagnostic
            ? activeCompanionStatus.lastDiagnostic.message
            : isBridgeReallyConnected(activeCompanionStatus) && activeCompanionStatus.lastBatchId
              ? 'Le companion recoit des lots Connect IQ reels et les acquitte automatiquement.'
              : `Le companion attend encore un premier lot reel provenant de ${getCompanionKindLabel(activeCompanionKind)}.`}
        </Text>

        <View style={styles.inlineActions}>
          <ActionButton label="Bridge fenix" onPress={connectFenix} />
          <ActionButton label="Bridge Edge" onPress={connectEdge} />
          <ActionButton
            label="Sync Connect IQ"
            onPress={activeCompanionKind === 'edge' ? syncEdgeNow : syncFenixNow}
            variant="primary"
          />
          <ActionButton label="Voir appareils" onPress={() => setTab('devices')} />
        </View>
      </View>

      <View style={[styles.panel, styles.controllerPanel]}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelEyebrow}>Pilotage direct</Text>
            <Text style={styles.panelTitle}>Carbon TLS Controller</Text>
          </View>
          <View style={[styles.badgeBase, getStatusTone(controller.connected ? 'connected' : 'ready')]}>
            <Text style={styles.badgeText}>
              {controller.workoutActive
                ? 'Seance active'
                : controller.connected
                  ? 'Controle actif'
                  : 'Pret a activer'}
            </Text>
          </View>
        </View>

        <View style={styles.controllerMetrics}>
          <View style={styles.controllerMetricCard}>
            <Text style={styles.controllerMetricLabel}>Vitesse</Text>
            <Text style={styles.controllerMetricValue}>{controller.speedKph.toFixed(1)} km/h</Text>
          </View>
          <View style={styles.controllerMetricCard}>
            <Text style={styles.controllerMetricLabel}>Incline</Text>
            <Text style={styles.controllerMetricValue}>{controller.inclinePct.toFixed(1)}%</Text>
          </View>
        </View>

        <View style={styles.inlineActions}>
          <ActionButton label="-0.5 km/h" onPress={() => adjustController('speedKph', -0.5)} />
          <ActionButton label="+0.5 km/h" onPress={() => adjustController('speedKph', 0.5)} />
        </View>

        <View style={styles.inlineActions}>
          <ActionButton label="-0.5%" onPress={() => adjustController('inclinePct', -0.5)} />
          <ActionButton label="+0.5%" onPress={() => adjustController('inclinePct', 0.5)} />
        </View>

        <ActionButton
          label={
            controller.workoutActive
              ? 'Stopper la seance'
              : controller.connected
                ? 'Demarrer la seance'
                : 'Activer le controle local'
          }
          onPress={handleCarbonPrimary}
          variant="primary"
        />
      </View>
    </>
  );

  const renderDevices = () => (
    <View style={styles.sectionStack}>
      {devices.map((device) => {
        const isCarbon = device.id === 'carbon-tls';
        const isEdge = device.id === 'edge-1030';
        const isFenix = device.id === 'fenix-7-pro';
        const resolvedDataPoints = resolveDualCompanionDeviceDataPoints(
          device,
          controller,
          syncJobs,
          activeCompanionStatus,
          fenixStatus,
          fenixMetrics,
          edgeStatus,
          edgeMetrics,
        );
        const resolvedMetrics = resolveDualCompanionDeviceMetrics(
          device,
          controller,
          syncJobs,
          activeCompanionStatus,
          fenixStatus,
          fenixMetrics,
          edgeStatus,
          edgeMetrics,
        );

        return (
          <View key={device.id} style={styles.deviceCard}>
            <View style={styles.deviceHeader}>
              <View style={styles.deviceTitleBlock}>
                <Text style={styles.deviceTitle}>{device.name}</Text>
                <Text style={styles.deviceSubtitle}>
                  {device.role} · {device.transport}
                </Text>
              </View>
              <View style={[styles.badgeBase, getStatusTone(device.status)]}>
                <Text style={styles.badgeText}>{getStatusLabel(device.status)}</Text>
              </View>
            </View>

            <Text style={styles.deviceNote}>{device.note}</Text>

            <View style={styles.metaGrid}>
              <Text style={styles.metaLabel}>Mode</Text>
              <Text style={styles.metaValue}>{device.integration}</Text>
              <Text style={styles.metaLabel}>Derniere vue</Text>
              <Text style={styles.metaValue}>{device.lastSeen}</Text>
            </View>

            <View style={styles.chipRow}>
              {resolvedMetrics.map((metric) => (
                <View key={metric} style={styles.metricChip}>
                  <Text style={styles.metricChipText}>{metric}</Text>
                </View>
              ))}
            </View>

            <View style={styles.dataSection}>
              <View style={styles.dataSectionHeader}>
                <Text style={styles.dataSectionTitle}>Donnees a recuperer</Text>
                <Text style={styles.dataSectionCount}>{resolvedDataPoints.length} flux</Text>
              </View>

              {resolvedDataPoints.map((point) => (
                <View key={point.id} style={styles.dataRow}>
                  <View style={styles.dataTextBlock}>
                    <Text style={styles.dataLabel}>{point.label}</Text>
                    <Text style={styles.dataValue}>{point.value}</Text>
                    <Text style={styles.dataNote}>{point.note}</Text>
                  </View>
                  <View style={[styles.badgeBase, getDataStateTone(point.state)]}>
                    <Text style={styles.badgeText}>{getDataStateLabel(point.state)}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.inlineActions}>
              {isCarbon ? (
                <>
                  <ActionButton
                    label={
                      controller.workoutActive
                        ? 'Stopper la seance'
                        : controller.connected
                          ? 'Demarrer la seance'
                          : 'Activer le controle'
                    }
                    onPress={handleCarbonPrimary}
                    variant="primary"
                  />
                  <ActionButton label="Relancer sync" onPress={relaunchSync} />
                </>
              ) : isEdge ? (
                <>
                  <ActionButton
                    label={device.status === 'connected' ? 'Bridge actif' : 'Verifier Edge'}
                    onPress={connectEdge}
                    variant="primary"
                  />
                  <ActionButton
                    label="Sync CIQ"
                    onPress={syncEdgeNow}
                  />
                </>
              ) : isFenix ? (
                <>
                  <ActionButton
                    label={device.status === 'connected' ? 'Sync fenix' : 'Verifier fenix'}
                    onPress={connectFenix}
                    variant="primary"
                  />
                  <ActionButton
                    label="Sync CIQ"
                    onPress={syncFenixNow}
                  />
                </>
              ) : (
                <>
                  <ActionButton label="Relancer sync" onPress={relaunchSync} variant="primary" />
                  <ActionButton label="Voir la timeline" onPress={() => setTab('timeline')} />
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderTimeline = () => (
    <View style={styles.sectionStack}>
      {sessions.map((session) => (
        <View key={session.id} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitleBlock}>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Text style={styles.sessionSubtitle}>
                {session.sport} · {session.time} · {session.duration}
              </Text>
            </View>
            <View style={[styles.badgeBase, styles.badgeNeutral]}>
              <Text style={styles.badgeText}>{session.primaryDevice}</Text>
            </View>
          </View>

          <Text style={styles.sessionSummary}>{session.summary}</Text>

          <View style={styles.chipRow}>
            {session.sources.map((source) => (
              <View key={source} style={styles.sourceChip}>
                <Text style={styles.sourceChipText}>{source}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  const renderDiagnostics = () => (
    <View style={styles.sectionStack}>
      {diagnostics.map((diagnostic) => (
        <View key={diagnostic.id} style={styles.diagnosticCard}>
          <View style={styles.deviceHeader}>
            <View style={styles.deviceTitleBlock}>
              <Text style={styles.deviceTitle}>{diagnostic.title}</Text>
              <Text style={styles.deviceSubtitle}>{diagnostic.action}</Text>
            </View>
            <View style={[styles.badgeBase, getSeverityTone(diagnostic.severity)]}>
              <Text style={styles.badgeText}>{diagnostic.severity.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.deviceNote}>{diagnostic.detail}</Text>
        </View>
      ))}

      <View style={styles.diagnosticCard}>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceTitleBlock}>
            <Text style={styles.deviceTitle}>Companion Connect IQ</Text>
            <Text style={styles.deviceSubtitle}>
              {activeCompanionStatus.deviceHello?.deviceModel ??
                `${getCompanionKindLabel(activeCompanionKind)} en attente`}
            </Text>
          </View>
          <View style={[styles.badgeBase, getBridgeTone(activeCompanionStatus.health)]}>
            <Text style={styles.badgeText}>{formatBridgeHealthLabel(activeCompanionStatus.health)}</Text>
          </View>
        </View>
        <Text style={styles.deviceNote}>
          {activeCompanionStatus.lastDiagnostic
            ? `${activeCompanionStatus.lastDiagnostic.code} · ${activeCompanionStatus.lastDiagnostic.message}`
            : `Dernier lot ${activeGarminBatch?.batchId ?? activeCompanionStatus.lastBatchId ?? 'aucun'} · ${activeCompanionStatus.pendingBatchCount} lot(s) en attente.`}
        </Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <View>
            <Text style={styles.panelEyebrow}>Operations</Text>
            <Text style={styles.panelTitle}>Derniers jobs de synchro</Text>
          </View>
          <ActionButton label="Relancer" onPress={relaunchSync} variant="ghost" />
        </View>

        {syncJobs.map((job) => (
          <View key={job.id} style={styles.jobRow}>
            <View style={styles.jobTextBlock}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobSubtitle}>
                {job.finishedAt} · {job.detail}
              </Text>
            </View>
            <View style={[styles.badgeBase, getSyncTone(job.status)]}>
              <Text style={styles.badgeText}>{job.status}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const screenContent = !loggedIn ? (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView contentContainerStyle={styles.authScroll}>
        <Text style={styles.authEyebrow}>nouvelleApp mobile</Text>
        <Text style={styles.authTitle}>Connecte le mobile, Garmin et ton Carbon TLS sans iFIT maitre</Text>
        <Text style={styles.authBody}>
          Ce prototype Android valide le parcours de connexion local et le pilotage direct du tapis.
        </Text>

        <View style={styles.authCard}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="nom@domaine.com"
            placeholderTextColor={palette.inkMuted}
            style={styles.input}
            value={email}
          />

          <Text style={styles.inputLabel}>Mot de passe</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="minimum 4 caracteres"
            placeholderTextColor={palette.inkMuted}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

          <ActionButton label="Se connecter" onPress={handleLogin} variant="primary" />
          <Text style={styles.authHint}>
            Les donnees Garmin ne seront affichees qu apres reception d un lot reel depuis la montre.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  ) : (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Session mobile active</Text>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Bonjour {accountName}</Text>
          <Text style={styles.heroSubtitle}>
            {alertCount > 0
              ? 'Il reste un bridge prioritaire a fermer.'
              : controller.workoutActive
                ? 'Le Carbon TLS est en train d executer une seance locale.'
                : 'Le mobile est pret pour une seance Garmin + Carbon TLS.'}
          </Text>
          <Text style={styles.noticeText}>{notice}</Text>

          <View style={styles.heroMetrics}>
            <Text style={styles.heroMetric}>{connectedDevices} devices relies</Text>
            <Text style={styles.heroMetric}>{sessions.length} sessions</Text>
            <Text style={styles.heroMetric}>Derniere sync {latestSync}</Text>
          </View>

          <View style={styles.inlineActions}>
            <ActionButton label="Relancer la sync" onPress={relaunchSync} variant="primary" />
            <ActionButton label="Vue diagnostic" onPress={() => setTab('diagnostics')} />
          </View>
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setTab(tab.key)}
              style={[
                styles.tabButton,
                activeTab === tab.key ? styles.tabButtonActive : styles.tabButtonIdle,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === tab.key ? styles.tabButtonTextActive : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'overview' ? renderOverview() : null}
        {activeTab === 'devices' ? renderDevices() : null}
        {activeTab === 'timeline' ? renderTimeline() : null}
        {activeTab === 'diagnostics' ? renderDiagnostics() : null}
      </ScrollView>
    </SafeAreaView>
  );

  return <SafeAreaProvider>{screenContent}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    rowGap: 18,
  },
  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
    rowGap: 16,
  },
  orbTop: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: palette.goldSoft,
  },
  orbBottom: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: palette.mintSoft,
  },
  eyebrow: {
    color: palette.inkMuted,
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroCard: {
    backgroundColor: palette.deep,
    borderRadius: 28,
    padding: 22,
    rowGap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  heroTitle: {
    color: palette.paper,
    fontSize: 32,
    lineHeight: 36,
    fontFamily: 'serif',
  },
  heroSubtitle: {
    color: palette.paper,
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.92,
  },
  noticeText: {
    color: palette.goldSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  heroMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroMetric: {
    color: palette.paper,
    backgroundColor: palette.deepLifted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tabButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tabButtonActive: {
    backgroundColor: palette.ink,
  },
  tabButtonIdle: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
  },
  tabButtonText: {
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: palette.paper,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    minHeight: 96,
    flexGrow: 1,
    flexBasis: '47%',
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
  },
  statCardDeep: {
    backgroundColor: palette.deep,
  },
  statCardWarm: {
    backgroundColor: palette.goldSoft,
  },
  statCardMint: {
    backgroundColor: palette.mint,
  },
  statCardPaper: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
  },
  statLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statLabelInverse: {
    color: palette.paperMuted,
  },
  statValue: {
    color: palette.ink,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
  },
  statValueInverse: {
    color: palette.paper,
  },
  panel: {
    backgroundColor: palette.paper,
    borderRadius: 26,
    padding: 18,
    rowGap: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  controllerPanel: {
    backgroundColor: palette.paperLifted,
  },
  panelEyebrow: {
    color: palette.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'serif',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 10,
  },
  bulletDot: {
    width: 9,
    height: 9,
    marginTop: 7,
    borderRadius: 999,
    backgroundColor: palette.warm,
  },
  bulletText: {
    flex: 1,
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  controllerMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  controllerMetricCard: {
    flex: 1,
    backgroundColor: palette.background,
    borderRadius: 20,
    padding: 16,
    rowGap: 4,
  },
  controllerMetricLabel: {
    color: palette.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  controllerMetricValue: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: '700',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionStack: {
    rowGap: 14,
  },
  deviceCard: {
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 18,
    rowGap: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  deviceTitleBlock: {
    flex: 1,
    rowGap: 4,
  },
  deviceTitle: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'serif',
  },
  deviceSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  deviceNote: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  metaGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 6,
  },
  metaLabel: {
    width: '34%',
    color: palette.inkMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  metaValue: {
    width: '66%',
    color: palette.ink,
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dataSection: {
    rowGap: 10,
    paddingTop: 2,
  },
  dataSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  dataSectionTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  dataSectionCount: {
    color: palette.inkMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 12,
    padding: 12,
    backgroundColor: palette.background,
    borderRadius: 18,
  },
  dataTextBlock: {
    flex: 1,
    rowGap: 3,
  },
  dataLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  dataValue: {
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
  },
  dataNote: {
    color: palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  metricChip: {
    backgroundColor: palette.background,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metricChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '600',
  },
  sourceChip: {
    backgroundColor: palette.deep,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sourceChipText: {
    color: palette.paper,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: palette.paperLifted,
    borderRadius: 24,
    padding: 18,
    rowGap: 14,
    borderWidth: 1,
    borderColor: palette.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 12,
  },
  sessionTitleBlock: {
    flex: 1,
    rowGap: 4,
  },
  sessionTitle: {
    color: palette.ink,
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'serif',
  },
  sessionSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
  },
  sessionSummary: {
    color: palette.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  diagnosticCard: {
    backgroundColor: palette.paper,
    borderRadius: 24,
    padding: 18,
    rowGap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: 12,
    paddingTop: 8,
  },
  jobTextBlock: {
    flex: 1,
    rowGap: 4,
  },
  jobTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  jobSubtitle: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  badgeBase: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  badgeText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeSuccess: {
    backgroundColor: palette.mint,
  },
  badgeWarm: {
    backgroundColor: palette.goldSoft,
  },
  badgeAlert: {
    backgroundColor: palette.warmSoft,
  },
  badgeNeutral: {
    backgroundColor: palette.cloud,
  },
  buttonBase: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: palette.ink,
  },
  buttonSecondary: {
    backgroundColor: palette.paper,
    borderWidth: 1,
    borderColor: palette.border,
  },
  buttonGhost: {
    backgroundColor: palette.background,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: palette.paper,
  },
  buttonTextSecondary: {
    color: palette.ink,
  },
  authEyebrow: {
    color: palette.inkMuted,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
  authTitle: {
    color: palette.ink,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'serif',
  },
  authBody: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 520,
  },
  authCard: {
    backgroundColor: palette.paper,
    borderRadius: 28,
    padding: 20,
    rowGap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  inputLabel: {
    color: palette.inkMuted,
    fontSize: 13,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: palette.background,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.ink,
  },
  authHint: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  errorText: {
    color: palette.alert,
    fontSize: 13,
    lineHeight: 18,
  },
});
