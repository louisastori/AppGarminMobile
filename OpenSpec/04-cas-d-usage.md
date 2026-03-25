# Cas d'usage

Date de redaction: 23 mars 2026

## Objet

Transformer la compatibilite technique en parcours utilisateur lisibles pour `nouvelleApp`.

## Cas d'usage 1

### Nom

Configurer un utilisateur Garmin direct

### Acteurs

- utilisateur
- fenix 7 Pro
- Edge 1030
- nouvelleApp

### Preconditions

- l'app `Connect IQ` de `nouvelleApp` existe pour la `fenix 7 Pro`
- l'app `Connect IQ` de `nouvelleApp` existe pour l'`Edge 1030`

### Flux nominal

1. L'utilisateur ouvre `nouvelleApp`.
2. L'app associe la `fenix 7 Pro` via l'app `Connect IQ` montre prevue.
3. L'utilisateur active ou installe la composante `Connect IQ` sur l'`Edge 1030`.
4. `nouvelleApp` detecte les deux appareils Garmin.
5. L'app affiche la fenix comme wearable principal et l'Edge comme compteur velo.
6. L'utilisateur confirme les roles.
7. `nouvelleApp` construit une fiche equipement unifiee.

### Resultat attendu

- la base materielle Garmin est reconnue sans dependre de `Garmin Connect`

## Cas d'usage 2

### Nom

Faire du velo interieur avec Edge 1030 et Elite Zumo

### Acteurs

- utilisateur
- Edge 1030
- Elite Zumo
- fenix 7 Pro optionnelle pour la FC
- nouvelleApp

### Preconditions

- le Zumo est monte et alimente
- l'Edge 1030 est configure pour trainer interieur
- l'Edge dispose de l'app `Connect IQ` de `nouvelleApp`

### Flux nominal

1. L'utilisateur lance son activite sur l'Edge.
2. L'Edge s'appaire au Zumo via ANT+ FE-C.
3. Si besoin, la fenix diffuse la frequence cardiaque.
4. L'Edge enregistre la seance complete.
5. L'app `Connect IQ` remonte les informations utiles a `nouvelleApp`.
6. `nouvelleApp` annote la session avec le materiel utilise.

### Resultat attendu

- une seule session velo principale
- le Zumo apparait comme home trainer associe
- la fenix peut apparaitre comme source capteur secondaire

## Cas d'usage 3

### Nom

Courir sur Carbon TLS avec frequence cardiaque Garmin

### Acteurs

- utilisateur
- Carbon TLS
- iFIT
- fenix 7 Pro
- nouvelleApp

### Preconditions

- l'utilisateur a un compte iFIT actif
- le Carbon TLS est relie a iFIT
- la montre est en mode broadcast FC si ce scenario est souhaite

### Flux nominal

1. L'utilisateur demarre un workout iFIT sur le Carbon TLS.
2. Pendant l'echauffement, il connecte la montre Garmin comme source FC.
3. Le tapis suit le workout iFIT.
4. `nouvelleApp` peut continuer a lire les donnees directes de la `fenix 7 Pro`.
5. iFIT enregistre la seance.
6. iFIT expose ensuite les donnees vers `nouvelleApp`.

### Resultat attendu

- la seance est classee comme session tapis iFIT
- la montre n'est pas consideree comme appareil principal
- la reconciliation tient compte des donnees Garmin directes quand elles existent

## Cas d'usage 4

### Nom

Consolider une semaine mixte multi-ecosysteme

### Acteurs

- utilisateur
- iFIT
- nouvelleApp

### Flux nominal

1. L'utilisateur fait une sortie velo sur Edge.
2. Il fait une seance tapis sur Carbon TLS.
3. Il fait une activite libre avec sa fenix.
4. `nouvelleApp` recupere directement les sessions Garmin et les sessions iFIT.
5. Elle dedoublonne et recompose une timeline unique.

### Resultat attendu

- une vue unique des entrainements
- une separation nette entre source primaire et source secondaire

## Cas d'usage 5

### Nom

Diagnostiquer une configuration incorrecte

### Symptome

- Edge non connecte au Zumo
- montre visible dans iFIT mais non utilisee comme FC
- activites dupliquees entre Garmin direct et iFIT

### Comportement attendu de `nouvelleApp`

1. Identifier le scenario
2. Nommer le maitre attendu du flux
3. Expliquer la cause probable
4. Proposer l'action correcte

### Exemples de messages utiles

- `Le Zumo devrait etre pilote par l'Edge 1030, pas par un lien BLE brut depuis le telephone.`
- `La fenix 7 Pro doit etre en mode diffusion FC pour etre vue par iFIT.`
- `La meme seance semble provenir de deux ecosystemes; conservation de la source principale iFIT.`

## Cas d'usage 6

### Nom

Fonctionner avec une connectivite partielle

### Situation

- la seance a bien eu lieu
- la synchro device -> mobile ou cloud est retardee

### Comportement attendu

- `nouvelleApp` affiche `session probable en attente`
- elle ne cree pas tout de suite de doublon definitif
- elle reevalue la reconciliation a la prochaine synchro

## Cas d'usage 7

### Nom

Importer une activite de secours

### Situation

- la synchro nominale n'a pas remonte la seance
- l'utilisateur dispose d'un fichier FIT ou GPX

### Comportement attendu

1. Import manuel dans `nouvelleApp`
2. tentative de rapprochement avec les sessions existantes
3. marquage de la provenance `import manuel`

## Priorites produit derivees

### Priorite 1

Onboarding des equipements et affectation de role:

- wearable principal
- compteur principal
- home trainer
- tapis iFIT
- mode d'integration Garmin direct

### Priorite 2

Moteur de reconciliation des sessions.

### Priorite 3

Assistant de diagnostic des liaisons.

### Priorite 4

Vue hebdomadaire multi-source.

## Sources

- Garmin Health SDK Overview:
  https://developer.garmin.com/health-sdk/overview/
- Garmin Connect IQ Overview:
  https://developer.garmin.com/connect-iq/overview/
- Garmin fenix 7 Series Owner's Manual, Broadcasting Heart Rate Data:
  https://www8.garmin.com/manuals/webhelp/GUID-C001C335-A8EC-4A41-AB0E-BAC434259F92/EN-US/GUID-D8D363C2-0690-48D4-95E2-A3557E7D53C2.html
- Garmin Edge 1030 Owner's Manual, Using an ANT+ Indoor Trainer:
  https://www8.garmin.com/manuals/webhelp/edge1030/EN-US/GUID-8826CB17-DD0D-40F9-89BB-D93C1E8534CF.html
- ProForm iFIT:
  https://www.proform.com/ifit
- iFIT, Garmin watch as heart-rate source:
  https://www.ifit.com/blog/how-to-broadcast-heart-rate-data-from-your-garmin-watch/
- Elite Zumo product PDF:
  https://www.elite-it.com/uploads/product/catalog_box_cta_file_en/169/ZUMO_2022_EN.pdf
