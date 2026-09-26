# 📦 Sources SQL (matière première) — ❌ NE PAS EXÉCUTER

Ce dossier contient la **matière première** à partir de laquelle est généré le fichier unique
[`../INSTALL.sql`](../INSTALL.sql). **Ces fichiers ne sont jamais exécutés tels quels** par
l'application ni par Supabase.

| Fichier | Rôle |
|---|---|
| `base_schema.sql` | Schéma de base : extensions, tables, index, **RLS**, seeds, stockage |
| `migrations/00001…00022` | Historique des correctifs (ordre croissant) — **la dernière définition gagne** |

## Pourquoi deux niveaux ?

- Un seul fichier à exécuter = **moins d'erreurs** (plus de « dans quel ordre ? », plus de doublons
  de fonctions qui s'écrasent dans le désordre).
- Les sources gardent l'**historique lisible** de chaque correctif (utile en cas d'audit).

## Pour régénérer

```powershell
npm run db:build   # reconstruit ../INSTALL.sql (validé automatiquement)
npm run db:check   # vérifie qu'il est à jour (CI)
```

> ⚠️ Pour ajouter une modification : créer un **nouveau** fichier dans `migrations/` avec le numéro
> suivant (`00023_…`), **jamais** modifier un fichier déjà appliqué en production.
