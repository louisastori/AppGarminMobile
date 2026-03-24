# Modele de donnees

Date de redaction: 23 mars 2026

## Objet

Definir le noyau de donnees de `nouvelleApp` pour:

- representer les utilisateurs et leurs appareils
- normaliser les sessions provenant de Garmin direct et iFIT
- dedoublonner les activites
- stocker les diagnostics de synchro

## Principe

Le modele doit separer:

- la donnee canonique interne
- la provenance externe
- le canal d'acquisition
- l'etat de reconciliation

Une meme session peut etre visible depuis plusieurs sources. La session canonique ne doit donc pas se confondre avec une ligne importee depuis une plateforme.

## Vue d'ensemble

```text
User
 |- ExternalAccountLink
 |- Device
 |   \- DeviceAssociation
 |- WorkoutSession
 |   |- SessionSource
 |   |- SessionDeviceRole
 |   |- SensorStream
 |   \- SessionConflict
 |- SyncJob
 \- FileImport
```

## Entites coeur

### 1. User

Represente l'utilisateur fonctionnel de `nouvelleApp`.

Champs minimaux:

- `id`
- `created_at`
- `updated_at`
- `display_name`
- `timezone`
- `locale`
- `status`

### 2. ExternalAccountLink

Represente le lien entre `nouvelleApp` et un compte externe.

Note:

- indispensable pour `iFIT`
- optionnel pour les flux Garmin directs
- peut rester utile plus tard pour un fallback ou une migration `Garmin Connect`

Champs minimaux:

- `id`
- `user_id`
- `provider`
- `provider_user_id`
- `display_name`
- `status`
- `last_sync_at`
- `last_successful_sync_at`
- `sync_cursor`
- `created_at`
- `updated_at`

Valeurs initiales de `provider`:

- `garmin`
- `ifit`

### 3. Device

Represente un appareil physique ou logique rattache a un utilisateur.

Champs minimaux:

- `id`
- `user_id`
- `external_account_link_id`
- `manufacturer`
- `model`
- `device_family`
- `device_type`
- `integration_mode`
- `serial_number_hash`
- `external_device_id`
- `protocol_capabilities`
- `is_active`
- `created_at`
- `updated_at`

Valeurs initiales de `device_type`:

- `watch`
- `bike_computer`
- `treadmill`
- `smart_trainer`
- `phone`
- `service`

Valeurs initiales de `integration_mode`:

- `garmin_health_direct`
- `connect_iq_direct`
- `ifit_cloud`
- `manual_import`

### 4. DeviceAssociation

Represente une relation connue entre deux appareils.

Champs minimaux:

- `id`
- `user_id`
- `source_device_id`
- `target_device_id`
- `association_type`
- `status`
- `observed_at`
- `created_at`

Valeurs initiales de `association_type`:

- `paired_via_platform`
- `paired_directly_with_app`
- `controls`
- `broadcasts_hr_to`
- `used_during_session`
- `syncs_via_phone`

### 5. WorkoutSession

Represente la session canonique interne.

Champs minimaux:

- `id`
- `user_id`
- `canonical_source_provider`
- `activity_type`
- `sport_family`
- `title`
- `started_at`
- `ended_at`
- `duration_seconds`
- `distance_meters`
- `elevation_gain_meters`
- `energy_kcal`
- `avg_heart_rate`
- `max_heart_rate`
- `avg_power_watts`
- `avg_speed_mps`
- `primary_device_id`
- `status`
- `reconciliation_state`
- `created_at`
- `updated_at`

### 6. SessionSource

Represente une version externe d'une session.

Champs minimaux:

- `id`
- `workout_session_id`
- `external_account_link_id`
- `provider`
- `acquisition_channel`
- `provider_session_id`
- `provider_payload_ref`
- `provider_started_at`
- `provider_duration_seconds`
- `provider_distance_meters`
- `provider_device_name`
- `ingested_at`
- `is_primary_candidate`

Valeurs initiales de `acquisition_channel`:

- `garmin_health_sdk`
- `connect_iq_app`
- `ifit_cloud`
- `manual_file`

### 7. SessionDeviceRole

Represente le role de chaque appareil dans une session.

Champs minimaux:

- `id`
- `workout_session_id`
- `device_id`
- `role`
- `is_primary`
- `source_confidence`

### 8. SensorStream

Represente un flux capteur associe a une session.

Champs minimaux:

- `id`
- `workout_session_id`
- `device_id`
- `metric_type`
- `sample_rate_hint`
- `summary_min`
- `summary_max`
- `summary_avg`
- `stream_ref`

### 9. SessionConflict

Represente un conflit de reconciliation detecte.

Champs minimaux:

- `id`
- `user_id`
- `workout_session_id`
- `conflict_type`
- `severity`
- `status`
- `details`
- `detected_at`
- `resolved_at`

### 10. SyncJob

Represente un travail de synchronisation.

Champs minimaux:

- `id`
- `user_id`
- `external_account_link_id`
- `device_id`
- `job_type`
- `status`
- `started_at`
- `finished_at`
- `cursor_before`
- `cursor_after`
- `items_seen`
- `items_created`
- `items_updated`
- `items_merged`
- `items_conflicted`
- `error_code`
- `error_message`

Valeurs initiales de `job_type`:

- `pair_garmin_wearable`
- `sync_garmin_wearable`
- `sync_edge_device_app`
- `sync_ifit_sessions`
- `import_fit_file`
- `import_gpx_file`
- `reconcile_sessions`

### 11. FileImport

Represente un import manuel FIT ou GPX.

Champs minimaux:

- `id`
- `user_id`
- `file_name`
- `file_hash_sha256`
- `file_type`
- `imported_at`
- `parsed_at`
- `status`
- `parser_summary`
- `workout_session_id`

## Regles d'integrite

### Regle 1

Une `WorkoutSession` doit toujours pouvoir citer au moins une `SessionSource` ou un `FileImport`.

### Regle 2

Une session ne doit avoir qu'un seul `SessionDeviceRole.is_primary = true`.

### Regle 3

Si la source canonique est `ifit`, le `primary_device_id` ne doit pas etre automatiquement ecrase par une session Garmin homologue sans intervention de la regle de priorite.

### Regle 4

Un `SessionConflict` ouvert doit etre visible dans l'interface diagnostic.

### Regle 5

Un `Device` Garmin peut exister sans `ExternalAccountLink`.

## Exemples de modelisation

### Exemple A. Velo interieur

Session canonique:

- `activity_type = indoor_cycling`
- `canonical_source_provider = garmin`
- `primary_device = Edge 1030`

Roles appareils:

- Edge 1030 -> `primary_recorder`
- Elite Zumo -> `controlled_trainer`
- fenix 7 Pro -> `heart_rate_source`

Sources:

- source Garmin `connect_iq_app`
- source Garmin `garmin_health_sdk` optionnelle si la montre enregistre aussi

### Exemple B. Tapis iFIT

Session canonique:

- `activity_type = treadmill_run`
- `canonical_source_provider = ifit`
- `primary_device = Carbon TLS`

Roles appareils:

- Carbon TLS -> `primary_recorder`
- fenix 7 Pro -> `heart_rate_source`

Sources:

- source `ifit_cloud`
- source Garmin `garmin_health_sdk` optionnelle

## Decision V1

Le coeur V1 doit implementer au minimum:

- `User`
- `ExternalAccountLink`
- `Device`
- `DeviceAssociation`
- `WorkoutSession`
- `SessionSource`
- `SessionDeviceRole`
- `SyncJob`
- `FileImport`
- `SessionConflict`

`SensorStream` peut demarrer sous forme de resume plutot que de serie temporelle complete.
