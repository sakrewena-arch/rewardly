# 📜 Historique des migrations (déjà appliquées)

Ce dossier est **historique** : ces fichiers ont été exécutés sur la base au fil du
développement. Ils servent de **source** au générateur et ne doivent **pas** être exécutés
individuellement — utilisez le fichier unique
[`../../INSTALL.sql`](../../INSTALL.sql) (état final complet, idempotent).

| # | Fichier | Apport principal |
|---|---|---|
| 00001 | `initial_schema.sql` | tables, index, seed `system_settings`, `handle_new_user` |
| 00002 | `platform_management.sql` | stats admin, `get_users_with_details`, RLS |
| 00003 | `system_users.sql` | utilisateurs système |
| 00004 | `fix_task_creation.sql` | correction `create_task` |
| 00005 | `public_select_policies.sql` | policies publiques (⚠️ ré-ouvertes puis refermées par 00008) |
| 00006 | `cleanup_data.sql` | nettoyage de données |
| 00007 | `cleanup_and_admin.sql` | nettoyage + admin |
| 00008 | `restore_rls_policies.sql` | **restauration RLS** (`is_admin`, `is_staff`) |
| 00009 | `feexpay_integration.sql` | intégration FeeXPay |
| 00010 | `security_and_bugfixes.sql` | **gardes admin** sur les RPC, anti double-paiement |
| 00011 | `user_preferences.sql` | table `user_preferences` |
| 00012 | `service_orders.sql` | table `service_orders` |
| 00013 | `service_transaction_type.sql` | type de transaction `service` |
| 00014 | `fix_double_debit_withdrawal.sql` | retrait débité une seule fois |
| 00015 | `referral_atomic_wallet.sql` | wallet atomique + `credit_feeexpay_deposit` |
| 00016 | `push_tokens.sql` | table `push_tokens` (FCM) |
| 00017 | `security_fixes.sql` | RLS wallets/transactions, trigger anti auto-promotion |
| 00018 | `reminder_notifications.sql` | notifications de rappel |
| 00019 | `task_reward_notifications.sql` | récompenses de tâches + `submit_task` |
| 00020 | `ensure_wallet_columns.sql` | colonnes wallet garanties |
| 00021 | `fix_upgrade_and_referrals.sql` | upgrade de pack + parrainage |
| 00022 | `referral_investment_commission.sql` | **parrainage = 10 % de l'investissement** |
| 00023 | `restore_default_plans.sql` | **rétablit/active les packs** Bronze, Silver, Gold (et les catégories de tâches) |

## Ajouter une migration

1. Créer `00023_ton_correctif.sql` (idempotent : `CREATE OR REPLACE`, `IF NOT EXISTS`,
   `DROP … IF EXISTS`).
2. Régénérer le fichier unique :
   ```powershell
   npm run db:build
   ```
3. Exécuter `../../INSTALL.sql` sur la base (Supabase → SQL Editor → Run).
4. Committer **les deux** (la migration + `INSTALL.sql`).

> ℹ️ Les anciens lots de debug (`dbg/01..07_fonctions.sql`) et le doublon
> `security_fixes.sql` ont été **supprimés** : ils contenaient des versions périmées
> (parrainage basé sur les *gains*, RPC sans garde admin) qui auraient écrasé l'état actuel.
> Pour revenir à une version antérieure, utilisez l'historique Git.
