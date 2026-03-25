# Plan de sprints

Date de redaction: 23 mars 2026

## Objet

Transformer le backlog technique en sequence de delivery executable pour une V1.

## Hypothese de cadence

- sprint de 2 semaines
- equipe cible reduite
- priorite a un backend propre, une UI simple et une logique de reconciliation robuste

## Vue d'ensemble

| Sprint | Objectif | Livrable principal |
| --- | --- | --- |
| Sprint 0 | Initialiser le projet et verrouiller Garmin | squelette monorepo, schema DB, cadrage `Connect IQ` montre + compteur |
| Sprint 1 | Prouver le Garmin direct | prototype `fenix` direct et prototype `Edge` device app |
| Sprint 2 | Brancher iFIT et unifier les sessions | ingestion multi-source et timeline canonique |
| Sprint 3 | Rendre exploitable par un utilisateur | onboarding Garmin/iFIT, equipements, detail session, relance sync |
| Sprint 4 | Stabiliser et diagnostiquer | import FIT/GPX, conflits, observabilite, durcissement |

## Sprint 0

### But

Poser les fondations techniques et verrouiller la strategie Garmin directe.

### Backlog cible

- T-001
- T-002
- T-003
- T-004

### Livrables

- schema initial de persistence
- conventions de type partagees
- regles de validation du domaine
- arborescence technique projet
- cadrage technique `Connect IQ` montre / `Connect IQ` compteur

### Definition de sortie

- la base du projet existe
- les entites principales sont nommees et stabilisees
- la strategie Garmin directe est decoupee en deux flux: `fenix` et `Edge`

## Sprint 1

### But

Prouver que le chemin Garmin direct est realiste.

### Backlog cible

- T-005
- T-006
- T-009
- T-010
- T-011
- T-028

### Livrables

- app `Connect IQ` fenix minimale
- app `Connect IQ` Edge minimale
- bridge mobile `Edge <-> nouvelleApp`
- pipeline d'ingestion idempotent
- journalisation des `SyncJob`

### Risques

- limitation de scope cote `Connect IQ`

### Definition de sortie

- une `fenix 7 Pro` peut echanger des donnees utiles avec `nouvelleApp`
- un `Edge 1030` peut echanger au minimum des messages applicatifs utiles avec `nouvelleApp`

## Sprint 2

### But

Brancher `iFIT` puis construire le coeur produit: la session canonique et la logique de reconciliation.

### Backlog cible

- T-007
- T-008
- T-012
- T-013
- T-014
- T-018
- T-019
- T-020
- T-021

### Livrables

- connecteur iFIT V1
- moteur de rapprochement
- politique de priorite des sources
- gestion des conflits
- API sessions, devices, connected accounts

### Risques

- faux positifs ou faux negatifs dans les fusions
- manque de donnees pour choisir une source principale

### Definition de sortie

- la timeline canonique fonctionne
- les scenarios `Edge + Zumo` et `Carbon TLS + iFIT` ont une priorite explicite
- les sources Garmin directes et iFIT coexistent dans la meme base

## Sprint 3

### But

Rendre la V1 utilisable par un utilisateur final.

### Backlog cible

- T-023
- T-024
- T-025
- T-026
- T-029

### Livrables

- ecran onboarding Garmin/iFIT
- ecran equipements
- timeline UI
- detail session UI
- messages de diagnostic principaux
- relance manuelle de synchro

### Risques

- flou UX sur les roles appareils
- confusion entre source principale et source secondaire

### Definition de sortie

- un utilisateur peut connecter ses appareils Garmin et son compte iFIT
- voir ses appareils
- voir sa timeline
- comprendre un cas simple de mauvaise configuration

## Sprint 4

### But

Stabiliser et ajouter les fonctions de secours indispensables.

### Backlog cible

- T-015
- T-016
- T-017
- T-022
- T-027
- T-030

### Livrables

- import FIT
- import GPX
- hash anti-doublons fichiers
- ecran conflits
- tableau de sante des connecteurs

### Risques

- heterogeneite des fichiers importes
- multiplication des cas de conflits non resolus

### Definition de sortie

- la V1 est robuste face a une synchro partielle
- un utilisateur peut rattraper une seance manquante

## Jalons de validation

### Jalon A

Fin Sprint 1:

- preuve de synchro `fenix` directe
- preuve de communication `Edge` directe

### Jalon B

Fin Sprint 2:

- preuve de synchro iFIT
- dedoublonnage sur des donnees de test
- detail session avec provenance

### Jalon C

Fin Sprint 3:

- demo end-to-end de la timeline utilisateur

### Jalon D

Fin Sprint 4:

- demo complete V1 avec import manuel et diagnostic

## Definition de V1 livrable

La V1 est atteinte si:

- la `fenix 7 Pro`, l'`Edge 1030` et `iFIT` sont relies
- les equipements connus sont visibles
- une timeline unifiee est disponible
- les doublons courants sont traites
- un diagnostic simple est propose
- un import de secours est disponible

## Reste apres V1

- support plus fin des flux temps reel
- recommandations de configuration plus intelligentes
- eventuelle lecture partielle de protocoles standards en direct hors Garmin
