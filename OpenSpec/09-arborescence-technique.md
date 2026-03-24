# Arborescence technique

Date de redaction: 23 mars 2026

## Objet

Definir une structure de projet simple, modulaire et compatible avec la spec OpenSpec.

## Choix de structure

Structure recommandee:

- monorepo
- TypeScript partage entre front et back
- SQL explicite pour la base
- packages metier isoles des applications
- code Garmin `Edge` separe du code mobile/backend

## Vue cible

```text
nouvelleApp/
|-- apps/
|   |-- api/
|   |   `-- src/
|   `-- web/
|       `-- src/
|-- packages/
|   |-- connectors/
|   |   |-- garmin-health/
|   |   |-- edge-connect-iq/
|   |   |-- ifit/
|   |   `-- fit-import/
|   |-- domain/
|   |-- shared/
|   `-- ui/
|-- edge-app/
|   `-- connect-iq/
|-- db/
|   `-- migrations/
|-- docs/
|   `-- architecture/
|-- scripts/
|-- OpenSpec/
|-- package.json
|-- pnpm-workspace.yaml
|-- tsconfig.base.json
`-- .gitignore
```

## Responsabilites

### `apps/api`

Responsable de:

- API HTTP
- orchestration des synchronisations
- exposition des sessions, conflits, appareils

### `apps/web`

Responsable de:

- onboarding Garmin/iFIT
- vue equipements
- timeline
- detail session
- diagnostic

### `packages/domain`

Responsable de:

- modeles metier
- enums
- regles de priorite
- logique de reconciliation

### `packages/connectors`

Responsable de:

- adaptateurs `Garmin Health`
- bridge mobile `Connect IQ`
- connecteur `iFIT`
- import `FIT/GPX`
- mapping provider -> domaine
- gestion des jobs de sync

### `edge-app/connect-iq`

Responsable de:

- code embarque `Connect IQ` pour l'`Edge 1030`
- echanges de messages avec `nouvelleApp`
- capture applicative cote `Edge`

### `packages/shared`

Responsable de:

- types communs
- helpers
- schemas communs

### `packages/ui`

Responsable de:

- composants UI partages
- primitives pour timeline, badges, diagnostics

### `db`

Responsable de:

- schema SQL
- migrations
- donnees de test eventuelles

### `docs/architecture`

Responsable de:

- ADR
- decisions d'integration
- conventions techniques

## Regles de dependance

- `apps/web` peut dependre de `packages/shared` et `packages/ui`
- `apps/api` peut dependre de `packages/domain`, `packages/connectors`, `packages/shared`
- `packages/connectors` peut dependre de `packages/domain` et `packages/shared`
- `edge-app/connect-iq` ne depend pas des apps web/api
- `packages/domain` ne depend pas des apps

## Decision V1

Cette arborescence est suffisante pour:

- lancer la V1
- eviter de melanger logique metier et UI
- separer proprement les deux integrations Garmin
- rendre les connecteurs remplacables si les integrations evoluent
