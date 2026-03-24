# Matrice des flux temps reel

Date de redaction: 23 mars 2026

## Objet

Lister les flux temps reel utiles pour `nouvelleApp` et distinguer:

- les flux a supporter
- les flux a observer seulement
- les flux a ne pas tenter en V1

## Legende

- `Direct`: liaison materielle standard
- `Direct app`: liaison Garmin officielle via SDK ou app embarquee
- `Indirect`: passe par une app ou un cloud tiers
- `Priorite V1`: important des le debut
- `Hors V1`: a ne pas implementer en premiere iteration

## Matrice

| Source | Destination | Donnee / controle | Canal principal | Nature | Statut | Priorite |
| --- | --- | --- | --- | --- | --- | --- |
| fenix 7 Pro | nouvelleApp | etat wearable, config, donnees sante et activite | Garmin Health Standard SDK | Direct app | officiel, conditionnel a l'acces Garmin | V1 prioritaire |
| nouvelleApp | fenix 7 Pro | configuration wearable et collecte ciblee | Garmin Health Standard SDK | Direct app | officiel, conditionnel a l'acces Garmin | V1 prioritaire |
| Edge 1030 | nouvelleApp | messages applicatifs, contexte session, references FIT | Connect IQ + BLE | Direct app | officiel, scope partiel | V1 prioritaire |
| nouvelleApp | Edge 1030 | commandes ciblees, configuration produit, synchronisation applicative | Connect IQ + BLE | Direct app | officiel, scope partiel | V1 prioritaire |
| fenix 7 Pro | Edge 1030 | frequence cardiaque diffusee | ANT+ / mode compatible Garmin | Direct | confirme partiel | V1 utile |
| Edge 1030 | Elite Zumo | controle home trainer | ANT+ FE-C | Direct | confirme | V1 prioritaire |
| Elite Zumo | Edge 1030 | puissance, vitesse, cadence, resistance | ANT+ FE-C / ANT+ capteurs | Direct | confirme | V1 prioritaire |
| fenix 7 Pro | Elite Zumo | seance home trainer | ANT+ | Direct | confirme partiel | V1 utile |
| fenix 7 Pro | Carbon TLS via iFIT | frequence cardiaque | Bluetooth | Direct cote iFIT | confirme | V1 utile |
| Carbon TLS | iFIT | pilotage de la machine, telemetrie seance | Bluetooth | Direct vers ecosysteme iFIT | confirme | Observer |
| iFIT | nouvelleApp | activites tapis normalisees | cloud | Indirect | cible V1 | V1 prioritaire |
| Garmin Connect | nouvelleApp | import Garmin de secours ou migration | cloud | Indirect | optionnel, hors chemin nominal | Observer |
| nouvelleApp | fenix 7 Pro | appairage BLE brut hors SDK Garmin | Bluetooth | Direct | non retenu | Hors V1 |
| nouvelleApp | Edge 1030 | appairage BLE brut hors Connect IQ | Bluetooth | Direct | non retenu | Hors V1 |
| nouvelleApp | Carbon TLS | pilotage direct du tapis | Bluetooth | Direct | non documente officiellement | Hors V1 |
| nouvelleApp | Elite Zumo | pilotage direct trainer | FTMS / FE-C possible en theorie selon cible | Direct | non retenu pour V1 | Hors V1 |

## Lecture par scenario

### 1. Velo interieur Garmin

Chemin recommande:

```text
fenix 7 Pro --HR--> Edge 1030 --ANT+ FE-C--> Elite Zumo
      |                    |
      v                    v
  nouvelleApp <---- Connect IQ ---- Edge session data
```

Pourquoi:

- c'est le scenario le plus standard et le plus robuste
- l'Edge est concu pour piloter un trainer ANT+
- la montre peut rester source FC
- `nouvelleApp` reste le point d'entree Garmin cote mobile

### 2. Tapis ProForm avec FC Garmin

Chemin recommande:

```text
fenix 7 Pro ---- nouvelleApp
     |
     +--Bluetooth HR--> Carbon TLS / iFIT

Carbon TLS -----------------> iFIT
iFIT -----------------------> nouvelleApp
```

Pourquoi:

- iFIT documente la montre Garmin comme source de FC
- le tapis reste pilote par son ecosysteme natif
- la montre reste dans le perimetre produit de `nouvelleApp`

### 3. Consolidation multi-activites

Chemin recommande:

```text
Garmin direct ----\
                   > nouvelleApp
iFIT -------------/
```

Pourquoi:

- on separe le controle direct Garmin de la consolidation multi-source

## Regles de conception

### Regle 1

Faire de `nouvelleApp` le maitre des flux Garmin seulement par une voie officielle Garmin: `Garmin Health SDK` ou `Connect IQ`.

### Regle 2

Privilegier `ANT+ FE-C` pour `Edge 1030 <-> Elite Zumo`.

### Regle 3

Privilegier `iFIT` comme couche officielle du `Carbon TLS`.

### Regle 4

Traiter les flux cloud comme asynchrones, jamais comme temps reel garanti.

## Points de vigilance

### Bluetooth multi-maitre

La montre, le telephone, le tapis et parfois d'autres capteurs peuvent entrer en competition.

Decision:

- `nouvelleApp` ne doit pas supposer qu'un peripherique BLE est libre

### Duplication des seances

Une meme seance peut remonter:

- depuis Edge
- depuis fenix
- depuis iFIT

Decision:

- dedoublonnage obligatoire dans la couche donnees

### Degradation acceptable

Si un flux temps reel n'est pas disponible, `nouvelleApp` doit retomber sur:

- import historique
- synchro differee
- association manuelle

## Priorites V1

- modeliser les deux chemins Garmin directs
- assister l'utilisateur sur quel appareil doit etre maitre
- consolider les sessions apres coup
- permettre un diagnostic de configuration

## Hors V1

- contourner les SDK officiels Garmin
- devenir une app de controle home trainer concurrente
- s'appuyer sur des protocoles non documentes pour l'appairage principal

## Sources

- Garmin Health SDK Overview:
  https://developer.garmin.com/health-sdk/overview/
- Garmin Connect IQ Overview:
  https://developer.garmin.com/connect-iq/overview/
- Garmin Connect IQ Compatible Devices:
  https://developer.garmin.com/connect-iq/compatible-devices/
- Garmin fenix 7 Series Owner's Manual, Wireless Sensors:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-1E3CECCF-0343-431C-95F0-5716E0341C75.html
- Garmin fenix 7 Series Owner's Manual, Broadcasting Heart Rate Data:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html
- Garmin Edge 1030 Owner's Manual, Pairing Your ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-4A11E0FF-E539-412E-B959-1E709CFF63A3.html
- Garmin Edge 1030 Owner's Manual, Using an ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-8826CB17-DD0D-40F9-89BB-D93C1E8534CF.html
- iFIT, Garmin watch as heart-rate source:
  https://www.ifit.com/blog/how-to-broadcast-heart-rate-data-from-your-garmin-watch/
- Elite Zumo product PDF:
  https://www.elite-it.com/uploads/product/catalog_box_cta_file_en/169/ZUMO_2022_EN.pdf
