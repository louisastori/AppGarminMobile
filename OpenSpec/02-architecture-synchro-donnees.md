# Architecture de synchro des donnees

Date de redaction: 23 mars 2026

## Objet

Definir comment `nouvelleApp` doit se positionner face aux flux de donnees provenant de:

- Garmin fenix 7 Pro
- Garmin Edge 1030
- ProForm Carbon TLS
- Elite Zumo
- iFIT

## Principe directeur

En V1, `nouvelleApp` doit devenir l'application mobile primaire pour les equipements Garmin.

Cela implique:

- `fenix 7 Pro` geree directement par `nouvelleApp` via une app embarquee `Connect IQ` et un companion mobile
- `Edge 1030` gere via une app embarquee `Connect IQ` et un companion dans `nouvelleApp`
- `Carbon TLS` laisse a `iFIT` pour le pilotage et le suivi natif

`Garmin Connect` n'est plus un prerequis de l'architecture cible. Il peut exister comme fallback ou chemin de migration, mais pas comme coeur produit.

## Vue d'ensemble

```text
Garmin fenix 7 Pro ---- Connect IQ app -------\
                                               \
                                                > nouvelleApp Mobile ----> nouvelleApp Backend
                                               /
Garmin Edge 1030 ---- Connect IQ app ---------/
        |
        +---- ANT+ FE-C ---- Elite Zumo

ProForm Carbon TLS ---- iFIT ---- iFIT Cloud ----> nouvelleApp Backend
```

## Positionnement recommande

### 1. Systeme de controle primaire

- `fenix 7 Pro`: `nouvelleApp`
- `Edge 1030`: `Edge 1030` natif + app `Connect IQ` + `nouvelleApp`
- `Carbon TLS`: `iFIT`
- `Elite Zumo`: `Edge 1030`

### 2. Systeme de verite par domaine

- appareils Garmin, etats de connexion Garmin et activites Garmin directes: `nouvelleApp`
- tapis ProForm et seances iFIT: `iFIT`
- correlation multi-ecosysteme, timeline unifiee et logique metier produit: `nouvelleApp`
- `Garmin Connect`: optionnel, non requis sur le chemin nominal

### 3. Ce que doit faire `nouvelleApp`

- appairer et suivre les appareils Garmin dans son propre flux produit
- piloter la relation wearable Garmin <-> mobile pour la `fenix 7 Pro`
- piloter la relation `Edge 1030` <-> mobile au travers d'une app `Connect IQ`
- agreger des sessions
- dedoublonner les activites
- normaliser les identites d'equipement
- presenter une vue unique utilisateur
- appliquer des regles produit entre ecosystemes

### 4. Ce qu'elle ne doit pas faire en V1

- supposer que `Edge 1030` peut etre traite comme un peripherique BLE generique
- piloter directement le `Carbon TLS` a la place d'iFIT
- se fonder sur du reverse engineering obligatoire des protocoles Garmin
- promettre la parite complete avec toutes les fonctions grand public de `Garmin Connect`

## Typologie des synchronisations

### A. Synchronisation materiel vers application

Objectif:

- configurer
- appairer
- pousser des parametres
- recuperer les donnees locales

Exemples:

- `fenix 7 Pro -> nouvelleApp` via app `Connect IQ`
- `Edge 1030 -> nouvelleApp` via app `Connect IQ`
- `Carbon TLS -> iFIT`

### B. Synchronisation appareil embarque vers mobile

Objectif:

- remonter des donnees capteurs
- pousser du contexte ou des commandes ciblees
- remonter des sessions ou des references FIT

Exemples:

- app `Connect IQ` sur `Edge 1030 -> nouvelleApp`
- `fenix 7 Pro -> nouvelleApp`

### C. Synchronisation application vers backend ou cloud

Objectif:

- sauvegarde
- historique
- consolidation multi-appareils
- fonctions produit et analytiques

Exemples:

- `nouvelleApp Mobile -> nouvelleApp Backend`
- `iFIT -> nouvelleApp`

### D. Synchronisation directe temps reel

Objectif:

- pilotage instantane
- lecture de capteurs
- diffusion de frequence cardiaque

Exemples:

- `Edge 1030 <-> Elite Zumo`
- `fenix 7 Pro -> Edge 1030`
- `fenix 7 Pro -> Carbon TLS via iFIT` en mode capteur FC

### E. Synchronisation de secours

Objectif:

- recuperer une seance si le flux nominal a echoue
- proteger la coherence historique

Exemples:

- import FIT depuis l'`Edge 1030`
- import `FIT/GPX` manuel
- fallback optionnel via `Garmin Connect` si un chemin produit secondaire est ouvert plus tard

## Architecture cible pour `nouvelleApp`

### Couche 1. Integrations Garmin directes

Blocs attendus:

- app embarquee `Connect IQ` pour la `fenix 7 Pro`
- app embarquee `Connect IQ` pour l'`Edge 1030`
- bridge mobile `Connect IQ <-> nouvelleApp`
- parseur FIT pour les sessions et exports `fenix` / `Edge`

### Couche 2. Connecteurs externes non Garmin

- connecteur `iFIT`
- connecteur import `FIT/GPX`
- connecteur catalogue appareils

### Couche 3. Normalisation

Modeles metier minimaux:

- `User`
- `Device`
- `DeviceAssociation`
- `WorkoutSession`
- `WorkoutSource`
- `SensorStream`
- `TrainerControlSession`
- `SyncJob`
- `ExternalAccountLink`

### Couche 4. Resolution d'identite

Problemes a resoudre:

- une meme seance peut exister comme enregistrement direct `fenix`, enregistrement direct `Edge` et session `iFIT`
- un meme utilisateur peut utiliser plusieurs ecrans pour une meme activite
- une `fenix` peut produire la FC pendant qu'un `Edge` enregistre la seance velo
- un `Edge` peut etre la source canonique d'une seance sans que `Garmin Connect` existe dans la boucle

Cle de rapprochement recommandee:

- horodatage debut
- duree
- type d'activite
- appareil principal
- distance / calories / FC moyenne quand disponible

### Couche 5. Politique de priorite

Regle recommandee:

- pour le velo interieur pilote par `Edge + Zumo`, privilegier la session Edge comme session principale
- pour la course sur `Carbon TLS`, privilegier la session `iFIT / ProForm` comme session principale
- si une `fenix` fournit la FC a un autre systeme, traiter la montre comme source capteur, pas comme session principale, sauf si elle est seule a avoir enregistre

### Couche 6. Restitution

Sorties attendues:

- timeline unifiee
- etat des equipements
- compatibilite par scenario
- rapport de synchronisation
- alertes de conflit

## Recommandation de mise en oeuvre

### V1

- `nouvelleApp` gere directement la `fenix 7 Pro`
- `nouvelleApp` gere directement le flux `Edge 1030` au travers d'une app `Connect IQ`
- `iFIT` reste maitre du `Carbon TLS`
- import de fichiers `FIT/GPX` permis comme filet de securite

### V2

- enrichissement temps reel entre `nouvelleApp`, `Edge` et `fenix`
- lecture de certains flux BLE standards additionnels si scenario bien borne
- assistance de configuration pour `Edge <-> Zumo` et `fenix -> iFIT`

### V3

- orchestration avancee
- recommandations de routage des sessions
- moteur de reconciliation automatique plus fin

## Risques et contraintes

### 1. Acces officiel Garmin

Le chemin direct V1 passe par `Connect IQ`.

Consequence:

- pas de dependance immediate a un programme partenaire Garmin pour commencer
- le cadre reste officiel
- la limite principale n'est plus l'acces business, mais le scope reel des APIs `Connect IQ`

### 2. Asymetrie fenix / Edge

La `fenix 7 Pro` et l'`Edge 1030` suivent la meme famille d'architecture, mais pas le meme package embarque.

Consequence:

- il faut deux apps `Connect IQ`
- une pour la montre
- une pour le compteur
- le backlog doit les separer des le debut

### 3. Contention Bluetooth

Un meme appareil BLE ne doit pas etre suppose libre pour plusieurs maitres en parallele.

Exemples:

- montre connectee a `iFIT` pour la FC
- montre connectee a `nouvelleApp`
- home trainer controle par `Edge`

Ces cas peuvent coexister, mais il faut les traiter comme des scenarios verifies, pas comme une hypothese generique.

### 4. Distribution de l'app Edge

Le chemin `Connect IQ` implique une application embarquee supplementaire sur l'`Edge 1030`.

Consequence:

- il faut prevoir son packaging, son installation et sa mise a jour
- la spec V1 doit accepter qu'une partie du setup Garmin soit liee a cette app embarquee

### 5. Latence et coherence cloud

Les synchros `iFIT` et les uploads backend ne sont pas garanties en temps reel.

Consequence:

- `nouvelleApp` doit afficher un etat `en attente de sync`
- il faut distinguer `temps reel`, `quasi temps reel`, `historique`

## Decision produit recommande

La bonne architecture de depart est:

- controle direct Garmin la ou Garmin fournit une voie officielle
- controle temps reel la ou les protocoles materiels sont standards
- synchronisation historique la ou les ecosystemes tiers restent fermes

Donc:

- `fenix 7 Pro + nouvelleApp` doit etre traite comme un couple direct
- `Edge 1030 + nouvelleApp + Elite Zumo` doit etre traite comme un bloc produit central
- `Carbon TLS + iFIT` doit etre traite comme un couple natif `ProForm/iFIT`
- `nouvelleApp` doit se placer au centre du perimetre Garmin, pas seulement au-dessus

## Sources

- Garmin Connect Developer Program Overview:
  https://developer.garmin.com/gc-developer-program/overview/
- Garmin Connect IQ Overview:
  https://developer.garmin.com/connect-iq/overview/
- Garmin Connect IQ Compatible Devices:
  https://developer.garmin.com/connect-iq/compatible-devices/
- Garmin fenix 7 Series Owner's Manual, Wireless Sensors:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-1E3CECCF-0343-431C-95F0-5716E0341C75.html
- Garmin fenix 7 Series Owner's Manual, Using an Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-AU/GUID-5956B2AD-038A-4998-860B-032081F18F61.html
- Garmin fenix 7 Series Owner's Manual, Broadcasting Heart Rate Data:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html
- Garmin Edge 1030 Owner's Manual, Using an ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-8826CB17-DD0D-40F9-89BB-D93C1E8534CF.html
- Garmin Edge 1030 Owner's Manual, Pairing Your ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-4A11E0FF-E539-412E-B959-1E709CFF63A3.html
