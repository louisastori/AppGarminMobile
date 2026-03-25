# Change watch-connect-iq-fenix

Date de redaction: 24 mars 2026

## Objet

Implementer l'app `Connect IQ` pour la `fenix 7 Pro`.

Cette app est la source primaire des donnees Garmin V1 quand aucun acces partenaire Garmin n'est disponible.

## Identifiant

- Change ID: `watch-connect-iq-fenix`
- Priorite: `P0`

## Resultat attendu

Une app montre capable de:

- identifier la montre
- lire un sous-ensemble officiel des donnees Garmin
- pousser du `live` vers le mobile
- bufferiser quand le mobile n'est pas disponible

## Scope inclus

### 1. Cycle de vie de l'app montre

Fonctions minimales:

- ecran d'accueil
- etat du lien mobile
- demarrage / arret d'une session de collecte
- compteur d'echantillons en attente

### 2. Collecte des donnees

Sources Connect IQ ciblees:

- `Toybox.ActivityMonitor`
- `Toybox.Sensor`
- `Toybox.Activity`
- `Toybox.UserProfile`
- `Toybox.SensorHistory`

### 3. Modes de collecte

#### Mode snapshot

- collecte ponctuelle au lancement
- collecte manuelle a la demande

#### Mode live

- push periodique pendant qu'une session est active
- cadence d'emission borne et configurable

#### Mode replay

- envoi des echantillons bufferises au retour du mobile

### 4. Buffer local

Le buffer montre doit:

- etre persiste localement
- garder les echantillons `P0`
- exposer sa taille
- permettre un purge / reset via l'app

### 5. Protocole vers mobile

L'app montre doit implementer:

- `DeviceHello`
- `BatchEnvelope`
- reception de `BatchAck`
- reemission des lots non acquittes

## UX montre minimale

Ecrans / etats:

- `Pret`
- `Mobile connecte`
- `Collecte active`
- `N lots en attente`
- `Erreur capteur`

Actions:

- `Start`
- `Stop`
- `Sync now`
- `Reset queue`

## Contraintes

### C1. Pas de promesse de background illimite

Le change ne doit pas supposer une collecte continue 24/7 hors des modes supportes par `Connect IQ`.

### C2. Priorite a la fiabilite

- peu de metriques
- contrat strict
- journal minimal

### C3. Pas de logique produit metier complexe dans la montre

La montre collecte et transporte.
Le mobile et le backend interpretent.

## Hors scope

- distribution Store
- mise a jour OTA sophistiquee
- analytics avancees montre
- support `Edge 1030`

## Livrables

- dossier source `Connect IQ` dedie `fenix`
- ecrans montre minimaux
- couche de collecte
- buffer local
- emetteur / recepteur de lots

## Definition de sortie

Le change est termine si:

- une `fenix 7 Pro` peut envoyer au moins `heart_rate_bpm`, `steps`, `stress_score` et `time_to_recovery_h`
- la montre peut reenvoer des lots non acquittes
- un diagnostic simple est visible sur la montre

## Dependances

- `watch-poc-data-contract`

## Risques

- limitations de cycle de vie `Connect IQ`
- differences de disponibilite selon capteur et contexte
- consommation batterie si cadence live trop agressive

## Questions ouvertes

- type exact d'app montre le plus adapte
- periodicite live par defaut
- taille de buffer acceptable sur `fenix 7 Pro`
