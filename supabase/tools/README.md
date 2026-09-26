# 🛠️ Scripts d'exploitation — ⚠️ DANGER

Ces scripts ne font **pas** partie de l'installation. Ils sont à exécuter **manuellement**
et **jamais** sur la production (sauf `recreate_plans_categories.sql`).

| Fichier | Effet | Risque |
|---|---|---|
| `reset_platform.sql` | **Efface** utilisateurs, wallets, transactions, dépôts, retraits… et remet les plans/catégories par défaut | 🔴 destruction de données |
| `recreate_plans_categories.sql` | (Re)crée les **plans** (Bronze/Silver/Gold) et **catégories** de tâches | 🟡 écrase les libellés/prix existants |
| `load_test_account.sql` | Crée un compte de test avec wallet garni | 🟡 données fictives en base |
| `load_test_transactions.sql` | Génère un historique de transactions fictif | 🟡 fausse les statistiques |
| `inject_deposit.sql` | Injecte un dépôt approuvé | 🔴 crédite un wallet sans paiement réel |

## Bonnes pratiques

1. **Sauvegarde d'abord** : Supabase → Database → Backups (ou `pg_dump`).
2. Préférer un **projet Supabase de test** pour ces scripts.
3. `reset_platform.sql` était dupliqué à l'identique en `reset_soft.sql` : le doublon a été
   supprimé (l'historique Git le conserve).

Après un `reset_platform.sql`, l'état attendu par l'application est rétabli par
[`../setup/00_full_setup.sql`](../setup/00_full_setup.sql).
