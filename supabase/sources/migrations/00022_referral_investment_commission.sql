-- ============================================================
-- MIGRATION 00022 : PARRAINAGE = 10% DE L'INVESTISSEMENT DU FILLEUL
-- ============================================================
-- PROBLÈME CORRIGÉ
--   Avant : dès qu'un utilisateur s'inscrivait avec un code de parrainage
--   (ou saisissait le code après inscription), le parrain recevait
--   AUTOMATIQUEMENT 500 FCFA (system_settings.referral_commission_fixed),
--   même si le filleul n'investissait jamais.
--
--   Après : AUCUN crédit à l'inscription / à la saisie du code.
--   Le parrain touche `referral_commission_percent` % (défaut 10%) du
--   MONTANT RÉELLEMENT INVESTI par son filleul, au moment où celui-ci
--   active (ou upgrade) un pack -> fonction activate_plan().
--     • activation d'un pack 10 000  -> parrain +1 000
--     • upgrade 10 000 -> 20 000     -> parrain +1 000 (soit 10% des
--       10 000 réellement investis en plus, pas du prix total)
--     • filleul qui n'investit pas   -> parrain +0
--
-- CONTENU
--   1. rewardly_handle_new_user()      : relation de parrainage SANS crédit
--   2. credit_referral_commission()    : crédit générique (%), anti-doublon
--   3. activate_plan()                 : appelle le crédit sur l'investissement
--   4. system_settings                 : referral_commission_percent = 10
--   5. REVOKE/GRANT                    : la fonction de commission n'est
--      appelable QUE par les fonctions serveur (service_role), jamais par
--      un client anon/authenticated (anti auto-crédit).
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- ============================================================
-- 0. Colonnes de réglage (sécurité : la clé doit exister)
-- ============================================================
INSERT INTO public.system_settings (key, value, description)
VALUES ('referral_commission_percent', '10'::jsonb, 'Pourcentage de parrainage sur l''investissement du filleul')
ON CONFLICT (key) DO NOTHING;

-- Passe l'ancienne valeur (5%) à 10% ; laisse toute autre valeur choisie par l'admin.
UPDATE public.system_settings
SET value = '10'::jsonb, updated_at = NOW()
WHERE key = 'referral_commission_percent'
  AND COALESCE(value::text, '') IN ('5', '"5"');

-- La commission fixe n'est plus utilisée par le parrainage (conservée pour
-- compatibilité de l'écran admin / de la validation Zod).
INSERT INTO public.system_settings (key, value, description)
VALUES ('referral_commission_fixed', '0'::jsonb, 'OBSOLÈTE : plus utilisée (parrainage = % de l''investissement)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 1. INSCRIPTION : enregistrer la relation, NE RIEN CRÉDITER
-- ============================================================
CREATE OR REPLACE FUNCTION public.rewardly_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_code text := NULL;
  v_meta_code text := NULL;
  v_referrer_id uuid := NULL;
BEGIN
  -- 🔢 Code de parrainage unique garanti
  v_code := public.generate_unique_referral_code();

  -- 📥 Code fourni via le lien d'inscription (?ref=CODE)
  v_meta_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code', '');
  IF v_meta_code IS NOT NULL THEN
    SELECT p.id INTO v_referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = UPPER(v_meta_code)
      AND p.user_id <> NEW.id
    LIMIT 1;
  END IF;

  -- 👤 Profil (code unique + éventuel parrain)
  INSERT INTO public.profiles (user_id, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_code,
    v_referrer_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, excluded.referral_code),
        referred_by   = COALESCE(public.profiles.referred_by, excluded.referred_by);

  -- 💰 Wallet s'il manque
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 🤝 Relation de parrainage UNIQUEMENT (0 FCFA à l'inscription).
  --    La commission (10% de l'investissement) est versée par activate_plan().
  IF v_referrer_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.referrals (referrer_id, referred_id, commission, status)
      VALUES (
        (SELECT p.user_id FROM public.profiles p WHERE p.id = v_referrer_id),
        NEW.id,
        0,
        'pending'
      )
      ON CONFLICT (referred_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ne jamais bloquer la création d'un compte
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rewardly_handle_new_user();


-- ============================================================
-- 2. CRÉDIT DE COMMISSION (sur l'investissement du filleul)
-- ============================================================
-- Fonction GÉNÉRIQUE : `p_amount` = base de calcul (ici le montant
-- investi par le filleul). Le pourcentage vient de system_settings
-- (`referral_commission_percent`, défaut 10).
-- Anti-doublon : une seule commission par source (p_source_id).
CREATE OR REPLACE FUNCTION public.credit_referral_commission(
  p_user_id UUID,     -- id (auth.users) du filleul qui investit
  p_amount NUMERIC,   -- montant investi par le filleul
  p_source_id UUID    -- id de l'investissement (source unique du crédit)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_referrer_id uuid := NULL;
  v_percent numeric := 10;
  v_commission numeric := 0;
  v_wallet_id uuid := NULL;
  v_already boolean := false;
BEGIN
  -- 🔒 Parrain du filleul (relation de parrainage)
  SELECT referrer_id INTO v_referrer_id
  FROM public.referrals
  WHERE referred_id = p_user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN; -- pas de parrain : rien à faire
  END IF;

  -- 📊 Pourcentage configuré (10% par défaut)
  SELECT COALESCE(
           NULLIF(
             TRIM(BOTH '"' FROM (SELECT s.value::text FROM public.system_settings s
                                 WHERE s.key = 'referral_commission_percent' LIMIT 1)),
             ''
           )::numeric,
           10
         )
  INTO v_percent;

  IF v_percent IS NULL OR v_percent <= 0 THEN
    RETURN;
  END IF;

  -- 💰 Commission = % du montant investi (arrondi à l'unité inférieure)
  v_commission := FLOOR(COALESCE(p_amount, 0) * v_percent / 100.0);
  IF v_commission <= 0 THEN
    RETURN;
  END IF;

  -- 🔒 Anti-doublon : déjà crédité pour cette source ?
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = v_referrer_id
      AND type = 'referral'
      AND reference = 'referral_' || p_source_id::TEXT
  ) INTO v_already;
  IF v_already THEN
    RETURN;
  END IF;

  -- 💰 Wallet du parrain (créé si manquant)
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_referrer_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount)
    VALUES (v_referrer_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- 💸 Créditer le parrain (solde + gains retirables)
  UPDATE public.wallets
  SET balance = balance + v_commission,
      total_earnings = total_earnings + v_commission,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 📒 Traçabilité
  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, amount, type, description, status, reference
  )
  VALUES (
    v_referrer_id, v_wallet_id, v_commission, 'referral',
    FLOOR(v_percent)::TEXT || '% de l''investissement de votre filleul',
    'completed',
    'referral_' || p_source_id::TEXT
  );

  -- 🔄 Mettre à jour le cumul de la relation de parrainage
  UPDATE public.referrals
  SET commission = COALESCE(commission, 0) + v_commission,
      status = 'paid'
  WHERE referred_id = p_user_id;

  -- 🔔 Notification du parrain
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_referrer_id,
      'Commission de parrainage 🎉',
      'Votre filleul a investi ' || FLOOR(COALESCE(p_amount, 0))::TEXT || ' FCFA — vous recevez '
        || v_commission::TEXT || ' FCFA (' || FLOOR(v_percent)::TEXT || '%).',
      'referral'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- ============================================================
-- 3. ACTIVATION DE PACK : verser 10% au parrain (sur l'investissement)
-- ============================================================
-- Reprend la version sécurisée existante (le montant débité = PRIX DU PLAN,
-- jamais le paramètre client) et ajoute la commission de parrainage.
CREATE OR REPLACE FUNCTION public.activate_plan(
  p_user_id UUID,
  p_plan_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet_id UUID;
  v_plan RECORD;
  v_balance DECIMAL;
  v_investment_duration_days INTEGER;
  v_new_investment_id UUID;
BEGIN
  -- 🔒 seul l'utilisateur connecté peut activer un plan pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration_days;

  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
  END IF;

  -- 🔒 Le montant débité est le PRIX DU PLAN (paramètre client ignoré)
  p_amount := v_plan.price;

  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  IF EXISTS (SELECT 1 FROM investments WHERE user_id = p_user_id AND status = 'active') THEN
    DECLARE
      v_current_investment RECORD;
      v_upgrade_amount DECIMAL;
    BEGIN
      SELECT * INTO v_current_investment
      FROM investments WHERE user_id = p_user_id AND status = 'active' LIMIT 1;

      -- 🔧 UPGRADE : on ne débite que la DIFFÉRENCE (nouveau prix - déjà investi)
      v_upgrade_amount := v_plan.price - v_current_investment.amount;

      IF v_upgrade_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot downgrade plan');
      END IF;

      IF v_balance < v_upgrade_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour l''upgrade. Il vous manque ' || (v_upgrade_amount - v_balance)::TEXT || ' FCFA.');
      END IF;

      UPDATE wallets
      SET balance = balance - v_upgrade_amount,
          invested_capital = invested_capital + v_upgrade_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      UPDATE investments SET status = 'cancelled', updated_at = NOW()
      WHERE id = v_current_investment.id;

      INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
      VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'))
      RETURNING id INTO v_new_investment_id;

      BEGIN
        INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
        VALUES (p_user_id, v_wallet_id, v_upgrade_amount, 'investment', 'Upgrade vers ' || v_plan.name, 'completed');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      -- 🎁 PARRAINAGE : 10% du montant RÉELLEMENT investi (la différence)
      BEGIN
        PERFORM public.credit_referral_commission(p_user_id, v_upgrade_amount, v_new_investment_id);
      EXCEPTION WHEN OTHERS THEN NULL; -- ne doit jamais bloquer l'activation
      END;

      RETURN jsonb_build_object('success', true, 'upgrade', true, 'upgrade_amount', v_upgrade_amount);
    END;
  ELSE
    -- 🆕 Nouvelle activation : la balance doit couvrir le prix TOTAL du pack
    IF v_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour activer ce pack. Il vous manque ' || (p_amount - v_balance)::TEXT || ' FCFA.');
    END IF;

    UPDATE wallets SET balance = balance - p_amount, invested_capital = invested_capital + p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
    VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'))
    RETURNING id INTO v_new_investment_id;

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, p_amount, 'investment', 'Activation pack ' || v_plan.name, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 🎁 PARRAINAGE : 10% du montant investi par le filleul
    BEGIN
      PERFORM public.credit_referral_commission(p_user_id, p_amount, v_new_investment_id);
    EXCEPTION WHEN OTHERS THEN NULL; -- ne doit jamais bloquer l'activation
    END;

    RETURN jsonb_build_object('success', true, 'upgrade', false);
  END IF;
END;
$$;



-- ============================================================
-- 4. PRIVILÈGES
-- ============================================================
-- activate_plan reste appelable par l'utilisateur connecté (il débite SON
-- propre wallet, contrôlé par auth.uid()).
GRANT EXECUTE ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM anon;

-- 🔒 credit_referral_commission ne doit JAMAIS être appelable depuis un
-- client (sinon un utilisateur pourrait se créditer une commission) :
-- réservée aux fonctions serveur (SECURITY DEFINER) et au service_role.
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) TO service_role;

-- ============================================================
-- 5. AUDIT (optionnel) — anciennes commissions de 500 FCFA
-- ============================================================
-- Cette migration ne supprime AUCUN historique : les commissions fixes
-- déjà versées restent visibles. Pour les inspecter :
--
--   SELECT wt.created_at, wt.user_id AS parrain, wt.amount, wt.description
--   FROM public.wallet_transactions wt
--   WHERE wt.type = 'referral' AND wt.amount = 500
--   ORDER BY wt.created_at DESC;
--
-- Pour annuler un crédit (à faire au cas par cas) :
--
--   UPDATE public.wallets SET balance = balance - 500,
--                             total_earnings = GREATEST(0, total_earnings - 500)
--   WHERE user_id = '<PARRAIN_UUID>';
--   UPDATE public.wallet_transactions SET status = 'failed' WHERE id = '<TX_UUID>';
-- ============================================================
