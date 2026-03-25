# Change validation-fit-et-diagnostics

Date de redaction: 24 mars 2026

## Objet

Mettre en place un chemin de validation pour comparer les donnees remontees par l'app montre avec une source secondaire de confiance.

## Identifiant

- Change ID: `validation-fit-et-diagnostics`
- Priorite: `P1`

## Resultat attendu

Une boite a outils de verification pour eviter de construire toute la pile sur des donnees mal interpretees.

## Scope inclus

### 1. Validation par export `FIT`

Capacites minimales:

- importer un fichier `FIT`
- extraire les metriques simples de controle
- comparer ces valeurs a celles recues via l'app montre

### 2. Validation par application de logging

Options de controle:

- app `Connect IQ` de type `RawLogger`
- export manuel de sessions
- comparaison horodatage / FC / distance / cadence

### 3. Diagnostics de flux

Rapports minimaux:

- dernier lot montre recu
- dernier lot backend accepte
- delai montre -> mobile
- delai mobile -> backend
- ecarts detectes avec `FIT`

### 4. Outillage local

Outils minimaux:

- script de comparaison CSV/JSON
- mode `debug` pour sauver les lots entrants
- rapport de validation horodate

## Regles fonctionnelles

### R1. La validation ne doit pas bloquer la V1

Le chemin produit peut avancer avant que chaque metrique soit verifiee par export.

### R2. Les metriques `P0` doivent etre testables

Au minimum:

- `heart_rate_bpm`
- `steps`
- `stress_score`
- `time_to_recovery_h`

### R3. Les ecarts doivent etre explicables

Le systeme doit permettre de distinguer:

- erreur de collecte
- erreur de transport
- latence de sync
- difference de fenetre temporelle

## Hors scope

- validation statistique avancee
- certification medicale
- parite complete avec tous les ecrans `Garmin Connect`

## Livrables

- procedure de validation
- scripts de comparaison
- journal de diagnostic
- checklist de mise en recette

## Definition de sortie

Le change est termine si:

- l'equipe peut comparer une session montre avec un export `FIT`
- un ecart simple peut etre investigue rapidement
- le produit dispose d'un mode `debug` exploitable

## Dependances

- `watch-connect-iq-fenix`
- `mobile-connect-iq-companion`
- `backend-sync-garmin-watch`

## Questions ouvertes

- format exact du rapport de comparaison
- seuil d'ecart acceptable par metrique
