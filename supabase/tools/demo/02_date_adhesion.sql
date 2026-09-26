-- ============================================================
-- ②  DATE D'ADHÉSION DU MEMBRE → 13 JUILLET 2024
-- ============================================================
-- Compte ciblé : wlagbema@gmail.com
--
-- L'application affiche « Membre depuis {profiles.created_at} »
-- (page Profil) → c'est donc `profiles.created_at` qu'il faut changer.
--
-- ⚠️ À exécuter AVANT l'historique des retraits (③), pour que celui-ci
--    commence après la date d'adhésion.
--
-- ✅ Idempotent : réexécutable sans effet de bord.
-- ============================================================

DO $$
DECLARE
  v_email   text        := 'wlagbema@gmail.com';
  -- ⚙️ Date d'adhésion souhaitée (heure de matinée, réaliste)
  v_join    timestamptz := '2024-07-13 09:24:00+00';
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable : %', v_email;
  END IF;

  UPDATE public.profiles
  SET created_at = v_join,
      updated_at = v_join
  WHERE user_id = v_user_id;

  -- (facultatif) même date côté Supabase Auth, pour que le tableau de bord
  -- Supabase affiche la même ancienneté. Décommentez si vous le souhaitez :
  -- UPDATE auth.users SET created_at = v_join WHERE id = v_user_id;

  RAISE NOTICE '✅ Adhésion de % fixée au %', v_email, v_join;
END $$;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
SELECT u.email,
       p.created_at AS membre_depuis,
       p.role,
       p.is_active
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'wlagbema@gmail.com';
