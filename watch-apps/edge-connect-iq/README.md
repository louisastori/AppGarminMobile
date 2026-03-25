# edge-connect-iq

Squelette de l'application `Connect IQ` destinee au `Edge 1030`.

Objectif V1:

- exposer le lien applicatif `Edge -> nouvelleApp`
- transmettre contexte session et references utiles
- preparer l'export ou la synchronisation de donnees d'activite

References:

- `OpenSpec/02-architecture-synchro-donnees.md`
- `OpenSpec/03-matrice-flux-temps-reel.md`
- `OpenSpec/09-arborescence-technique.md`

Structure prevue:

- `source/`
- `resources/`
- `tests/`

Fichiers applicatifs prevus plus tard:

- `source/App.mc`
- `source/EdgeSessionBridge.mc`
- `source/TrainerContext.mc`
- `source/FitReferencePublisher.mc`
