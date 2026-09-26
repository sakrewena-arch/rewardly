# 🗃️ Fichiers historiques (NE JAMAIS EXÉCUTER)

Ce dossier conserve d'anciens fichiers SQL **remplacés** par l'ensemble canonique
[`../setup/`](../setup/). Ils sont utiles uniquement comme référence/historique.

| Fichier | Pourquoi il est ici |
|---|---|
| `consolidated_schema.sql` | ancien « schéma complet » (2 398 lignes) qui **contenait des versions périmées et non sécurisées** des RPC (`add_reward` sans garde, `activate_plan` sans parrainage…). Remplacé par `setup/01_schema.sql` + `setup/02_functions.sql`. |
| `security_fixes.sql` | **copie octet pour octet** de `migrations/00017_security_fixes.sql` (doublon). |
| `dbg/01..07_fonctions.sql` | lots de **debug** découpés pour localiser une erreur de syntaxe dans le SQL Editor. Ils contiennent une variante de parrainage basée sur les **gains** (et non l'investissement) et des RPC **sans garde admin** : les exécuter **écraserait** l'état actuel. |

## Ce qu'il faut faire à la place

```powershell
# Reconstruire/aligner la base sur l'état attendu par le code :
#   Supabase → SQL Editor → coller supabase/setup/00_full_setup.sql
```
