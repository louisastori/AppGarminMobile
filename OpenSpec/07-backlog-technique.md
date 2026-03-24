# Backlog technique

Date de redaction: 23 mars 2026

## Objet

Transformer la spec fonctionnelle en chantiers techniques executables.

## Hypothese

Le backlog est ordonne pour permettre une V1 incrementalement livrable.

## Legende

- `P0`: indispensable a la V1
- `P1`: important mais peut suivre
- `P2`: utile apres stabilisation

## Chantier 1. Fondations projet

### T-001

Priorite: `P0`

Mettre en place la structure du domaine:

- `users`
- `external_accounts`
- `devices`
- `workout_sessions`
- `session_sources`
- `session_device_roles`
- `sync_jobs`
- `session_conflicts`
- `file_imports`

Livrable:

- schema initial de persistence

### T-002

Priorite: `P0`

Definir les enums partages:

- providers
- device types
- activity types
- sync status
- conflict types

Livrable:

- definitions de types communes front/back

### T-003

Priorite: `P0`

Ajouter les regles de validation metier du modele:

- une session a au moins une source
- une seule source principale
- un seul role appareil principal

Livrable:

- garde-fous en couche domaine

## Chantier 2. Integrations Garmin directes

### T-004

Priorite: `P0`

Implementer les abstractions de connecteurs:

- connecteur appareil Garmin direct
- connecteur app embarquee `Edge`
- connecteur cloud `iFIT`
- test de connexion
- lecture des appareils
- lecture des sessions

Livrable:

- interfaces stables pour Garmin direct et iFIT

### T-005

Priorite: `P0`

Implementer l'integration `Garmin Health Standard SDK` pour la `fenix 7 Pro`.

Livrable:

- appairage wearable
- recuperation des appareils Garmin compatibles
- recuperation des sessions et mesures Garmin
- persistence des `SyncJob`

### T-006

Priorite: `P0`

Implementer l'app `Connect IQ` et son bridge mobile pour l'`Edge 1030`.

Livrable:

- app embarquee `Edge`
- echange de messages entre `Edge` et `nouvelleApp`
- recuperation des sessions ou references FIT Edge
- persistence des `SyncJob`

### T-007

Priorite: `P0`

Implementer le connecteur iFIT V1.

Livrable:

- recuperation des sessions iFIT
- rattachement au `Carbon TLS` quand l'information existe
- persistence des `SyncJob`

### T-008

Priorite: `P1`

Ajouter le support de re-synchronisation manuelle.

Livrable:

- endpoint ou action UI `resync`

## Chantier 3. Ingestion et normalisation

### T-009

Priorite: `P0`

Construire un pipeline d'ingestion:

- fetch brut
- mapping provider -> modele interne
- enregistrement des sources
- creation ou mise a jour de session canonique

Livrable:

- pipeline idempotent

### T-010

Priorite: `P0`

Definir les mappers:

- fenix session -> `WorkoutSession`
- Edge session -> `WorkoutSession`
- iFIT session -> `WorkoutSession`
- appareil provider -> `Device`

Livrable:

- mappers testes unitairement

### T-011

Priorite: `P0`

Stocker la provenance brute minimale.

Livrable:

- `provider_payload_ref`
- ou blob brut selon architecture retenue

## Chantier 4. Reconciliation

### T-012

Priorite: `P0`

Implementer l'algorithme de rapprochement de sessions.

Regles minimales:

- proximite temporelle
- type d'activite proche
- appareil principal compatible
- distance / duree comparables

Livrable:

- score de similarite

### T-013

Priorite: `P0`

Implementer la politique de priorite des sources.

Regles minimales:

- `Edge + Zumo` > session Garmin principale
- `Carbon TLS + iFIT` > session iFIT principale
- montre source FC != session principale par defaut

Livrable:

- moteur de decision trace

### T-014

Priorite: `P0`

Creer les `SessionConflict` quand la fusion n'est pas sure.

Livrable:

- conflit persiste
- raison lisible

## Chantier 5. Import manuel

### T-015

Priorite: `P0`

Implementer l'import FIT.

Livrable:

- parse
- creation de session
- tentative de rapprochement

### T-016

Priorite: `P1`

Implementer l'import GPX.

Livrable:

- parse
- creation de session
- tentative de rapprochement

### T-017

Priorite: `P0`

Hasher les fichiers importes et empecher les doublons triviaux.

Livrable:

- `file_hash_sha256`

## Chantier 6. API applicative

### T-018

Priorite: `P0`

Exposer la liste des comptes et appareils connectes.

Livrable:

- endpoint `connected-accounts`

### T-019

Priorite: `P0`

Exposer la liste des appareils et leurs roles.

Livrable:

- endpoint `devices`

### T-020

Priorite: `P0`

Exposer la timeline unifiee des sessions.

Livrable:

- endpoint `sessions`
- filtres de base

### T-021

Priorite: `P0`

Exposer le detail d'une session.

Livrable:

- sources
- roles appareils
- etat de reconciliation

### T-022

Priorite: `P1`

Exposer la liste des conflits de reconciliation.

Livrable:

- endpoint `conflicts`

## Chantier 7. Interface V1

### T-023

Priorite: `P0`

Construire l'ecran d'onboarding Garmin et comptes.

Livrable:

- connexion fenix
- connexion Edge
- connexion iFIT
- etat des liens

### T-024

Priorite: `P0`

Construire l'ecran equipements.

Livrable:

- liste des appareils
- attribution de role

### T-025

Priorite: `P0`

Construire la timeline des sessions.

Livrable:

- vue liste
- source principale
- appareil principal

### T-026

Priorite: `P0`

Construire la vue detail session.

Livrable:

- sources
- appareils
- diagnostic simple

### T-027

Priorite: `P1`

Construire l'ecran diagnostic / conflits.

Livrable:

- liste des problemes
- suggestions d'action

## Chantier 8. Diagnostic et observabilite

### T-028

Priorite: `P0`

Journaliser tous les `SyncJob`.

Livrable:

- traces minimales
- compteurs de sessions vues / creees / fusionnees

### T-029

Priorite: `P0`

Ajouter des messages de diagnostic metier.

Exemples:

- `Le Zumo devrait etre pilote par l'Edge 1030.`
- `La session iFIT n'est pas encore synchronisee.`
- `La montre semble n'etre qu'une source FC.`

### T-030

Priorite: `P1`

Ajouter un tableau de sante des connecteurs.

Livrable:

- dernier succes
- dernier echec
- temps moyen de sync

## Dependances structurantes

- T-001 avant T-009
- T-004 avant T-005, T-006 et T-007
- T-009 avant T-012
- T-012 avant T-014
- T-018 a T-022 apres T-009
- T-023 a T-027 apres T-018 a T-021

## Sequence recommandee

### Lot A

- T-001
- T-002
- T-003
- T-004

### Lot B

- T-005
- T-006
- T-009
- T-010
- T-011

### Lot C

- T-007
- T-012
- T-013
- T-014
- T-018
- T-019
- T-020
- T-021

### Lot D

- T-023
- T-024
- T-025
- T-026
- T-028
- T-029

### Lot E

- T-015
- T-016
- T-017
- T-022
- T-027
- T-030

## Definition de sortie V1

La V1 peut etre consideree livrable si:

- la `fenix 7 Pro`, l'`Edge 1030` et `iFIT` peuvent etre relies
- les appareils sont visibles
- les sessions sont unifiees
- les doublons courants sont traites
- un diagnostic minimal est disponible
