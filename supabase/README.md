# 🗄️ Base de données Rewardly — organisation du SQL

## ⚡ À exécuter (le seul chemin officiel)

| Ordre | Fichier | Contenu |
|---|---|---|
| **1** | [`setup/00_full_setup.sql`](./setup/00_full_setup.sql) | **Tout en un seul fichier** (recommandé : copier-coller dans le SQL Editor) |
| ou | `setup/01_schema.sql` | extensions, types, **tables**, index, seeds, storage |
| | `setup/02_functions.sql` | **34 fonctions** (état final dédupliqué) |
| | `setup/03_rls_triggers.sql` | triggers + **policies RLS** |
| | `setup/04_privileges.sql` | `GRANT`/`REVOKE` + durcissement anti auto-crédit |

> ✅ **Tout est idempotent** : ces fichiers peuvent être exécutés plusieurs fois sans erreur.
> Ils sont **générés** : `npm run db:build` (voir « Régénérer » plus bas).

## 📁 Rôle de chaque dossier

| Dossier | Rôle | À exécuter ? |
|---|---|---|
| `setup/` | **État canonique** de la base (source d'exécution) | ✅ **oui** |
| `migrations/` | Historique des correctifs (`00001` → `00022`), déjà appliqués en prod | ❌ non (référence) |
| `legacy/` | Anciens fichiers non canoniques (`consolidated_schema.sql`, `dbg/*`, doublon `security_fixes.sql`) | ❌ **jamais** |
| `tools/` | Scripts d'exploitation (reset, test de charge, injection) | ⚠️ **manuel & dangereux** |
| `functions/` | Edge Functions Deno (déployées via `supabase functions deploy`) | — |

## 🧠 Règles de fonctionnement (à respecter)

1. **Une seule source de vérité** : on modifie uniquement un **nouveau fichier** dans `migrations/`
   (numéro suivant, ex. `00023_...sql`), puis on régénère `setup/`.
2. **Jamais** modifier `setup/*.sql` à la main (fichiers générés).
3. **Jamais** exécuter `legacy/**` ni `tools/**` sur la base de production.
4. Pour un correctif en urgence : créer la migration **puis** exécuter `setup/00_full_setup.sql`.

## 🔁 Régénérer l'ensemble canonique

```powershell
npm run db:build     # régénère supabase/setup/
npm run db:check     # vérifie que setup/ est à jour (utilisé en CI)
```

Comment ça marche :
`legacy/consolidated_schema.sql` + `migrations/00001..000NN` (ordre croissant) → découpage
en instructions → **la dernière définition de chaque fonction/trigger/policy gagne** →
écriture de `setup/01..04` (chaque instruction porte son origine en commentaire `-- [fichier:ligne]`).

## 🔒 Durcissement appliqué automatiquement

* les **15 RPC d'administration** (`add_reward`, `approve_submission`, `validate_deposit`,
  `validate_withdrawal`, `ban_user`, `delete_user`, `create_task/_plan…`,
  `get_platform_stats`, `get_users_with_details`) portent une garde
  `IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN … 'Non autorisé'` ;
* elles sont **retirées de l'accès anonyme** (`REVOKE … FROM PUBLIC, anon`), ainsi que
  `credit_referral_commission`, `credit_feeexpay_deposit`, `request_withdrawal_feeexpay`
  (réservées au `service_role`).

Sans ce durcissement, la clé `anon` (publique, présente dans le navigateur) permettait
d'appeler directement `/rest/v1/rpc/add_reward` ou `validate_deposit`.

## 💰 Parrainage (règle métier en vigueur)

**Aucun crédit** à l'inscription ni à la saisie d'un code : le parrain touche
`referral_commission_percent` (défaut **10 %**) du montant **réellement investi** par son
filleul, versé par `activate_plan()` → `credit_referral_commission()`
(migration `00022_referral_investment_commission.sql`).

## 🆘 En cas de doute sur l'état de la base

Exécuter `setup/00_full_setup.sql` : la base est ramenée à l'état exact attendu par le code
déployé (tables, fonctions, RLS, privilèges), sans perte de données.
