# fenix-connect-iq

Squelette Connect IQ reel pour la `fenix 7 Pro`.

Ce projet pose:

- `manifest.xml` et `monkey.jungle`
- un flux montre `collect -> batch -> queue -> UI`
- une separation claire entre collecte, buffer et lien mobile
- des scripts PowerShell pour verifier la structure et compiler si le SDK Garmin est disponible

Structure principale:

- `source/App.mc`
- `source/Contract.mc`
- `source/BatchQueue.mc`
- `source/MetricCollector.mc`
- `source/WatchLinkService.mc`
- `source/StatusView.mc`
- `source/StatusDelegate.mc`
- `resources/strings/strings.xml`

Pre-requis pour compiler:

- Connect IQ SDK installe localement
- variable `CONNECTIQ_SDK_HOME` si `monkeyc` n est pas dans le `PATH`
- variable `CONNECTIQ_DEV_KEY` vers la cle developpeur `.der`

Commandes:

- `pnpm --filter @nouvelle-app/fenix-connect-iq typecheck`
- `pnpm --filter @nouvelle-app/fenix-connect-iq build`
