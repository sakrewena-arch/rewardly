-- ============================================================
-- REWARDLY - CORRECTIFS SÉCURITÉ & FINANCE (août 2026)
-- ============================================================
-- À exécuter dans le SQL Editor Supabase (ou en migration).
-- Contenu :
--   1. RLS : suppression des politiques permissives sur wallets /
--      wallet_transactions (auto-crédit impossible pour l'utilisateur).
--   2. Trigger anti auto-promotion (role / is_active / is_banned protégés).
--   3. activate_plan : le montant débité = prix du plan (jamais arbitraire).
--   4. Calcul retirable COHÉRENT dans toutes les RPC :
--      gains - retraits payés - retraits pending/approuvés - services.
--   5. submit_withdrawal & submit_deposit : check auth.uid() (défense en profondeur).
--   6. request_withdrawal_feeexpay : règles métier (jour + délai) appliquées.
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- ============================================================
-- 1. RLS : supprimer les politiques dangereuses
-- ============================================================
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;
-- Un utilisateur ne peut plus créer/modifier ses dépôts/retraits directement :
-- tout passe par les RPC SECURITY DEFINER (submit_deposit, submit_withdrawal,
-- request_withdrawal_feeexpay, validate_deposit, validate_withdrawal).
DROP POLICY IF EXISTS "Users can create deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can update own deposits" ON public.deposits;
DROP POLICY IF EXISTS "Users can create withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Users can update own withdrawals" ON public.withdrawals;
-- ============================================================
-- 1bis. RLS PARRAINAGE : lecture liée + profils liés
-- ============================================================
-- Un utilisateur doit pouvoir lire SES parrainages (comme parrain OU
-- filleul) et le profil de ses filleuls / son parrain (pour les noms).
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can view referral-linked profiles" ON public.profiles;
CREATE POLICY "Users can view referral-linked profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.referrals r
      WHERE (
        (r.referrer_id = auth.uid() AND r.referred_id = profiles.user_id)
        OR
        (r.referred_id = auth.uid() AND r.referrer_id = profiles.user_id)
      )
    )
  );

-- ============================================================
-- 2. TRIGGER : bloquer la modification des champs sensibles du profil
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_security_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Un utilisateur AUTHENTIFIÉ (JWT présent) ne peut pas modifier les champs
  -- sensibles de son profil. Seul un admin (ou le service role) peut le faire.
  IF auth.uid() IS NOT NULL THEN
    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_active IS DISTINCT FROM OLD.is_active
        OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
        OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Modification non autorisée : rôle/statut protégés';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_security_changes ON public.profiles;
CREATE TRIGGER prevent_profile_security_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_security_changes();
-- ============================================================
-- 3. ACTIVATE PLAN : le montant débité = prix du plan (jamais arbitraire)
-- ============================================================
CREATE OR REPLACE FUNCTION activate_plan(
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
BEGIN
  -- 🔒 Vérification : seul l'utilisateur connecté peut activer un plan pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration_days;

  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
  END IF;

  -- 🔒 Le montant débité est TOUJOURS le prix du plan (paramètre ignoré)
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

      -- 🔧 UPGRADE : on ne débite que la DIFFÉRENCE (nouveau prix - déjà investi),
      -- pas le prix total du nouveau pack. Ex: pack 10 000 → 20 000 = 10 000 à débiter.
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
      VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'));

      BEGIN
        INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
        VALUES (p_user_id, v_wallet_id, v_upgrade_amount, 'investment', 'Upgrade vers ' || v_plan.name, 'completed');
      EXCEPTION WHEN OTHERS THEN NULL;
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
    VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'));

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, p_amount, 'investment', 'Activation pack ' || v_plan.name, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'upgrade', false);
  END IF;
END;
$$;
-- ============================================================
-- 4. SUBMIT DEPOSIT : check auth.uid (défense en profondeur)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_deposit(
  p_user_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_reference TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 🔒 Vérification : seul l'utilisateur connecté peut soumettre pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  INSERT INTO deposits (user_id, amount, method, reference, proof_url, status)
  VALUES (p_user_id, p_amount, p_method, p_reference, p_proof_url, 'pending');

  RETURN jsonb_build_object('success', true);
END;
$$;
-- ============================================================
-- 5. SUBMIT WITHDRAWAL : règles métier + calcul retirable cohérent
-- ============================================================
CREATE OR REPLACE FUNCTION submit_withdrawal(
  p_user_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_account_info TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL;
  v_withdrawal_id UUID;
  v_min_withdrawal DECIMAL;
  v_withdrawal_day INTEGER;
  v_timezone_offset INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
BEGIN
  -- 🔒 Vérification : seul l'utilisateur connecté peut soumettre pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  SELECT COALESCE((SELECT value::TEXT::NUMERIC FROM system_settings WHERE key = 'min_withdrawal'), 5000)
  INTO v_min_withdrawal;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'withdrawal_day'), 5)
  INTO v_withdrawal_day;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'withdrawal_timezone_offset'), 0)
  INTO v_timezone_offset;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration;

  -- 📅 Jour de retrait (UTC + offset configurable)
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC') + (v_timezone_offset * INTERVAL '1 hour')) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le jour configuré');
  END IF;

  -- ⏳ Délai minimum après le premier investissement
  SELECT * INTO v_last_investment FROM investments
  WHERE user_id = p_user_id
  ORDER BY start_date ASC
  LIMIT 1;

  IF FOUND THEN
    IF (NOW() - v_last_investment.start_date) < (v_investment_duration * INTERVAL '1 day') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Veuillez patienter ' || v_investment_duration || ' jours après votre investissement avant de pouvoir retirer vos gains'
      );
    END IF;
  END IF;

  IF p_amount < v_min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant minimum de retrait: ' || v_min_withdrawal::TEXT || ' FCFA');
  END IF;

  -- 💰 Montant retirable COHÉRENT : gains - retraits payés - retraits
  --    pending/approuvés - paiements services (aligné avec get_withdrawable_amount
  --    et request_withdrawal_feeexpay).
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;

  -- 💰 Solde total du wallet
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE à la demande (aucun second débit au passage à 'paid')
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  BEGIN
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
    VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal', 'Retrait via ' || p_method, 'pending', v_withdrawal_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'withdrawable_amount', v_withdrawable);
END;
$$;
-- ============================================================
-- 6. GET WITHDRAWABLE AMOUNT : calcul cohérent (gains - retraits - services)
-- ============================================================
CREATE OR REPLACE FUNCTION get_withdrawable_amount(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL;
BEGIN
  -- 🔒 Vérification : seul l'utilisateur connecté peut consulter son propre montant
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', true, 'withdrawable_amount', 0);
  END IF;

  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  RETURN jsonb_build_object('success', true, 'withdrawable_amount', GREATEST(v_withdrawable, 0));
END;
$$;
-- ============================================================
-- 7. REQUEST WITHDRAWAL FEEXPAY : règles métier + calcul cohérent
-- ============================================================
CREATE OR REPLACE FUNCTION request_withdrawal_feeexpay(
  p_user_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_account_info TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_withdrawable DECIMAL := 0;
  v_withdrawal_id UUID;
  v_role TEXT;
  v_withdrawal_day INTEGER;
  v_timezone_offset INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
BEGIN
  -- 🔒 Appel réservé au serveur (service_role)
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'withdrawal_day'), 5)
  INTO v_withdrawal_day;
  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'withdrawal_timezone_offset'), 0)
  INTO v_timezone_offset;
  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'investment_duration_days'), 7)
  INTO v_investment_duration;

  -- 📅 Jour de retrait (UTC + offset)
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC') + (v_timezone_offset * INTERVAL '1 hour')) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le jour configuré');
  END IF;

  -- ⏳ Délai minimum après le premier investissement
  SELECT * INTO v_last_investment FROM investments
  WHERE user_id = p_user_id
  ORDER BY start_date ASC
  LIMIT 1;
  IF FOUND THEN
    IF (NOW() - v_last_investment.start_date) < (v_investment_duration * INTERVAL '1 day') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Veuillez patienter ' || v_investment_duration || ' jours après votre investissement avant de pouvoir retirer vos gains'
      );
    END IF;
  END IF;

  -- 🔒 Verrouiller le wallet (anti course)
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_amount)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- 💰 Montant retirable cohérent (gains - retraits - services)
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE + demande + transaction (ATOMIQUE)
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal',
          COALESCE(p_description, 'Retrait via ' || p_method), 'pending', v_withdrawal_id);

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'withdrawable_amount', v_withdrawable
  );
END;
$$;

REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- 8. PRIVILÈGES D'EXÉCUTION des fonctions corrigées
-- ============================================================
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_withdrawable_amount(UUID) TO authenticated;
-- 🔒 Défense en profondeur : réserver les RPC financières user-facing au rôle
--    authenticated (l'anon ne doit PAS pouvoir les appeler).
REVOKE ALL ON FUNCTION activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_withdrawable_amount(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;