# 🗄️ Base de données Rewardly — mode d'emploi

## ⚡ UN SEUL FICHIER À EXÉCUTER

➡️ **[`INSTALL.sql`](./INSTALL.sql)**

```
Supabase → SQL Editor → coller TOUT le fichier → Run
```

- ✅ **Tout est dedans** : tables, index, types, seeds, stockage, fonctions (34), triggers, policies RLS (106) et privilèges (GRANT/REVOKE + durcissement).
- ✅ **Idempotent** : réexécutable à volonté, **sans erreur et sans perte de données**.
- ✅ **Sûr même sur une base ancienne** : les RPC sont précédées d'un `DROP FUNCTION IF EXISTS`
  (évite l'erreur *« cannot change name of input parameter »*).
- ✅ **Vérifié automatiquement** avant génération : chaque policy/trigger/index/GRANT doit pointer
  sur une table ou une fonction réellement définie, avec la bonne signature.

## 📁 Structure du dossier

| Élément | Rôle | À exécuter ? |
|---|---|---|
| **`INSTALL.sql`** | **Fichier unique à exécuter** (généré) | ✅ **oui** |
| `sources/base_schema.sql` | Schéma de base (tables, RLS, seeds) — matière première | ❌ non |
| `sources/migrations/00001…00022` | Historique des correctifs (déjà inclus dans INSTALL.sql) | ❌ non |
| `tools/` | Outils d'administration (reset, plans/catégories) | ⚠️ manuel |
| `functions/` | Edge Functions Deno | — |

> ℹ️ `sources/` = **matière première** du générateur. On y modifie une migration,
> on lance `npm run db:build`, et `INSTALL.sql` est reconstruit.

## 🔁 Régénérer / vérifier

```powershell
npm run db:build     # reconstruit supabase/INSTALL.sql depuis supabase/sources/
npm run db:check     # vérifie qu'INSTALL.sql est à jour (exécuté en CI)
```

Fonctionnement du générateur (`scripts/build-supabase-setup.mjs`) :
`sources/base_schema.sql` + `sources/migrations/00001…000NN` (ordre croissant) → découpage en
instructions → **la dernière définition de chaque fonction/trigger/policy gagne** → écriture de
`INSTALL.sql` en 4 sections (§1 schéma, §2 fonctions, §3 triggers+RLS, §4 privilèges).
Chaque instruction porte son origine en commentaire : `-- [sources/migrations/00010_…sql:23]`.

## ➕ Ajouter une modification

1. Créer `sources/migrations/00023_ta_modification.sql` (idempotent : `CREATE OR REPLACE`,
   `IF NOT EXISTS`, `DROP … IF EXISTS`).
2. `npm run db:build` (vérifie les références puis reconstruit `INSTALL.sql`).
3. Exécuter `INSTALL.sql` sur Supabase (SQL Editor → Run).
4. Committer **les deux** (la migration + `INSTALL.sql`).

## 🔒 Durcissement inclus

- Les **15 RPC d'administration** (`add_reward`, `approve_submission`, `validate_deposit`,
  `validate_withdrawal`, `ban_user`, `delete_user`, `create_task/_plan…`, `get_platform_stats`,
  `get_users_with_details`) portent une garde `IF auth.uid() IS NOT NULL AND NOT public.is_admin()`
  et sont **retirées de l'accès anonyme** (`REVOKE … FROM PUBLIC, anon`).
- `credit_referral_commission`, `credit_feeexpay_deposit` et `request_withdrawal_feeexpay`
  sont réservées au `service_role`.

Sans ce durcissement, la clé `anon` (publique, présente dans le navigateur) permettait d'appeler
directement `/rest/v1/rpc/add_reward` ou `validate_deposit`.

## 💰 Parrainage (règle en vigueur)

**Aucun crédit** à l'inscription ni à la saisie d'un code : le parrain touche
`referral_commission_percent` (défaut **10 %**) du montant **réellement investi** par son filleul,
versé par `activate_plan()` → `credit_referral_commission()`
(migration `00022_referral_investment_commission.sql`).

## 🆘 En cas de doute sur l'état de la base

Exécuter `INSTALL.sql` : la base est ramenée à l'état exact attendu par le code déployé,
sans perte de données.

