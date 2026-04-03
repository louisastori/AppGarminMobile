# 16. Change: validation terrain Android + fenix 7 Pro

## Contexte

Les premiers tests terrain ont ete realises avec:

- un telephone Android physique (`Redmi Note 10 Pro`, Android 12)
- `Garmin Connect Mobile` installe
- `Connect IQ` installe
- une `fenix 7 Pro Sapphire Solar` visible par le SDK Connect IQ Android
- une app montre compilee localement en `.prg`

Le test montre que le squelette applicatif est runnable sur telephone reel, mais qu'un appareil Garmin peut etre **connu** du SDK sans etre **connecte** a `Garmin Connect Mobile`.

## Constat terrain

### Installation Android

Le build `debug` n'est pas un artefact terrain fiable pour cette app:

- il cherche un serveur Metro local
- il ne valide pas un parcours autonome sur telephone physique

Le test terrain doit donc s'appuyer sur un **APK release** embarquant le bundle JavaScript.

Sur `MIUI 13` (`Redmi Note 10 Pro`), un second verrou terrain est apparu:

- l'installation par `adb install` peut echouer avec `INSTALL_FAILED_USER_RESTRICTED`
- l'autorisation ADB seule ne garantit pas le droit d'installer une APK par USB
- la recette terrain doit donc inclure la validation explicite des options Xiaomi de type `Install via USB` ou `USB debugging (Security settings)` avant une campagne de test

### Installation montre fenix

L'installation physique de l'app Connect IQ a ete preparee par sideload USB:

- la montre expose `Internal Storage/GARMIN/Apps`
- le `.prg` compile peut y etre copie depuis Windows
- le nom de fichier visible cote MTP peut perdre l'extension, mais le payload est bien present dans `GARMIN/Apps`

### Etat du bridge Garmin observe

Le companion Android en release:

- initialise correctement le SDK Connect IQ
- liste bien la `fenix 7 Pro Sapphire Solar` dans `knownDevices`
- remonte un statut `NOT_CONNECTED` quand la montre n'est pas reliee a `Garmin Connect Mobile`

Dans cet etat:

- `deviceHello` peut etre partiellement infere a partir du device connu
- `appVersion` et `firmwareVersion` restent en mode attente (`watch-pending`, `pending-watch-handshake`)
- aucun lot Connect IQ reel ne doit etre considere comme recu

## Decision

Le MVP doit distinguer explicitement:

- `device known`
- `device connected to Garmin Connect Mobile`
- `watch app installed`
- `watch handshake received`

Une sync manuelle ne doit pas partir si le device Garmin n'est pas en etat `connected`.

## Exigences produit

- Le mobile n'affiche pas de succes de synchro tant qu'aucune liaison Connect IQ reelle n'est confirmee.
- Le bouton de sync doit renvoyer une erreur utilisateur explicite si la montre est connue mais hors ligne.
- Le bridge Android doit rejeter localement `requestSyncNow` si `currentDeviceStatus != connected`.
- Le flux de diagnostic ne doit pas emettre deux fois le meme `device_not_connected` au bootstrap.

## Exigences build et delivery

- Le pipeline de validation terrain Android doit produire un **APK release installable**.
- Le mode `debug` reste utile pour le developpement local, pas pour une recette physique autonome.
- La recette de deploiement Android doit mentionner le cas `MIUI` ou l'installation ADB peut etre refusee par la couche securite du constructeur.
- La recette montre doit documenter le sideload USB via `GARMIN/Apps` tant qu'aucune distribution Garmin officielle n'est en place.

## Procedure terrain minimale

1. Compiler et installer un APK `release` sur Android.
   - si `adb install` retourne `INSTALL_FAILED_USER_RESTRICTED`, verifier les options de securite USB du constructeur avant de poursuivre
2. Copier le `.prg` montre dans `GARMIN/Apps` sur la fenix.
3. S'assurer que la montre ressort bien du mode stockage USB.
4. Verifier dans `Garmin Connect Mobile` que la montre est reconnectee.
5. Lancer `nouvelleApp` et verifier, dans cet ordre:
   - device connu
   - device connecte
   - app montre installee
   - handshake `device_hello`
   - `device_capabilities`
   - premier `batch_envelope`

## Impact OpenSpec

Ce change precise un point cle de l'architecture:

- la presence d'un device dans `knownDevices` ne vaut pas preuve de liaison active
- la validation de bout en bout doit s'appuyer sur des artefacts `release` et sur une recette materielle explicite
