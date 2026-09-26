# 🎬 Scripts de données « réalistes » (compte de démonstration)

Ces 3 scripts habillent **un compte précis** (`wlagbema@gmail.com`) comme un membre
ancien et actif : dépôt Mobile Money, ancienneté, historique de gains et de retraits.

> ⚠️ Données **fictives** : à n'utiliser que sur **votre** base (démo / présentation).
> Ils ne touchent **jamais** aux autres comptes, et ne créent **aucune notification**.

## Ordre d'exécution (important)

| # | Fichier | Effet |
|---|---|---|
| **①** | `01_depot_20000_togocom.sql` | Dépôt de **20 000 FCFA** depuis **TOGOCOM (Togo)**, approuvé + crédité au wallet |
| **②** | `02_date_adhesion.sql` | Date d'adhésion → **13 juillet 2024** (« Membre depuis » sur le profil) |
| **③** | `03_historique_retraits.sql` | **~2 ans** de gains de tâches + **2 à 3 retraits par mois** payés (TOGOCOM / MOOV) |

```text
②  →  ①  →  ③      (la date d'adhésion doit être posée AVANT de générer l'historique)
```

## Résultat attendu après ③ (valeurs de contrôle affichées à la fin)

| Indicateur | Valeur constatée en test |
|---|---|
| Retraits payés | **61** sur ~26 mois (13/08/2024 → 21/09/2026) |
| Rythme | **2 à 3 par mois**, dates irrégulières |
| Total retiré | **579 000 FCFA** |
| Gains cumulés | **923 700 FCFA** (≈ 62 % déjà retirés → cohérent) |
| Solde / retirable | **364 700 FCFA** (dont le dépôt de 20 000) |

## Caractéristiques

- ✅ **Idempotents** : les lignes générées portent la référence `DEMO-…` ; elles sont
  supprimées puis régénérées (jamais les vraies données). Graine fixe → même historique
  à chaque exécution, **aucun doublon**.
- ✅ **Sans notification** : les scripts écrivent directement les transactions
  (contrairement aux flux de l'app qui notifient).
- ✅ **Cohérents avec l'application** : `wallet_transactions` (retraits **négatifs**,
  statut `completed`) alimentent « Transactions récentes » et « Historique » ; le
  portefeuille est recalculé (`solde = dépôts + gains − investi − retiré`).
- ✅ **Réalistes** : opérateurs du Togo (`TOGOCOM TG`, `MOOV TG`), numéros togolais
  (indicatif 228), montants arrondis (5 000 → 13 000 en retrait, 800 → 2 500 en gain),
  libellés de missions variés (visite de site, sondage, partage, vidéo…).

## Personnalisation

Dans `01_depot_20000_togocom.sql` (bloc `DECLARE`) :

```sql
v_amount numeric := 20000;                    -- montant du dépôt
v_method text    := 'TOGOCOM TG';             -- ou 'MOOV TG'
v_phone  text    := '22890421876';            -- numéro Togo
v_date   timestamptz := (CURRENT_DATE - INTERVAL '12 days') + INTERVAL '18 hours 47 minutes';
```

Dans `02_date_adhesion.sql` : `v_join timestamptz := '2024-07-13 09:24:00+00';`

Dans `03_historique_retraits.sql` : `v_mois_max` (fenêtre), `setseed(...)` (rejouer un
autre tirage), et les lignes `v_amount := …` pour les fourchettes de montants.

## Vérifié

Ces scripts ont été **exécutés pour de vrai** (PostgreSQL 18 jetable imitant Supabase) :
`INSTALL.sql` 3× + les 3 scripts 2× → **aucune erreur**, aucune duplication.
