-- ============================================================
-- MIGRATION 00015 : PARRAINAGE ROBUSTE + OPÉRATIONS WALLET ATOMIQUES
-- ============================================================
-- 1. Codes de parrainage TOUJOURS uniques (générateur avec retry).
-- 2. Inscription via lien (?ref=CODE) → le filleul est enregistré comme
--    sous-affilié ET la commission du parrain est créditée IMMÉDIATEMENT
--    (plus besoin de ressaisir le code après inscription).
-- 3. request_withdrawal_feeexpay : demande de retrait ATOMIQUE.
--    Le montant est vérifié contre les GAINS retirables (jamais les dépôts
--    ni le capital), puis le wallet est débité, la demande créée et la
--    transaction enregistrée dans une SEULE transaction (SELECT FOR UPDATE).
--      → remplace le flux manuel /api/feexpay/payout (et son rollback bugué).
-- 4. credit_feeexpay_deposit : crédit de dépôt ATOMIQUE (anti double-crédit)
--    utilisé par /api/feexpay/deposit-status.
-- Ces 2 RPC sont réservées au rôle service_role (revoked from PUBLIC/anon/authenticated).
-- IDEMPOTENT : CREATE OR REPLACE / DROP IF EXISTS.
-- ============================================================

-- ============================================================
-- 1. GÉNÉRATEUR DE CODE DE PARRAINAGE UNIQUE
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================================
-- 2. TRIGGER D'INSCRIPTION (profil + wallet + parrainage + commission)
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
  v_commission numeric := 500;
  v_wallet_id uuid := NULL;
BEGIN
  -- 🔢 Code de parrainage unique garanti
  v_code := public.generate_unique_referral_code();

  -- 📥 Lire le code de parrainage fourni via le lien d'inscription (?ref=CODE)
  v_meta_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code', '');
  IF v_meta_code IS NOT NULL THEN
    SELECT p.id INTO v_referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = UPPER(v_meta_code)
      AND p.user_id <> NEW.id
    LIMIT 1;
  END IF;

  -- 👤 Créer le profil (avec code unique et éventuel parrain)
  INSERT INTO public.profiles (user_id, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_code,
    v_referrer_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, excluded.referral_code);

  -- 💰 Créer le wallet s'il manque
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 🎁 Si un parrain a été trouvé : référence + commission payée immédiatement
  IF v_referrer_id IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(s.value::text::numeric, 500) INTO v_commission
      FROM public.system_settings AS s
      WHERE s.key = 'referral_commission_fixed'
      LIMIT 1;

      -- Référence parrain → filleul
      INSERT INTO public.referrals (referrer_id, referred_id, commission, status)
      VALUES (v_referrer_id, NEW.id, v_commission, 'paid')
      ON CONFLICT (referred_id) DO UPDATE
        SET commission = COALESCE(public.referrals.commission, excluded.commission);

      -- Wallet du parrain
      SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_referrer_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance, locked_amount)
        VALUES (v_referrer_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;

      -- 💸 Créditer la commission (balance + gains retirables)
      UPDATE public.wallets
      SET balance = balance + v_commission,
          total_earnings = total_earnings + v_commission,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      -- 📒 Traçabilité
      INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (v_referrer_id, v_wallet_id, v_commission, 'referral',
              'Commission de parrainage (inscription via lien)', 'completed');

      -- 🔔 Notification
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_referrer_id, 'Nouveau filleul 🎉',
              'Un utilisateur s''est inscrit avec votre code de parrainage ! +' || v_commission::TEXT || ' FCFA',
              'referral');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ne jamais bloquer la création d'un utilisateur
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
-- 3. RETRAIT FEEXPAY ATOMIQUE (limité aux GAINS — pas les dépôts/capital)
-- ============================================================
CREATE OR REPLACE FUNCTION public.request_withdrawal_feeexpay(
  p_user_id uuid,
  p_amount numeric,
  p_method text,
  p_account_info text,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_withdrawable numeric := 0;
  v_withdrawal_id uuid;
  v_role text;
BEGIN
  -- 🔒 Appel réservé au serveur (service_role). Un utilisateur (anon/authenticated)
  -- ne peut PAS déclencher ce retrait directement.
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  -- 🔒 Verrouiller le wallet (anti course)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- 💰 Montant retirable = gains (total_earnings)
  --    - retraits déjà payés - retraits en attente/approuvés
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
      - COALESCE((SELECT SUM(ABS(wt.amount)) FROM public.wallet_transactions wt
                  WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
      - COALESCE((SELECT SUM(w.amount) FROM public.withdrawals w
                  WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)');
  END IF;

  -- 💰 Solde total suffisant ?
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE + création de la demande + transaction (ATOMIQUE)
  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal',
          COALESCE(p_description, 'Retrait via ' || p_method), 'pending', v_withdrawal_id);

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'withdrawable_amount', v_withdrawable
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) TO service_role;

-- ============================================================
-- 4. CRÉDIT DE DÉPÔT FEEXPAY ATOMIQUE (anti double-crédit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_feeexpay_deposit(
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_role text;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'error', 'Non autorisé');
  END IF;

  -- 🔒 Verrouiller la ligne de dépôt recherchée (dernière occurrence)
  SELECT * INTO v_deposit
  FROM public.deposits
  WHERE reference = p_reference
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'reason', 'not_found');
  END IF;

  IF v_deposit.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'creditable', false, 'reason', 'already_credited');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'reason', 'rejected');
  END IF;

  -- 🔒 Verrouiller le wallet du déposant
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount)
    VALUES (v_deposit.user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- ✅ Statut approuvé + crédit + traçabilité + notification (une transaction)
  UPDATE public.deposits
  SET status = 'approved', updated_at = NOW()
  WHERE id = v_deposit.id;

  UPDATE public.wallets
  SET balance = balance + v_deposit.amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (v_deposit.user_id, v_wallet.id, v_deposit.amount, 'deposit',
          'Dépôt via FeeXPay (' || p_reference || ')', 'completed', p_reference);

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_deposit.user_id, 'Dépôt confirmé ✅',
          'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été crédité automatiquement.', 'deposit');

  RETURN jsonb_build_object('success', true, 'creditable', true, 'credited', true);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.credit_feeexpay_deposit(text) TO service_role;