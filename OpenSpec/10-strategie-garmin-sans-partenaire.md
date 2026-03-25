# Strategie Garmin sans partenaire

Date de redaction: 24 mars 2026

## Objet

Definir la strategie V1 si `nouvelleApp` ne dispose d'aucun acces partenaire Garmin.

Cette strategie remplace, pour la `fenix 7 Pro`, l'hypothese "direct Garmin Health SDK" presente dans les documents precedents.

## Decision directrice

La voie recommandee en V1 est:

- une app `Connect IQ` installee sur la `fenix 7 Pro`
- un companion Android dans `nouvelleApp`
- un protocole applicatif explicite entre montre et mobile
- un mode hybride `live + store-and-forward`

Cette voie est preferee a:

- du reverse engineering du BLE prive de `Garmin Connect`
- une dependance immediate a `Garmin Health SDK`
- une architecture qui ferait de `Garmin Connect` le coeur du produit

## Pourquoi cette voie est la meilleure

### 1. Elle est officielle et gratuite a l'entree

- `Connect IQ` et le `Connect IQ Mobile SDK` sont utilisables sans programme partenaire Garmin
- il n'y a pas besoin d'attendre une validation business pour demarrer le produit

### 2. Elle est stable

- on controle le schema des messages
- on choisit les donnees envoyees
- on n'est plus bloque par les protocoles prives de `Garmin Connect`

### 3. Elle est testable

- la montre peut pousser du `live`
- la montre peut bufferiser et re-synchroniser plus tard
- le mobile peut journaliser chaque message recu

### 4. Elle permet une migration propre

- si un acces Garmin partenaire est obtenu plus tard, l'architecture n'est pas jetee
- le backend et l'app mobile conservent leur contrat

## Donnees ciblees accessibles sans partenaire

### A. Donnees quotidiennes

- `steps`
- `stepGoal`
- `calories`
- `distance`
- `floorsClimbed`
- `floorsDescended`
- `moveBarLevel`
- `respirationRate`
- `stressScore`
- `timeToRecovery`
- `activeMinutesDay`
- `activeMinutesWeek`

### B. Donnees live et capteurs

- `heartRate`
- `heartBeatIntervals`
- `oxygenSaturation`
- `accel`
- `accelerometerData`
- `gyroscopeData`
- `magnetometerData`
- `pressure`
- `temperature`
- `speed`
- `cadence`
- `heading`
- `power`

### C. Donnees d'activite en cours

- `currentHeartRate`
- `currentCadence`
- `currentSpeed`
- `currentPower`
- `elapsedDistance`
- `elapsedTime`
- `calories`
- `currentLocation`
- `timerState`

### D. Donnees profil / reference

- `restingHeartRate`
- `averageRestingHeartRate`
- `vo2maxRunning`
- `vo2maxCycling`
- `weight`
- `height`
- `activityClass`
- `sleepTime`
- `wakeTime`
- `runningStepLength`
- `walkingStepLength`

### E. Donnees historiques disponibles sur la montre

- historique `heart rate`
- historique `stress`
- historique `body battery`
- historique `temperature`
- historique `pressure`
- historique `elevation`

## Donnees a ne pas promettre en V1

Sans partenaire Garmin, `nouvelleApp` ne doit pas promettre en V1:

- parite complete avec `Garmin Connect`
- toutes les metriques wellness derivees Garmin
- toutes les formes de `sleep` enrichi et les analyses cloud Garmin
- un streaming 24/7 complet quand l'app montre n'est pas active

## Architecture cible

```text
fenix 7 Pro
  |
  | Connect IQ app
  | - collecte locale
  | - buffer local
  | - push live si mobile present
  v
nouvelleApp Mobile
  |
  | - appairage Connect IQ
  | - reception / ACK
  | - persistence locale
  | - sync backend
  v
nouvelleApp Backend
```

## Mode de fonctionnement recommande

### Mode 1. Live

- la montre pousse des echantillons pendant que l'app montre est active
- le mobile affiche les donnees quasi temps reel

### Mode 2. Store-and-forward

- la montre garde un buffer local
- si le mobile est absent, les donnees sont envoyees plus tard

### Mode 3. Validation

- un export `FIT` ou une app de logging de controle peut servir a verifier les valeurs
- ce chemin est un outil de validation, pas le chemin produit principal

## Impacts produits

### Ce qu'il faut construire

- une app montre `Connect IQ`
- un contrat de donnees stable
- un companion Android
- un pipeline de sync backend
- un outil de diagnostic et de comparaison

### Ce qu'on peut deferer

- backend avance de reconciliation multi-fournisseurs
- normalisation iFIT
- fusion avec `Edge 1030`

## Sequence recommandee

1. verrouiller le contrat de donnees montre <-> mobile
2. coder l'app `Connect IQ` minimale sur `fenix 7 Pro`
3. coder le companion Android de reception
4. ajouter la sync backend
5. ajouter la validation `FIT` et les diagnostics

## Definition de succes

La strategie est validee si:

- la `fenix 7 Pro` peut envoyer des donnees officielles a `nouvelleApp`
- `nouvelleApp` peut afficher ces donnees sans passer par `Garmin Connect`
- les donnees survive a une perte de connexion temporaire
- l'equipe peut verifier au moins un sous-ensemble des mesures par une voie secondaire

## Sources

- Connect IQ Overview:
  https://developer.garmin.com/connect-iq/overview/
- Connect IQ API docs:
  https://developer.garmin.com/connect-iq/api-docs/
- ActivityMonitor.Info:
  https://developer.garmin.com/connect-iq/api-docs/Toybox/ActivityMonitor/Info.html
- Sensor:
  https://developer.garmin.com/connect-iq/api-docs/Toybox/Sensor.html
- SensorHistory:
  https://developer.garmin.com/connect-iq/api-docs/Toybox/SensorHistory.html
- UserProfile.Profile:
  https://developer.garmin.com/connect-iq/api-docs/Toybox/UserProfile/Profile.html
- Activity.Info:
  https://developer.garmin.com/connect-iq/api-docs/Toybox/Activity/Info.html
- Garmin Connect Developer Program FAQ:
  https://developer.garmin.com/gc-developer-program/program-faq/
