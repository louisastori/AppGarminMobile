# Change backend-sync-garmin-watch

Date de redaction: 24 mars 2026

## Objet

Ajouter la couche backend pour persister, normaliser et restituer les donnees provenant du couple `fenix 7 Pro + nouvelleApp Mobile`.

## Identifiant

- Change ID: `backend-sync-garmin-watch`
- Priorite: `P1`

## Resultat attendu

Le backend doit recevoir des lots depuis le mobile, les dedoublonner et exposer une lecture exploitable.

## Scope inclus

### 1. Ingestion

Endpoints minimaux:

- `POST /watch-links/:deviceId/batches`
- `POST /watch-links/:deviceId/diagnostics`
- `GET /watch-links/:deviceId/status`

### 2. Modeles de donnees

Tables minimales:

- `devices`
- `watch_links`
- `metric_samples`
- `daily_snapshots`
- `activity_snapshots`
- `sync_jobs`
- `ingest_rejections`

### 3. Idempotence

Le backend doit dedoublonner au minimum sur:

- `device_id + batch_id`
- `device_id + sample_id`

### 4. Restitution

Endpoints minimaux:

- `GET /devices`
- `GET /devices/:deviceId/metrics/latest`
- `GET /devices/:deviceId/metrics/history`
- `GET /devices/:deviceId/sync-jobs`

### 5. Observabilite

Le backend doit enregistrer:

- lot recu
- lot accepte
- lot rejoue
- lot rejete
- nombre d'echantillons ingeres

## Regles fonctionnelles

### R1. Le mobile reste le point d'entree

Le backend ne parle pas directement a la montre.

### R2. Les donnees brutes restent tracables

Le backend doit garder une representation brute ou quasi brute des lots recus pour audit.

### R3. Le backend ne reinterprette pas agressivement en V1

Pas de moteur de reconciliation complexe dans ce change.
La priorite est la fiabilite de l'ingestion.

## Hors scope

- fusion `fenix` / `Edge` / `iFIT`
- moteur de session canonique complet
- analytics avancees
- recommendations produit

## Livrables

- endpoints d'ingestion
- schema de persistence
- lecture latest / history
- statut de sync par appareil

## Definition de sortie

Le change est termine si:

- les lots recu par le mobile peuvent etre pousses au backend sans doublons
- l'historique d'un appareil est consultable
- un echec d'ingestion est diagnosable

## Dependances

- `mobile-connect-iq-companion`

## Risques

- volume de donnees si cadence live trop haute
- modelisation prematuree de metriques encore instables

## Questions ouvertes

- retention des donnees brutes
- schema exact des snapshots
