# OpenSpec

Ce dossier pose la base fonctionnelle de `nouvelleApp`.

Equipements cibles:

- Garmin fenix 7 Pro
- Garmin Edge 1030
- ProForm Carbon TLS
- Elite Zumo

Hypothese directrice au 23 mars 2026:

- `nouvelleApp` doit devenir l'application mobile primaire pour les appareils Garmin
- `Garmin Connect` sort du chemin nominal produit
- le `Carbon TLS` reste rattache a `iFIT`
- l'`Elite Zumo` reste pilote prioritairement par l'`Edge 1030`

Revision au 24 mars 2026:

- si aucun acces partenaire Garmin n'est disponible, la voie V1 recommandee pour la `fenix 7 Pro` n'est plus `Garmin Health SDK`
- la montre doit etre integree par une app `Connect IQ` dediee et un companion Android dans `nouvelleApp`
- les documents `10` a `15` cadrent cette variante "sans partenaire"

Documents:

- [01-compatibilite-equipements.md](01-compatibilite-equipements.md)
- [02-architecture-synchro-donnees.md](02-architecture-synchro-donnees.md)
- [03-matrice-flux-temps-reel.md](03-matrice-flux-temps-reel.md)
- [04-cas-d-usage.md](04-cas-d-usage.md)
- [05-modele-de-donnees.md](05-modele-de-donnees.md)
- [06-user-stories-v1.md](06-user-stories-v1.md)
- [07-backlog-technique.md](07-backlog-technique.md)
- [08-plan-de-sprints.md](08-plan-de-sprints.md)
- [09-arborescence-technique.md](09-arborescence-technique.md)
- [10-strategie-garmin-sans-partenaire.md](10-strategie-garmin-sans-partenaire.md)
- [11-change-watch-poc-data-contract.md](11-change-watch-poc-data-contract.md)
- [12-change-watch-connect-iq-fenix.md](12-change-watch-connect-iq-fenix.md)
- [13-change-mobile-connect-iq-companion.md](13-change-mobile-connect-iq-companion.md)
- [14-change-backend-sync-garmin-watch.md](14-change-backend-sync-garmin-watch.md)
- [15-change-validation-fit-et-diagnostics.md](15-change-validation-fit-et-diagnostics.md)
