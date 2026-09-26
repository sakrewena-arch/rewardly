# 🛠️ Scripts d'exploitation — ⚠️ DANGER

Ces scripts ne font **pas** partie de l'installation (fichier unique
[`../INSTALL.sql`](../INSTALL.sql)). À exécuter **manuellement**, jamais dans le cadre
d'une mise à jour normale.

| Fichier | Effet | Risque |
|---|---|---|
| `reset_platform.sql` | **Efface** utilisateurs, wallets, transactions, dépôts, retraits… et remet les plans/catégories par défaut | 🔴 destruction de données |
| `recreate_plans_categories.sql` | (Re)crée les **plans** (Bronze/Silver/Gold) et **catégories** de tâches | 🟡 écrase les libellés/prix existants |
| `demo/` | Habille **un compte** (dépôt 20 000 Togo, ancienneté, historique de retraits) — voir `demo/README.md` | 🟢 données fictives, sans notification |
| `00006_cleanup_data.sql`, `00007_cleanup_and_admin.sql` | Anciens scripts de nettoyage **destructeurs** (suppriment profils/wallets/transactions) | 🔴 **ne jamais** exécuter en production |

## Bonnes pratiques

1. **Sauvegarde d'abord** : Supabase → Database → Backups (ou `pg_dump`).
2. Préférer un **projet Supabase de test** pour ces scripts.
3. Après un `reset_platform.sql`, rétablir l'état attendu par l'application :
   exécuter [`../INSTALL.sql`](../INSTALL.sql).

> 🧹 Scripts **supprimés** car inutiles/dangereux en production :
> `load_test_account.sql`, `load_test_transactions.sql` (données fictives) et
> `inject_deposit.sql` (créditait un wallet sans paiement réel). L'historique Git les conserve.
