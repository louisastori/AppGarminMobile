# Change mobile-connect-iq-companion

Date de redaction: 24 mars 2026

## Objet

Implementer le companion Android dans `nouvelleApp` pour recevoir, persister et afficher les donnees envoyees par l'app `Connect IQ` de la `fenix 7 Pro`.

## Identifiant

- Change ID: `mobile-connect-iq-companion`
- Priorite: `P0`

## Resultat attendu

Le mobile doit devenir le hub officiel entre la montre et le reste du systeme.

## Scope inclus

### 1. Integration SDK mobile Garmin

Le mobile doit:

- detecter la presence du `Connect IQ Mobile SDK`
- detecter l'app montre cible
- etablir le lien logique avec la `fenix 7 Pro`
- envoyer les `ACK`

### 2. Persistence locale

Le mobile doit stocker:

- `device_hello`
- `device_capabilities`
- `metric_samples`
- `snapshot_batches`
- `sync_attempts`
- `last_ack_cursor`

### 3. Ecran diagnostic mobile

Sections minimales:

- montre detectee / non detectee
- derniere synchro reussie
- taille de file en attente cote montre
- dernier lot recu
- dernier echec

### 4. Ecran donnees live

Affichages minimaux:

- `heart_rate_bpm`
- `stress_score`
- `respiration_rate_bpm`
- `steps`
- `time_to_recovery_h`

### 5. Services applicatifs internes

Services minimaux:

- `WatchLinkService`
- `WatchIngressService`
- `WatchAckService`
- `WatchStorageService`

## Regles fonctionnelles

### R1. ACK immediat

- un lot valide doit etre acquitte rapidement
- un lot invalide doit etre journalise avec une raison

### R2. UI resiliente

- absence de montre != crash
- absence de donnees != ecran vide incomprehensible

### R3. Idempotence

- un meme `batch_id` rejoue ne doit pas dupliquer les lignes locales

## Hors scope

- sync backend complete
- fusion multi-providers
- analyse sportive avancee
- support iOS

## Livrables

- module Android de liaison `Connect IQ`
- stockage local des echantillons
- UI de diagnostic
- UI de visualisation live basique

## Definition de sortie

Le change est termine si:

- le mobile peut afficher des donnees reelles de la `fenix 7 Pro`
- le mobile peut acquitter et rejouer proprement des lots
- l'utilisateur voit si la montre est connectee, en erreur ou en attente

## Dependances

- `watch-poc-data-contract`
- `watch-connect-iq-fenix`

## Risques

- comportement du SDK mobile Garmin selon version Android
- besoin d'installation / mise a jour de composants Garmin cote telephone
- gestion des coupures entre montre et mobile

## Questions ouvertes

- technologie de persistence locale retenue dans `apps/mobile`
- surface UI exacte a exposer dans l'app existante
