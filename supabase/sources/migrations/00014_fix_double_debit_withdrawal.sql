-- ============================================================
-- MIGRATION 00014 : CORRECTION DU DOUBLE DÉBIT DES RETRAITS FEEXPAY
-- ============================================================
-- Problème : /api/feexpay/payout débite le wallet À LA DEMANDE, puis
-- validate_withdrawal re-débitait le wallet au passage à 'paid'
-- → l'utilisateur perdait 2× le montant.
--
-- Correctif : le wallet n'est débité QU'UNE SEULE FOIS, À LA DEMANDE.
--  - validate_withdrawal : plus AUCUN débit sur balance au passage à 'paid' ;
--    il clôture seulement la transaction de débit liée (reference = id retrait).
--  - submit_withdrawal : débite aussi à la demande (cohérence des deux flux).
--  - get_withdrawable_amount : calcul avec ABS (les transactions de débit sont
--    désormais négatives ; les anciennes données positives restent supportées).
--
-- IDEMPOTENT : peut être exécuté plusieurs fois (CREATE OR REPLACE).
-- ============================================================

-- ============================================================
-- 1. VALIDATE WITHDRAWAL (corrigé : débit UNIQUE à la demande)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id UUID,
  p_status TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_withdrawal RECORD;
  v_wallet_id UUID;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- 🔒 Transitions autorisées
  IF v_withdrawal.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already paid');
  END IF;
  IF v_withdrawal.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already rejected');
  END IF;
  IF v_withdrawal.status = 'approved' AND p_status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal déjà approuvé — seul le passage à paid est possible');
  END IF;
  IF v_withdrawal.status = 'pending' AND p_status NOT IN ('approved', 'rejected', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide pour une soumission en attente');
  END IF;

  UPDATE withdrawals SET status = p_status, admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_withdrawal.user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, locked_amount) VALUES (v_withdrawal.user_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- 💰 Débit UNIQUE effectué À LA DEMANDE. Au passage à 'paid', on ne débite
  -- PLUS le wallet : on clôture la transaction de débit en attente.
  IF p_status = 'paid' THEN
    UPDATE wallets
    SET locked_amount = GREATEST(0, locked_amount - v_withdrawal.amount),
        updated_at = NOW()
    WHERE id = v_wallet_id;

    BEGIN
      UPDATE wallet_transactions
      SET status = 'completed'
      WHERE id = (
        SELECT id FROM wallet_transactions
        WHERE user_id = v_withdrawal.user_id
          AND type = 'withdrawal'
          AND status = 'pending'
          AND amount = -v_withdrawal.amount
          AND (reference = v_withdrawal.id OR reference IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_withdrawal.user_id, 'Retrait payé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été payé.', 'withdrawal');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSIF p_status = 'approved' THEN
    UPDATE wallets
    SET locked_amount = locked_amount + v_withdrawal.amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_withdrawal.user_id, 'Retrait approuvé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été approuvé. Paiement en cours.', 'withdrawal');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSIF p_status = 'rejected' THEN
    BEGIN
      -- Débit annulé : le montant réservé est remboursé côté application,
      -- la transaction de débit est marquée échouée.
      UPDATE wallet_transactions
      SET status = 'failed'
      WHERE id = (
        SELECT id FROM wallet_transactions
        WHERE user_id = v_withdrawal.user_id
          AND type = 'withdrawal'
          AND status = 'pending'
          AND amount = -v_withdrawal.amount
          AND (reference = v_withdrawal.id OR reference IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_withdrawal.user_id, 'Retrait refusé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été refusé.', 'withdrawal');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'validate_withdrawal_' || p_status, 'withdrawals', p_withdrawal_id,
            jsonb_build_object('amount', v_withdrawal.amount, 'comment', p_comment));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;
-- ============================================================
-- 2. SUBMIT WITHDRAWAL (corrigé : débit UNIQUE à la demande)
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
AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL;
  v_withdrawal_id UUID;
  v_withdrawal_day INTEGER;
  v_timezone_offset INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
  v_min_withdrawal DECIMAL;
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

  -- Jour calculé en UTC + offset configurable (évite les problèmes de fuseau serveur)
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC') + (v_timezone_offset * INTERVAL '1 hour')) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le jour configuré');
  END IF;

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

  -- 🔒 Seuls les gains (total_earnings) sont retirables, pas les dépôts ni le capital investi
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
                    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde retirable insuffisant. Seuls vos gains de tâches sont retirables (montant retirable: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;

  -- 💰 Vérifier que le solde du wallet couvre bien le retrait
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde insuffisant pour ce retrait'
    );
  END IF;

  -- 💰 Débit UNIQUE À LA DEMANDE (montant réservé immédiatement).
  -- validate_withdrawal ne débitera PLUS au passage à 'paid' → aucun double débit.
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  BEGIN
    -- Transaction de débit liée au retrait (retrouvée par validate_withdrawal)
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
    VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal', 'Retrait via ' || p_method, 'pending', v_withdrawal_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;
-- ============================================================
-- 3. GET WITHDRAWABLE AMOUNT (calcul avec ABS : transactions de débit négatives)
-- ============================================================
CREATE OR REPLACE FUNCTION get_withdrawable_amount(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
                    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0);

  RETURN jsonb_build_object('success', true, 'withdrawable_amount', GREATEST(v_withdrawable, 0));
END;
$$;