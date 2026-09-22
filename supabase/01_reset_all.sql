-- ============================================================
-- REWARDLY — RÉINITIALISATION COMPLÈTE (REPART À ZÉRO)
-- ============================================================
--   ⚠️⚠️  IRREVERSIBLE — faites une sauvegarde avant d'exécuter.
--
--   Effets :
--     1. Déconnecte TOUS les utilisateurs (sessions + refresh tokens purgés).
--     2. Supprime TOUTES les données : tâches, soumissions, wallets,
--        transactions, retraits, dépôts, notifications, parrainages,
--        investissements, commandes, logs, etc.
--     3. Supprime TOUS les comptes (auth.users) SAUF les administrateurs
--        (rôle 'admin' / 'super_admin' dans profiles).
--        → Les anciens utilisateurs devront CRÉER UN NOUVEAU COMPTE.
--
--   Conservés : les paramètres (system_settings), les moyens de paiement
--   (payment_methods) et les comptes admin.
--
--   Fichier IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- 0) Déconnecter tout le monde (sessions / refresh tokens)
DO $$
BEGIN
  -- ⚠️ TRUNCATE ... CASCADE requis : auth.refresh_tokens (et auth.mfa_amr_claims)
  -- possèdent une clé étrangère vers auth.sessions → un simple TRUNCATE échoue.
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    EXECUTE 'TRUNCATE auth.sessions CASCADE';
  END IF;
  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'TRUNCATE auth.refresh_tokens CASCADE';
  END IF;
END $$;

-- 1) Mémoriser les comptes admin à conserver
CREATE TEMP TABLE _keep_admins AS
  SELECT user_id AS id
  FROM public.profiles
  WHERE role IN ('admin', 'super_admin');

-- 2) Nettoyer les références croisées (parrainage)
UPDATE public.profiles SET referred_by = NULL;

-- 3) Vider toutes les tables de données (ordre logique)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'submission_answers',
    'submission_fields',
    'task_submissions',
    'service_orders',
    'wallet_transactions',
    'withdrawals',
    'deposits',
    'notifications',
    'referrals',
    'investments',
    'daily_statistics',
    'push_tokens',
    'user_preferences',
    'admin_logs',
    'tasks',
    'task_categories',
    'plans',
    'banners',
    'announcements'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('TRUNCATE public.%I CASCADE', t);
    END IF;
  END LOOP;
END $$;

-- 4) Supprimer wallets / profils des NON-admins
DELETE FROM public.wallets   WHERE user_id NOT IN (SELECT id FROM _keep_admins);
DELETE FROM public.profiles  WHERE user_id NOT IN (SELECT id FROM _keep_admins);

-- 5) Supprimer les comptes auth des NON-admins (identités + users)
DO $$
BEGIN
  IF to_regclass('auth.identities') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM _keep_admins)';
  END IF;
END $$;

DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM _keep_admins);

-- 6) Nettoyage
DROP TABLE _keep_admins;

-- 7) Vérification finale
DO $$
DECLARE
  v_users int;
BEGIN
  SELECT count(*) INTO v_users FROM auth.users;
  RAISE NOTICE 'Réinitialisation terminée. Utilisateurs restants (admins) : %', v_users;
END $$;