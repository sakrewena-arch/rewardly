-- ============================================================
-- REWARDLY - FIX : UPGRADE DE PACK + RLS PARRAINAGE
-- ============================================================
--   1. activate_plan : l'upgrade débite UNIQUEMENT la différence
--      (nouveau prix - investissement actuel), pas le prix total.
--   2. Politiques RLS sur referrals : un utilisateur peut lire SES
--      parrainages (en tant que parrain OU filleul) — indispensable
--      pour afficher les filleuls et le parrain dans le profil.
--   3. Colonne profiles.referred_by : re-créée si absente (lien vers le
--      parrain utilisé au moment de l'inscription).
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- ============================================================
-- 1. FIX ACTIVATE PLAN (upgrade = seule la différence est débitée)
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

GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- ============================================================
-- 2. RLS REFERRALS : lire SES parrainages (parrain OU filleul)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Le parrainage est créé par le trigger on_auth_user_created (SECURITY
-- DEFINER) ou par la Server Action applyReferralCodeAction (service role).
DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- ============================================================
-- 3. GARANTIR profiles.referred_by (si absente)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);
-- ============================================================
-- 4. RLS PROFILES : voir le profil de ses filleuls et de son parrain
-- ============================================================
-- Sans cette politique, la page Parrainage ne peut PAS lire le nom des
-- filleuls (RLS : seule lecture du profil personnel autorisée).
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