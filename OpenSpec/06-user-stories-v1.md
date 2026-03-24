# User stories V1

Date de redaction: 23 mars 2026

## Objet

Definir les user stories prioritaires de `nouvelleApp` pour une V1 realiste.

## Perimetre V1

La V1 doit:

- connecter les appareils Garmin en direct
- connecter les comptes externes necessaires
- detecter les equipements connus
- consolider les sessions
- dedoublonner les activites
- diagnostiquer les problemes de configuration

La V1 ne doit pas:

- remplacer iFIT
- piloter directement le `Carbon TLS`
- reposer sur `Garmin Connect` pour le chemin nominal Garmin

## Epique 1. Onboarding Garmin et comptes externes

### US-001

En tant qu'utilisateur,
je veux associer ma `fenix 7 Pro` a `nouvelleApp`,
afin que mon application soit le point d'entree Garmin sur mobile.

Criteres d'acceptation:

- l'etat du lien wearable est visible
- l'identifiant de l'appareil est reconnu
- la date de derniere synchro directe est visible

### US-002

En tant qu'utilisateur,
je veux associer mon `Edge 1030` a `nouvelleApp`,
afin que mes sessions velo remontent sans passer par `Garmin Connect`.

Criteres d'acceptation:

- l'etat du lien `Connect IQ` est visible
- l'appareil est reconnu comme `bike_computer`
- les erreurs de liaison sont explicites

### US-003

En tant qu'utilisateur,
je veux connecter mon compte iFIT,
afin que `nouvelleApp` puisse lire mes sessions tapis et machine iFIT.

Criteres d'acceptation:

- un compte iFIT peut etre rattache a mon profil
- l'etat du lien est visible
- les erreurs de lien sont explicites

### US-004

En tant qu'utilisateur,
je veux voir les appareils connus par plateforme,
afin de comprendre quels equipements sont relies a quel ecosysteme.

Criteres d'acceptation:

- les appareils Garmin et iFIT sont listes
- chaque appareil affiche son type et sa source
- un appareil peut etre marque actif ou inactif

### US-005

En tant qu'utilisateur,
je veux affecter un role fonctionnel a chaque appareil,
afin que `nouvelleApp` sache lequel est ma montre principale, mon compteur, mon tapis ou mon trainer.

Criteres d'acceptation:

- je peux choisir `wearable principal`
- je peux choisir `compteur principal`
- je peux choisir `tapis`
- je peux choisir `home trainer`

## Epique 2. Ingestion et normalisation

### US-006

En tant que systeme,
je veux ingerer les sessions et mesures de la `fenix 7 Pro`,
afin d'alimenter la timeline de l'utilisateur sans `Garmin Connect`.

Criteres d'acceptation:

- les sessions sont stockees avec leur provenance
- les erreurs de parsing n'empechent pas la synchro globale

### US-007

En tant que systeme,
je veux ingerer les sessions de l'`Edge 1030`,
afin d'integrer les activites velo Garmin sans `Garmin Connect`.

Criteres d'acceptation:

- les sessions Edge sont stockees avec leur provenance
- l'appareil principal `Edge 1030` est rattache aux sessions
- les erreurs de synchronisation sont tracables

### US-008

En tant que systeme,
je veux importer les sessions iFIT,
afin d'integrer les activites `Carbon TLS` dans la meme vue.

Criteres d'acceptation:

- les sessions iFIT sont normalisees
- le `Carbon TLS` peut etre rattache a une session importee

### US-009

En tant qu'utilisateur,
je veux importer un fichier FIT ou GPX,
afin de recuperer une seance manquante.

Criteres d'acceptation:

- les formats FIT et GPX sont acceptes
- la session importee est marquee comme import manuel
- une tentative de rapprochement automatique est faite

## Epique 3. Reconciliation et dedoublonnage

### US-010

En tant qu'utilisateur,
je veux une seule session visible quand plusieurs sources representent la meme activite,
afin d'eviter les doublons.

Criteres d'acceptation:

- une session Garmin et une session iFIT proches peuvent etre rapprochees
- la session canonique conserve ses sources
- la regle de priorite est tracable

### US-011

En tant qu'utilisateur,
je veux que `nouvelleApp` choisisse automatiquement la meilleure source principale,
afin de garder des statistiques coherentes.

Criteres d'acceptation:

- `Edge + Zumo` donne une session principale Garmin
- `Carbon TLS + iFIT` donne une session principale iFIT
- une montre source FC ne devient pas automatiquement source principale

### US-012

En tant qu'utilisateur,
je veux voir les conflits de reconciliation,
afin de comprendre pourquoi une session n'a pas ete fusionnee.

Criteres d'acceptation:

- les conflits sont listes
- chaque conflit indique sa cause
- un statut de resolution est disponible

## Epique 4. Timeline et consultation

### US-013

En tant qu'utilisateur,
je veux consulter une timeline unifiee,
afin de voir toutes mes activites au meme endroit.

Criteres d'acceptation:

- la timeline combine Garmin direct et iFIT
- chaque session affiche sa source principale
- les appareils impliques sont visibles

### US-014

En tant qu'utilisateur,
je veux ouvrir le detail d'une session,
afin de voir les appareils et les sources qui ont participe.

Criteres d'acceptation:

- la source principale est visible
- les sources secondaires sont visibles
- les roles appareils sont visibles

### US-015

En tant qu'utilisateur,
je veux filtrer mes sessions par type d'appareil ou de sport,
afin d'isoler par exemple mes seances `Edge + Zumo` ou `Carbon TLS`.

Criteres d'acceptation:

- filtre par type d'activite
- filtre par appareil principal
- filtre par source Garmin ou iFIT

## Epique 5. Diagnostic

### US-016

En tant qu'utilisateur,
je veux savoir quel appareil devrait etre maitre dans un scenario donne,
afin d'eviter une mauvaise configuration.

Criteres d'acceptation:

- `Edge 1030` est recommande comme maitre du `Elite Zumo`
- `iFIT` est recommande comme maitre du `Carbon TLS`
- `nouvelleApp` est recommandee comme point d'entree Garmin
- le message de recommandation est comprehensible

### US-017

En tant qu'utilisateur,
je veux un diagnostic si une seance attendue n'apparait pas,
afin de savoir si le probleme vient de la synchro, du cloud ou de l'appareil.

Criteres d'acceptation:

- le diagnostic distingue `pas encore synchronise`
- le diagnostic distingue `source absente`
- le diagnostic distingue `doublon probable`

### US-018

En tant qu'utilisateur,
je veux etre averti d'une configuration incoherente,
afin de corriger par exemple une montre utilisee comme appareil principal alors qu'elle n'etait qu'une source FC.

Criteres d'acceptation:

- une alerte signale l'ambiguite
- une suggestion d'action est proposee

## Epique 6. Operabilite

### US-019

En tant qu'utilisateur,
je veux voir l'etat de mes synchronisations,
afin de savoir si mes donnees sont a jour.

Criteres d'acceptation:

- chaque connecteur affiche son dernier succes
- les echecs affichent un motif minimal

### US-020

En tant qu'utilisateur,
je veux pouvoir relancer une synchro,
afin de recuperer une seance recente.

Criteres d'acceptation:

- une action manuelle de relance existe
- le resultat du job est visible

## Priorisation V1

### Must have

- US-001
- US-002
- US-003
- US-004
- US-005
- US-006
- US-007
- US-008
- US-009
- US-010
- US-011
- US-012
- US-013
- US-014
- US-016
- US-017
- US-019
- US-020

### Should have

- US-015
- US-018

## Definition of done V1

La V1 est consideree atteinte si:

- un utilisateur peut connecter sa `fenix 7 Pro`, son `Edge 1030` et son compte `iFIT`
- il voit ses equipements connus
- il voit une timeline unifiee
- les doublons les plus courants sont rapproches
- il peut diagnostiquer un probleme simple de configuration ou de synchro
