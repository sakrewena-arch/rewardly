-- ============================================================
-- MIGRATION 00024 : GARANTIR UN PROFIL ET UN WALLET POUR CHAQUE COMPTE
-- ============================================================
-- POURQUOI
--   Un compte Supabase (auth.users) peut exister SANS ligne dans
--   `profiles` (ou sans `wallets`) — par exemple après l'exécution d'un
--   ancien script de nettoyage, ou si le trigger d'inscription n'a pas pu
--   s'exécuter. Conséquences dans l'application :
--     • connexion impossible / profil vide ;
--     • vérification du rôle admin KO → « Ce compte n'est pas autorisé à
--       accéder à l'administration » ;
--     • aucun portefeuille affiché.
--
-- CE QUE FAIT CE SCRIPT (idempotent, NON destructif : aucune suppression)
--   1. crée le profil manquant de chaque compte existant (role = 'user') ;
--   2. crée le wallet manquant de chaque compte existant.
--   Le profil admin est ensuite rétabli par le seed « SET ADMIN ROLE »
--   (email configuré dans supabase/sources/base_schema.sql).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Profils manquants (code de parrainage unique calculé sans dépendance)
-- ------------------------------------------------------------
INSERT INTO public.profiles (user_id, full_name, username, role, referral_code, is_active, is_banned)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), 'Utilisateur'),
  NULL,
  'user',
  UPPER(SUBSTRING(MD5(u.id::TEXT || 'rewardly') FROM 1 FOR 8)),
  true,
  false
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);

-- ------------------------------------------------------------
-- 2. Wallets manquants
-- ------------------------------------------------------------
INSERT INTO public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
SELECT u.id, 0, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = u.id);

-- ------------------------------------------------------------
-- 3. Contrôle : comptes sans profil (doit renvoyer 0 ligne)
-- ------------------------------------------------------------
SELECT u.email AS compte_sans_profil
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id);
