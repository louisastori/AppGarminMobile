# Compatibilite initiale des equipements

Date de redaction: 23 mars 2026

## Objectif

Clarifier ce qui est:

- compatible en direct, via SDK officiel Garmin, ANT+ ou Bluetooth
- compatible via une application ou un cloud intermediaire
- conditionne a un programme Garmin ou a une app embarquee `Connect IQ`
- non confirme par une source officielle a ce stade

## Hypothese de travail

`nouvelleApp` doit traiter Garmin et iFIT de maniere asymetrique:

- l'ecosysteme Garmin doit passer prioritairement par `nouvelleApp`, pas par `Garmin Connect`
- l'ecosysteme iFIT/ProForm reste centre sur le `Carbon TLS`
- l'`Elite Zumo` reste un equipement a protocoles standards, surtout pilote par l'`Edge 1030`

Consequence immediate:

- `fenix 7 Pro` et `Edge 1030` ne relevent pas du meme chemin d'integration
- la montre releve d'une logique `Garmin Health Standard SDK`
- le compteur releve plutot d'une logique `Connect IQ device app + companion mobile`

## Resume rapide

| Liaison | Statut | Lecture |
| --- | --- | --- |
| fenix 7 Pro <-> nouvelleApp | Oui, conditionnel | Faisable via `Garmin Health Standard SDK`, avec acces enterprise Garmin |
| Edge 1030 <-> nouvelleApp | Oui, conditionnel et partiel | Faisable via une app `Connect IQ` sur l'Edge et un companion dans `nouvelleApp` |
| fenix 7 Pro <-> Edge 1030 | Oui, partiel | La montre peut diffuser la frequence cardiaque vers un Edge |
| Edge 1030 <-> Elite Zumo | Oui | Compatibilite directe home trainer via ANT+ FE-C |
| fenix 7 Pro <-> Elite Zumo | Oui | Compatibilite directe home trainer via ANT+ |
| Carbon TLS <-> iFIT | Oui | Connexion Bluetooth a l'ecosysteme iFIT |
| Carbon TLS <-> nouvelleApp | Non cible V1 | Le tapis reste d'abord dans l'ecosysteme iFIT |
| Carbon TLS <-> fenix 7 Pro | Oui, partiel | La montre peut servir de source FC pour iFIT; `nouvelleApp` reconcilie ensuite |
| Carbon TLS <-> Edge 1030 | Non confirme | Aucun support officiel direct identifie |
| Garmin Connect <-> nouvelleApp | Optionnel seulement | Peut exister comme fallback ou migration, mais pas comme chemin nominal |

## Par equipement

### 1. Garmin fenix 7 Pro

Compatibilite confirmee:

- peut etre couplee a des capteurs sans fil en ANT+ ou Bluetooth
- peut utiliser un home trainer compatible en activite velo interieur
- peut diffuser la frequence cardiaque vers un appareil Garmin compatible, y compris un Edge
- la famille `fēnix` est supportee par le `Garmin Health Standard SDK`

Implication produit:

- la `fenix 7 Pro` peut devenir un appareil direct de `nouvelleApp`
- le bon chemin officiel n'est pas le reverse engineering BLE brut, mais le `Garmin Health Standard SDK`
- cette voie suppose un acces enterprise Garmin et une validation commerciale

### 2. Garmin Edge 1030

Compatibilite confirmee:

- accepte des capteurs ANT+ ou Bluetooth
- gere explicitement l'usage d'un home trainer ANT+
- l'`Edge 1030` est un appareil `Connect IQ` compatible
- les apps `Connect IQ` peuvent lire des capteurs, enregistrer des donnees FIT et utiliser le BLE pour communiquer avec un telephone ou Internet

Implication produit:

- c'est l'equipement naturel pour piloter un home trainer de velo dans l'univers Garmin
- pour un usage avec un `Elite Zumo`, l'`Edge 1030` reste la cible de controle prioritaire
- pour `nouvelleApp`, la voie directe la plus credible est une app `Connect IQ` embarquee sur l'Edge, pas une imitation de `Garmin Connect`
- inference a partir des sources officielles: cette voie est adaptee a des fonctions ciblees de capture, d'echange de donnees et de controle produit, pas a une reproduction totale des fonctions natives Garmin

### 3. ProForm Carbon TLS

Compatibilite confirmee:

- le `Carbon TLS` s'inscrit dans l'ecosysteme iFIT
- la gamme Carbon se connecte a iFIT via Bluetooth
- ProForm/iFIT indiquent une synchronisation des donnees iFIT avec Garmin, Strava et Apple Health
- iFIT documente aussi l'usage d'une montre Garmin comme source de frequence cardiaque

Limites importantes:

- le `Carbon TLS` n'apparait pas comme un appareil Garmin natif
- la compatibilite avec Garmin est de type passerelle applicative/cloud, pas une liaison equipement-equipement comparable a ANT+ FE-C
- aucun support officiel direct `Edge 1030 <-> Carbon TLS` n'a ete identifie

Implication produit:

- pour `nouvelleApp`, le `Carbon TLS` doit rester traite comme une source `iFIT`, pas comme un peripherique Garmin direct en V1

### 4. Elite Zumo

Compatibilite confirmee:

- home trainer interactif direct-drive
- protocoles annonces: `ANT+ FE-C`, `ANT+ Power / Speed & Cadence`, `Bluetooth FTMS`, `Bluetooth Power / Speed & Cadence`

Implication produit:

- bonne interop standard
- compatibilite tres probable et coherentement documentee avec l'`Edge 1030`
- compatibilite egalement coherente avec la `fenix 7 Pro` sur la fonction home trainer ANT+

## Lecture produit recommandee

### Compatibilite forte

- `fenix 7 Pro + nouvelleApp`, sous reserve d'acces `Garmin Health SDK`
- `Edge 1030 + nouvelleApp`, via app `Connect IQ`
- `fenix 7 Pro + Edge 1030`
- `Edge 1030 + Elite Zumo`
- `fenix 7 Pro + Elite Zumo`

### Compatibilite intermediaire

- `Carbon TLS + nouvelleApp`, uniquement via iFIT
- `Carbon TLS + fenix 7 Pro`, surtout pour la frequence cardiaque et la consolidation de donnees

### Compatibilite faible ou non documentee

- `Carbon TLS + Edge 1030`
- `Carbon TLS + Elite Zumo`

## Consequence pour OpenSpec

Le premier perimetre de `nouvelleApp` doit separer clairement:

- les integrations Garmin directes sur wearable: `Garmin Health Standard SDK`
- les integrations Garmin directes sur compteur: `Connect IQ device app + companion mobile`
- les integrations directes materiel/protocole: `ANT+`, `Bluetooth`, `FTMS`, `FE-C`
- les integrations de consolidation de donnees: `iFIT` et import `FIT/GPX`

Autrement dit:

- le bloc `fenix 7 Pro` peut etre pense comme un wearable pilote par `nouvelleApp`
- le bloc `Edge 1030 + Elite Zumo` peut etre pense comme un bloc de controle direct supervise par `nouvelleApp`
- le bloc `ProForm Carbon TLS` doit etre pense comme un bloc de donnees synchronisees via `iFIT`

## Sources

- Garmin Health SDK Overview:
  https://developer.garmin.com/health-sdk/overview/
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
- Garmin Edge 1030 Owner's Manual, Wireless Sensors:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-E2E2DC23-7B94-43B4-A30D-5FF32270BEC4.html
- Garmin Edge 1030 Owner's Manual, Using an ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-8826CB17-DD0D-40F9-89BB-D93C1E8534CF.html
- Garmin Edge 1030 Owner's Manual, Pairing Your ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-4A11E0FF-E539-412E-B959-1E709CFF63A3.html
- ProForm Carbon TLS:
  https://www.proform.com/treadmills/carbon-tls
- iFIT, Garmin watch as heart-rate source on iFIT-enabled machine:
  https://www.ifit.com/blog/how-to-broadcast-heart-rate-data-from-your-garmin-watch/
- Elite Zumo product PDF:
  https://www.elite-it.com/uploads/product/catalog_box_cta_file_en/169/ZUMO_2022_EN.pdf
