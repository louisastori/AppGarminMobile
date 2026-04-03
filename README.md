# nouvelleApp

Socle de travail pour une application qui unifie les donnees et les diagnostics de plusieurs ecosystemes fitness:

- Garmin fenix 7 Pro
- Garmin Edge 1030
- ProForm Carbon TLS
- Elite Zumo

Direction produit actuelle:

- `nouvelleApp` doit etre l'application mobile primaire pour les appareils Garmin
- `Garmin Connect` n'est pas le chemin nominal vise
- `iFIT` reste necessaire pour le `Carbon TLS`

Le cadrage fonctionnel se trouve dans [OpenSpec/README.md](OpenSpec/README.md).

## Structure

- `apps/api`: API metier et synchronisations
- `apps/web`: interface utilisateur
- `packages/domain`: logique metier et reconciliation
- `packages/connectors`: connecteurs Garmin direct, iFIT et imports
- `packages/shared`: types et utilitaires communs
- `packages/ui`: composants UI partages
- `edge-app`: application embarquee Connect IQ pour l'Edge
- `db`: schema SQL et migrations
- `docs/architecture`: architecture technique et ADR
- `OpenSpec`: spec fonctionnelle et de delivery

## Demarrage

Le projet est pose comme monorepo `pnpm` avec TypeScript partage.

La prochaine etape naturelle est:

1. choisir le framework exact de l'API et du web,
2. brancher la couche de persistence,
3. implementer le premier connecteur Garmin direct.

## CI

Les workflows GitHub Actions couvrent aujourd'hui le perimetre executable du repo:

- installation du workspace avec `corepack pnpm install --frozen-lockfile`
- typecheck de `packages/shared`
- typecheck et export Expo de `apps/mobile`
- validation structurelle et build des apps `Connect IQ` pour `fenix` et `Edge`

Les dossiers `apps/api`, `apps/web`, `packages/domain`, `packages/connectors` et `packages/ui` restent sur des scripts placeholder. Ils ne sont donc pas encore bloquants dans la CI tant que leur outillage reel n'est pas defini.

Pour `Connect IQ`, la compilation produit effectivement des `.prg` si le runner dispose du SDK Garmin (`monkeyc`) et d'une cle developpeur `CONNECTIQ_DEV_KEY`. Sinon, le workflow conserve la validation structurelle et saute la compilation de maniere explicite.
