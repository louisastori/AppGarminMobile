import { StatusBar } from 'expo-status-bar';
import { startTransition, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  initialController,
  initialDevices,
  initialSessions,
  initialSyncJobs,
  overviewBullets,
} from './src/mockData';
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

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: 'overview', label: 'Vue d ensemble' },
  { key: 'devices', label: 'Appareils' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'diagnostics', label: 'Diagnostic' },
];

const fenixSnapshot = {
  heartRateBpm: 142,
  heartRateAvgBpm: 138,
  hrvMs: 62,
  sleepHours: 7,
  sleepMinutes: 42,
  recoveryHours: 18,
  readinessScore: 78,
  batteryPct: 83,
};

const edgeSnapshot = {
  lastRideKm: 42.3,
  avgPowerW: 238,
  cadenceRpm: 87,
  sensorCount: 4,
};

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
          ? `Derniere sync ${fenix.lastSeen}. Les flux FC et recovery sont disponibles pour les seances Carbon TLS.`
          : 'La montre principale doit etre reliee pour remonter les mesures cardio dans l app.',
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

function resolveDeviceDataPoints(
  device: Device,
  controller: CarbonController,
  syncJobs: SyncJob[],
): DeviceDataPoint[] {
  const lastJob = syncJobs[0];

  return device.dataPoints.map((point) => {
    if (device.id === 'phone') {
      switch (point.id) {
        case 'mobile-session':
          return {
            ...point,
            value: `Session active · ${syncJobs.length} jobs visibles`,
            state: 'received',
          };
        case 'ble-bridge':
          return {
            ...point,
            value: 'Scan BLE, handoff Garmin et bridge local actifs',
            state: 'received',
          };
        case 'local-diagnostics':
          return {
            ...point,
            value: lastJob
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
      const fenixConnected = device.status === 'connected';

      switch (point.id) {
        case 'heart-rate':
          return {
            ...point,
            value: fenixConnected
              ? `${fenixSnapshot.heartRateBpm} bpm live · moyenne ${fenixSnapshot.heartRateAvgBpm} bpm`
              : point.value,
            state: fenixConnected ? 'received' : 'pending',
          };
        case 'recovery':
          return {
            ...point,
            value: fenixConnected
              ? `Readiness ${fenixSnapshot.readinessScore}/100 · recovery ${fenixSnapshot.recoveryHours} h`
              : point.value,
            state: fenixConnected ? 'received' : 'pending',
          };
        case 'daily-sync':
          return {
            ...point,
            value: fenixConnected
              ? `Sommeil ${fenixSnapshot.sleepHours} h ${fenixSnapshot.sleepMinutes} · HRV ${fenixSnapshot.hrvMs} ms`
              : point.value,
            state: fenixConnected ? 'received' : 'pending',
          };
        case 'device-health':
          return {
            ...point,
            value: fenixConnected
              ? `Batterie ${fenixSnapshot.batteryPct}% · derniere sync ${device.lastSeen}`
              : point.value,
            state: fenixConnected ? 'received' : 'pending',
          };
        default:
          return {
            ...point,
            state: fenixConnected ? 'received' : 'pending',
          };
      }
    }

    if (device.id === 'edge-1030') {
      const edgeConnected = device.status === 'connected';

      switch (point.id) {
        case 'bike-activity':
          return {
            ...point,
            value: edgeConnected
              ? 'Resume FIT, derniere sortie et profils velo charges'
              : point.value,
            state: edgeConnected ? 'received' : point.state,
          };
        case 'trainer-bridge':
          return {
            ...point,
            value: edgeConnected
              ? 'Puissance, cadence et resistance trainer visibles'
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
    return [
      `FC ${fenixSnapshot.heartRateBpm} bpm`,
      `HRV ${fenixSnapshot.hrvMs} ms`,
      `Batt ${fenixSnapshot.batteryPct}%`,
    ];
  }

  if (device.id === 'edge-1030') {
    return device.status === 'connected'
      ? [
          `${edgeSnapshot.lastRideKm.toFixed(1)} km`,
          `${edgeSnapshot.avgPowerW} W`,
          `${edgeSnapshot.cadenceRpm} rpm`,
        ]
      : ['1 sortie', `${edgeSnapshot.sensorCount} capteurs`, 'Bridge partiel'];
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
  const [notice, setNotice] = useState(
    'Prototype Android local pour valider la connexion, le pilotage Carbon TLS et les premiers diagnostics.',
  );

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
      'Session locale ouverte. Les donnees attendues pour chaque appareil sont visibles dans Appareils.',
    );
  };

  const connectFenix = () => {
    updateDevice('fenix-7-pro', (device) => ({
      ...device,
      status: 'connected',
      lastSeen: formatNow(),
      note: 'Montre principale reliee a l app. FC et recovery prets.',
    }));
    prependSyncJob(
      buildSyncJob(
        'Sync fenix 7 Pro',
        'success',
        'La montre principale est bien reliee au mobile.',
      ),
    );
    setNotice('La fenix 7 Pro est bien rattachee a nouvelleApp.');
  };

  const connectEdge = () => {
    updateDevice('edge-1030', (device) => ({
      ...device,
      status: 'connected',
      lastSeen: formatNow(),
      note: 'Bridge Connect IQ active. Le chemin Edge -> mobile est pret.',
    }));
    prependSyncJob(
      buildSyncJob(
        'Bridge Edge 1030',
        'success',
        'Le compteur Edge est maintenant joignable depuis le mobile.',
      ),
    );
    setNotice('Bridge Edge 1030 active. Le canal velo direct est disponible.');
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
    setNotice('Une nouvelle synchronisation locale vient d etre lancee.');
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
        <Text style={styles.panelTitle}>MVP mobile oriente Garmin direct + Carbon TLS local</Text>
        {overviewBullets.map((bullet) => (
          <View key={bullet} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
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
        const resolvedDataPoints = resolveDeviceDataPoints(device, controller, syncJobs);
        const resolvedMetrics = resolveDeviceMetrics(device, controller, syncJobs);

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
                    label={device.status === 'connected' ? 'Bridge actif' : 'Connecter Edge'}
                    onPress={connectEdge}
                    variant="primary"
                  />
                  <ActionButton label="Relancer sync" onPress={relaunchSync} />
                </>
              ) : isFenix ? (
                <>
                  <ActionButton label="Connecter fenix" onPress={connectFenix} variant="primary" />
                  <ActionButton label="Relancer sync" onPress={relaunchSync} />
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

  if (!loggedIn) {
    return (
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
              Mode demo local: aucun appel Garmin, BLE ou iFIT n est encore branche.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
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
