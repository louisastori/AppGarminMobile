# Change watch-poc-data-contract

Date de redaction: 24 mars 2026

## Objet

Definir le contrat de donnees entre l'app `Connect IQ` de la `fenix 7 Pro` et `nouvelleApp` mobile.

Ce change doit figer:

- les types de messages
- les metriques V1
- la strategie `live + store-and-forward`
- les regles d'idempotence

## Identifiant

- Change ID: `watch-poc-data-contract`
- Priorite: `P0`

## Resultat attendu

Un schema de messages stable, assez simple pour etre implemente rapidement sur montre et mobile.

## Scope inclus

### 1. Handshake appareil

Messages a definir:

- `DeviceHello`
- `DeviceCapabilities`
- `LinkStatus`

Champs minimaux:

- `device_id`
- `device_model`
- `firmware_version`
- `app_version`
- `timezone_offset_minutes`
- `supported_metrics`

### 2. Echantillons live

Message:

- `MetricSample`

Champs minimaux:

- `sample_id`
- `recorded_at`
- `metric_key`
- `metric_value`
- `metric_unit`
- `source_domain`
- `quality`

`source_domain` doit rester borne a:

- `activity_monitor`
- `sensor`
- `activity`
- `user_profile`
- `sensor_history`

### 3. Snapshots

Messages:

- `DailySnapshot`
- `ActivitySnapshot`
- `ProfileSnapshot`

Usage:

- eviter de pousser des dizaines de petits messages pour les donnees stables
- faire des resynchronisations rapides

### 4. Buffer et batch

Messages:

- `BatchEnvelope`
- `BatchAck`

Champs minimaux:

- `batch_id`
- `sequence`
- `items`
- `created_at`
- `acknowledged_at`
- `last_sample_id`

### 5. Erreurs et diagnostics

Messages:

- `WatchError`
- `SyncDiagnostic`

Codes minimaux:

- `sensor_unavailable`
- `permission_missing`
- `storage_full`
- `phone_unreachable`
- `batch_rejected`

## Metriques V1

### P0 live

- `heart_rate_bpm`
- `stress_score`
- `respiration_rate_bpm`
- `spo2_percent`
- `activity_timer_state`
- `activity_elapsed_time_s`
- `activity_elapsed_distance_m`
- `activity_current_speed_mps`
- `activity_current_cadence_rpm`

### P0 snapshots

- `steps`
- `step_goal`
- `calories_kcal`
- `distance_m`
- `floors_climbed`
- `floors_descended`
- `move_bar_level`
- `time_to_recovery_h`
- `resting_heart_rate_bpm`
- `average_resting_heart_rate_bpm`
- `vo2max_running`
- `vo2max_cycling`

### P1 conditionnel

- `heart_beat_interval_ms`
- `temperature_c`
- `pressure_pa`
- `heading_deg`
- `power_w`
- `body_battery_percent`

## Regles de transport

### R1. Horodatage

- tous les horodatages sont en `UTC`
- la montre envoie aussi son `timezone_offset_minutes`

### R2. Idempotence

- `sample_id` doit etre unique sur la montre
- `batch_id` doit etre unique pour chaque lot
- le mobile doit pouvoir rejouer un `BatchAck` sans effet de bord

### R3. Volume

- les snapshots doivent etre privilegies pour les donnees lentes
- le live V1 ne doit pas saturer le lien mobile

### R4. Degradation

- si le mobile est absent, la montre bufferise
- si le buffer depasse son seuil, la montre doit supprimer les plus vieux echantillons `debug` avant les `P0`

## Hors scope

- chiffrement applicatif specifique
- compression custom
- schema backend definitif
- reconciliation multi-appareils

## Livrables

- spec markdown du contrat
- liste des metriques `P0/P1`
- table de mapping `metric_key -> source Connect IQ`
- regles d'ACK et de rejeu

## Definition de sortie

Le change est termine si:

- le contrat est assez precis pour coder montre et mobile sans interpretation libre
- chaque metrique V1 a une source officielle Garmin identifiee
- les cas d'erreur et d'idempotence sont couverts

## Dependances

- aucune

## Questions ouvertes

- taille maximale du buffer montre
- granularite exacte de `heart_beat_interval_ms`
- format final du `sample_id`
