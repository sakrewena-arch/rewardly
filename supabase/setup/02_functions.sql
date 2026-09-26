-- ======================================================================
-- REWARDLY — FONCTIONS — 34 fonctions (état final dédupliqué)   (étape 2/4)
-- GÉNÉRÉ par scripts/build-supabase-setup.mjs — NE PAS ÉDITER À LA MAIN.
-- Modifier supabase/migrations/, puis régénérer.
-- Dernière version de chaque fonction selon l'ordre des migrations.
-- ======================================================================

-- [supabase/migrations/00015_referral_atomic_wallet.sql:1]
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

-- [supabase/migrations/00022_referral_investment_commission.sql:1]
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

-- [supabase/migrations/00001_initial_schema.sql:418]
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- HELPER FUNCTION: Check if user is moderator or admin
-- ============================================
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'moderator')
  );
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- MIGRATION 00010 : Correctifs sécurité et bugs
-- Corrige :
--   1. add_reward → restriction admin/service role (anti auto-crédit)
--   2. approve_submission → anti double-paiement (rejected → approved impossible)
--   3. approve_submission/reject_submission → vérification is_staff() dans la RPC
--   4. validate_deposit → vérification is_admin() dans la RPC
--   5. validate_withdrawal → transitions propres (pending→approved|rejected|paid, approved→paid)
--                           + vérification is_admin() dans la RPC
--   6. activate_plan → utilise investment_duration_days de system_settings
--   7. create_task → utilise p_category_id (bug)
--   8. submit_withdrawal → jour calculé en UTC avec offset configurable
--   9. delete_user/ban_user → vérification is_admin() dans la RPC
--  10. create_task/update_task/delete_task/create_plan/toggle_plan_status/update_plan
--      → vérification is_admin() dans la RPC (défense en profondeur)
--  11. DROP + RE-CREATE des RPC avec SECURITY INVOKER pour add_reward/submit_* 
--      → les RPC utilisateurs vérifient auth.uid() en leur sein
-- ============================================================

-- ============================================================
-- 1. ADD REWARD (sécurisé : admin ou service role uniquement)
-- ============================================================
CREATE OR REPLACE FUNCTION add_reward(
  p_user_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance DECIMAL;
BEGIN
  -- 🔒 Si c'est un utilisateur authentifié (pas service role), vérifier admin
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  UPDATE wallets
  SET balance = balance + p_amount,
      total_earnings = total_earnings + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
  VALUES (p_user_id, v_wallet_id, p_amount, 'reward', p_description, 'completed');

  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'new_balance', v_balance + p_amount);
END;
$$;

-- [supabase/migrations/00019_task_reward_notifications.sql:1]
-- ============================================================
-- REWARDLY - NOTIFICATIONS DE RÉCOMPENSE DE TÂCHES (août 2026)
-- ============================================================
-- Ajoute une notification in-app à chaque récompense de tâche :
--   1. submit_task (validation AUTO) → "Tâche récompensée ✅"
--   2. approve_submission (validation MANUELLE) → "Tâche approuvée ✅"
-- IDEMPOTENT : CREATE OR REPLACE, exécutable plusieurs fois.
-- ============================================================

-- ============================================================
-- 1. SUBMIT TASK (avec notification sur validation auto)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_task(
  p_user_id UUID,
  p_task_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_task RECORD;
  v_submission_id UUID;
  v_wallet_id UUID;
  v_key TEXT;
  v_value TEXT;
  v_plan RECORD;
  v_daily_limit INTEGER;
  v_completed_today INTEGER;
  v_investment RECORD;
BEGIN
  -- 🔒 Vérification : seul l'utilisateur connecté peut soumettre pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;

  -- 🔒 Vérification : l'utilisateur doit avoir un pack actif (investissement)
  SELECT * INTO v_investment FROM investments
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY start_date DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun pack actif. Activez un pack pour accomplir des tâches.');
  END IF;

  -- 🔒 Vérification : le pack n'est pas expiré
  IF v_investment.end_date < NOW() THEN
    UPDATE investments SET status = 'completed', updated_at = NOW()
    WHERE id = v_investment.id;
    RETURN jsonb_build_object('success', false, 'error', 'Pack expiré. Veuillez en activer un nouveau.');
  END IF;

  -- 🔒 Vérification : la tâche est accessible au plan de l'utilisateur
  IF v_task.plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM plans WHERE id = v_task.plan_id;
    IF v_plan.id != v_investment.plan_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette tâche ne correspond pas à votre pack.');
    END IF;
  END IF;

  -- 🔒 Vérification anti-double soumission (aujourd'hui)
  IF EXISTS (
    SELECT 1 FROM task_submissions
    WHERE user_id = p_user_id AND task_id = p_task_id
      AND status IN ('approved', 'pending')
      AND created_at >= CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez déjà accompli cette tâche aujourd''hui.');
  END IF;

  -- 🔒 Vérification limite quotidienne de tâches du plan
  SELECT daily_tasks INTO v_daily_limit FROM plans WHERE id = v_investment.plan_id;
  IF v_daily_limit IS NOT NULL AND v_daily_limit != -1 THEN
    SELECT COUNT(*) INTO v_completed_today
    FROM task_submissions ts
    JOIN tasks t ON t.id = ts.task_id
    WHERE ts.user_id = p_user_id
      AND ts.status IN ('approved', 'pending')
      AND ts.created_at >= CURRENT_DATE
      AND (t.plan_id = v_investment.plan_id OR t.plan_id IS NULL);

    IF v_completed_today >= v_daily_limit THEN
      RETURN jsonb_build_object('success', false, 'error', 'Limite quotidienne de ' || v_daily_limit || ' tâches atteinte.');
    END IF;
  END IF;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  INSERT INTO task_submissions (user_id, task_id, status)
  VALUES (p_user_id, p_task_id, 'pending')
  RETURNING id INTO v_submission_id;

  IF p_answers IS NOT NULL THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_answers)
    LOOP
      BEGIN
        INSERT INTO submission_answers (submission_id, field_id, value)
        VALUES (v_submission_id, v_key::UUID, v_value);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;

  IF v_task.validation_type = 'auto' THEN
    UPDATE task_submissions SET status = 'approved', updated_at = NOW() WHERE id = v_submission_id;

    UPDATE wallets
    SET balance = balance + v_task.amount,
        total_earnings = total_earnings + v_task.amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, v_task.amount, 'reward', v_task.title, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO daily_statistics (user_id, date, tasks_completed, earnings)
      VALUES (p_user_id, CURRENT_DATE, 1, v_task.amount)
      ON CONFLICT (user_id, date)
      DO UPDATE SET tasks_completed = daily_statistics.tasks_completed + 1,
                    earnings = daily_statistics.earnings + v_task.amount;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 🔔 Notification de récompense (tâche auto)
    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (p_user_id, 'Tâche récompensée ✅',
              'Vous avez gagné ' || v_task.amount::TEXT || ' FCFA pour la tâche : ' || v_task.title,
              'reward');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', true, 'amount', v_task.amount);
  END IF;

  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', false);
END;
$$;

-- [supabase/migrations/00019_task_reward_notifications.sql:1]
-- ============================================================
-- 2. APPROVE SUBMISSION (avec notification sur validation manuelle)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_submission(
  p_submission_id UUID,
  p_admin_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_submission RECORD;
  v_wallet_id UUID;
BEGIN
  -- 🔒 Vérification : staff uniquement (admin, super_admin, moderator)
  IF auth.uid() IS NOT NULL AND NOT is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT ts.*, t.amount AS task_amount, t.title AS task_title
  INTO v_submission
  FROM task_submissions ts
  JOIN tasks t ON t.id = ts.task_id
  WHERE ts.id = p_submission_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;

  -- 🔒 Anti double-paiement : seule une soumission "pending" peut être approuvée
  IF v_submission.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already approved');
  END IF;
  IF v_submission.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette soumission a été refusée. Une nouvelle soumission est requise.');
  END IF;

  UPDATE task_submissions
  SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_submission_id;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_submission.user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (v_submission.user_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  UPDATE wallets
  SET balance = balance + v_submission.task_amount,
      total_earnings = total_earnings + v_submission.task_amount,
      updated_at = NOW()
  WHERE user_id = v_submission.user_id;

  BEGIN
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
    VALUES (v_submission.user_id, v_wallet_id, v_submission.task_amount, 'reward', v_submission.task_title, 'completed');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO daily_statistics (user_id, date, tasks_completed, earnings)
    VALUES (v_submission.user_id, CURRENT_DATE, 1, v_submission.task_amount)
    ON CONFLICT (user_id, date)
    DO UPDATE SET tasks_completed = daily_statistics.tasks_completed + 1,
                  earnings = daily_statistics.earnings + v_submission.task_amount;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 🔔 Notification de récompense (tâche manuelle approuvée)
  BEGIN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_submission.user_id, 'Tâche approuvée ✅',
            'Votre soumission pour « ' || v_submission.task_title || ' » a été approuvée. +' || v_submission.task_amount::TEXT || ' FCFA crédités.',
            'reward');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'approve_submission', 'task_submissions', p_submission_id,
            jsonb_build_object('amount', v_submission.task_amount));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'amount', v_submission.task_amount);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 3. REJECT SUBMISSION (is_staff)
-- ============================================================
CREATE OR REPLACE FUNCTION reject_submission(
  p_submission_id UUID,
  p_admin_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : staff uniquement
  IF auth.uid() IS NOT NULL AND NOT is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE task_submissions
  SET status = 'rejected', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_submission_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'reject_submission', 'task_submissions', p_submission_id,
            jsonb_build_object('comment', p_comment));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 4. VALIDATE DEPOSIT (is_admin dans la RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION validate_deposit(
  p_deposit_id UUID,
  p_admin_id UUID,
  p_approve BOOLEAN,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit RECORD;
  v_wallet_id UUID;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;

  IF v_deposit.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already processed');
  END IF;

  IF p_approve THEN
    UPDATE deposits SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
    WHERE id = p_deposit_id;

    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_deposit.user_id;
    IF v_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id, balance) VALUES (v_deposit.user_id, 0)
      RETURNING id INTO v_wallet_id;
    END IF;

    UPDATE wallets
    SET balance = balance + v_deposit.amount, updated_at = NOW()
    WHERE user_id = v_deposit.user_id;

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (v_deposit.user_id, v_wallet_id, v_deposit.amount, 'deposit', 'Dépôt via ' || v_deposit.method, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_deposit.user_id, 'Dépôt approuvé', 'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été approuvé et crédité.', 'deposit');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSE
    UPDATE deposits SET status = 'rejected', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
    WHERE id = p_deposit_id;

    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_deposit.user_id, 'Dépôt refusé', 'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été refusé.', 'deposit');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, CASE WHEN p_approve THEN 'approve_deposit' ELSE 'reject_deposit' END, 'deposits', p_deposit_id,
            jsonb_build_object('amount', v_deposit.amount, 'comment', p_comment));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00014_fix_double_debit_withdrawal.sql:1]
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

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 13. BAN USER (is_admin dans la RPC)
-- ============================================================
CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID,
  p_admin_id UUID,
  p_ban BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE profiles SET is_banned = p_ban, is_active = NOT p_ban, updated_at = NOW()
  WHERE user_id = p_user_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, CASE WHEN p_ban THEN 'ban_user' ELSE 'unban_user' END, 'profiles',
            (SELECT id FROM profiles WHERE user_id = p_user_id),
            jsonb_build_object('banned', p_ban));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 14. DELETE USER (is_admin dans la RPC + gestion d'erreurs)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Interdire la suppression de soi-même (un admin ne peut pas se supprimer)
  IF p_user_id = p_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un administrateur ne peut pas supprimer son propre compte');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_user_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'delete_user', 'profiles', v_profile_id,
            jsonb_build_object('user_id', p_user_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Suppression en cascade : profiles, wallets, puis auth.users
  DELETE FROM profiles WHERE user_id = p_user_id;
  DELETE FROM wallets WHERE user_id = p_user_id;

  -- Supprimer l'utilisateur auth (peut échouer si l'utilisateur n'existe plus)
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- L'utilisateur auth n'existe peut-être pas (déjà supprimé) — ce n'est pas bloquant
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00022_referral_investment_commission.sql:115]
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

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 7. CREATE TASK (corrige bug p_category_id jamais utilisé)
-- ============================================================
CREATE OR REPLACE FUNCTION create_task(
  p_admin_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_amount DECIMAL,
  p_plan_id UUID,
  p_category_id UUID DEFAULT NULL,
  p_icon TEXT DEFAULT '📋',
  p_estimated_time INTEGER DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_max_completions INTEGER DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_deadline TIMESTAMPTZ DEFAULT NULL,
  p_validation_type TEXT DEFAULT 'auto',
  p_fields JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_field JSONB;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  INSERT INTO tasks (title, description, amount, plan_id, category_id, icon, estimated_time,
                     instructions, link, max_completions, duration_minutes, deadline, validation_type, is_active)
  VALUES (p_title, p_description, p_amount, p_plan_id, p_category_id, p_icon, p_estimated_time,
          p_instructions, p_link, p_max_completions, p_duration_minutes, p_deadline, p_validation_type, true)
  RETURNING id INTO v_task_id;

  IF p_fields IS NOT NULL AND jsonb_array_length(p_fields) > 0 THEN
    FOR v_field IN SELECT * FROM jsonb_array_elements(p_fields)
    LOOP
      BEGIN
        INSERT INTO submission_fields (task_id, title, description, field_type, is_required, placeholder, max_size, sort_order)
        VALUES (
          v_task_id,
          v_field->>'title',
          v_field->>'description',
          v_field->>'field_type',
          COALESCE((v_field->>'is_required')::BOOLEAN, true),
          v_field->>'placeholder',
          NULLIF(v_field->>'max_size', '')::INTEGER,
          COALESCE((v_field->>'sort_order')::INTEGER, 0)
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END IF;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'create_task', 'tasks', v_task_id,
            jsonb_build_object('title', p_title, 'amount', p_amount, 'plan_id', p_plan_id, 'category_id', p_category_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 8. UPDATE TASK (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION update_task(
  p_admin_id UUID,
  p_task_id UUID,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_amount DECIMAL DEFAULT NULL,
  p_plan_id UUID DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_estimated_time INTEGER DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_max_completions INTEGER DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_deadline TIMESTAMPTZ DEFAULT NULL,
  p_validation_type TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE tasks SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    amount = COALESCE(p_amount, amount),
    plan_id = COALESCE(p_plan_id, plan_id),
    icon = COALESCE(p_icon, icon),
    estimated_time = COALESCE(p_estimated_time, estimated_time),
    instructions = COALESCE(p_instructions, instructions),
    link = COALESCE(p_link, link),
    max_completions = COALESCE(p_max_completions, max_completions),
    duration_minutes = COALESCE(p_duration_minutes, duration_minutes),
    deadline = COALESCE(p_deadline, deadline),
    validation_type = COALESCE(p_validation_type, validation_type),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_task_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'update_task', 'tasks', p_task_id, jsonb_build_object('title', p_title));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 9. DELETE TASK (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_task(
  p_admin_id UUID,
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  DELETE FROM tasks WHERE id = p_task_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id)
    VALUES (p_admin_id, 'delete_task', 'tasks', p_task_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 10. CREATE PLAN (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION create_plan(
  p_admin_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_price DECIMAL,
  p_daily_tasks INTEGER,
  p_min_profitability DECIMAL,
  p_max_profitability DECIMAL,
  p_color TEXT DEFAULT '#9D3FE7',
  p_icon TEXT DEFAULT 'Medal',
  p_badge TEXT DEFAULT 'Standard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  INSERT INTO plans (name, slug, price, daily_tasks, min_profitability, max_profitability, color, icon, badge)
  VALUES (p_name, p_slug, p_price, p_daily_tasks, p_min_profitability, p_max_profitability, p_color, p_icon, p_badge)
  RETURNING id INTO v_plan_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'create_plan', 'plans', v_plan_id, jsonb_build_object('name', p_name, 'price', p_price));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'plan_id', v_plan_id);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 11. TOGGLE PLAN STATUS (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_plan_status(
  p_admin_id UUID,
  p_plan_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE plans SET is_active = p_is_active, updated_at = NOW() WHERE id = p_plan_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'toggle_plan', 'plans', p_plan_id, jsonb_build_object('is_active', p_is_active));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 12. UPDATE PLAN (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION update_plan(
  p_admin_id UUID,
  p_plan_id UUID,
  p_name TEXT DEFAULT NULL,
  p_price DECIMAL DEFAULT NULL,
  p_daily_tasks INTEGER DEFAULT NULL,
  p_min_profitability DECIMAL DEFAULT NULL,
  p_max_profitability DECIMAL DEFAULT NULL,
  p_color TEXT DEFAULT NULL,
  p_icon TEXT DEFAULT NULL,
  p_badge TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE plans SET
    name = COALESCE(p_name, name),
    price = COALESCE(p_price, price),
    daily_tasks = COALESCE(p_daily_tasks, daily_tasks),
    min_profitability = COALESCE(p_min_profitability, min_profitability),
    max_profitability = COALESCE(p_max_profitability, max_profitability),
    color = COALESCE(p_color, color),
    icon = COALESCE(p_icon, icon),
    badge = COALESCE(p_badge, badge),
    updated_at = NOW()
  WHERE id = p_plan_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'update_plan', 'plans', p_plan_id, jsonb_build_object('name', p_name));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/migrations/00002_platform_management.sql:1]  << garde admin ajoutée automatiquement
-- ============================================
-- GET PLATFORM STATS (admin dashboard)
-- ============================================
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_users INTEGER;
  v_total_deposits DECIMAL;
  v_total_withdrawals DECIMAL;
  v_total_earnings DECIMAL;
  v_total_investments DECIMAL;
  v_pending_deposits INTEGER;
  v_pending_withdrawals INTEGER;
  v_pending_submissions INTEGER;
  v_plans_with_users JSONB;
BEGIN
  -- 🔒 Réservé aux administrateurs (défense en profondeur)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  SELECT COUNT(*) INTO v_total_users FROM profiles WHERE role = 'user';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits FROM deposits WHERE status = 'approved';
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals FROM withdrawals WHERE status = 'paid';
  SELECT COALESCE(SUM(total_earnings), 0) INTO v_total_earnings FROM wallets;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_investments FROM investments WHERE status = 'active';
  
  SELECT COUNT(*) INTO v_pending_deposits FROM deposits WHERE status = 'pending';
  SELECT COUNT(*) INTO v_pending_withdrawals FROM withdrawals WHERE status = 'pending';
  SELECT COUNT(*) INTO v_pending_submissions FROM task_submissions WHERE status = 'pending';
  
  -- Get users per plan
  SELECT jsonb_agg(plan_data ORDER BY plan_order)
  INTO v_plans_with_users
  FROM (
    SELECT 
      jsonb_build_object(
        'plan_id', p.id,
        'plan_name', p.name,
        'plan_slug', p.slug,
        'plan_price', p.price,
        'user_count', COUNT(DISTINCT i.user_id)
      ) AS plan_data,
      p.sort_order AS plan_order
    FROM plans p
    LEFT JOIN investments i ON i.plan_id = p.id AND i.status = 'active'
    GROUP BY p.id, p.name, p.slug, p.price, p.sort_order
    ORDER BY p.sort_order
  ) sub;
  
  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'total_deposits', v_total_deposits,
    'total_withdrawals', v_total_withdrawals,
    'total_earnings', v_total_earnings,
    'total_investments', v_total_investments,
    'pending_deposits', v_pending_deposits,
    'pending_withdrawals', v_pending_withdrawals,
    'pending_submissions', v_pending_submissions,
    'plans_with_users', COALESCE(v_plans_with_users, '[]'::JSONB)
  );
END;
$$;

-- [supabase/migrations/00002_platform_management.sql:1]  << garde admin ajoutée automatiquement
-- ============================================
-- GET USERS WITH DETAILS (admin - filter by plan)
-- ============================================
CREATE OR REPLACE FUNCTION get_users_with_details(
  p_plan_slug TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 🔒 Réservé aux administrateurs (défense en profondeur)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
  SELECT jsonb_agg(user_data ORDER BY user_data->>'created_at' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'user_id', u.id,
      'email', u.email,
      'full_name', p.full_name,
      'username', p.username,
      'phone', p.phone,
      'role', p.role,
      'is_active', p.is_active,
      'is_banned', p.is_banned,
      'created_at', p.created_at,
      'profile_id', p.id,
      'balance', COALESCE(w.balance, 0),
      'total_earnings', COALESCE(w.total_earnings, 0),
      'invested_capital', COALESCE(w.invested_capital, 0),
      'locked_amount', COALESCE(w.locked_amount, 0),
      'plan', CASE 
        WHEN i.id IS NOT NULL THEN jsonb_build_object(
          'id', i.plan_id,
          'name', pl.name,
          'slug', pl.slug,
          'amount', i.amount,
          'start_date', i.start_date,
          'end_date', i.end_date
        )
        ELSE NULL
      END,
      'deposit_count', (SELECT COUNT(*) FROM deposits d WHERE d.user_id = u.id AND d.status = 'approved'),
      'total_deposits', COALESCE((SELECT SUM(d.amount) FROM deposits d WHERE d.user_id = u.id AND d.status = 'approved'), 0),
      'withdrawal_count', (SELECT COUNT(*) FROM withdrawals wd WHERE wd.user_id = u.id AND wd.status = 'paid'),
      'total_withdrawals', COALESCE((SELECT SUM(wd.amount) FROM withdrawals wd WHERE wd.user_id = u.id AND wd.status = 'paid'), 0),
      'tasks_completed', (SELECT COUNT(*) FROM task_submissions ts WHERE ts.user_id = u.id AND ts.status = 'approved')
    ) AS user_data
    FROM auth.users u
    JOIN profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    LEFT JOIN investments i ON i.user_id = u.id AND i.status = 'active'
    LEFT JOIN plans pl ON pl.id = i.plan_id
    WHERE (p_plan_slug IS NULL OR pl.slug = p_plan_slug)
  ) sub;
  
  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

-- [supabase/migrations/00017_security_fixes.sql:87]
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

-- [supabase/migrations/00017_security_fixes.sql:87]
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

-- [supabase/migrations/00017_security_fixes.sql:87]
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

-- [supabase/migrations/00015_referral_atomic_wallet.sql:217]
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

-- [supabase/migrations/00017_security_fixes.sql:47]
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

-- [supabase/migrations/00017_security_fixes.sql:87]
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

-- [supabase/migrations/00001_initial_schema.sql:394]
-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8))
  );
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [supabase/migrations/00011_user_preferences.sql:1]
-- Trigger pour mettre à jour updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- [supabase/migrations/00011_user_preferences.sql:43]
-- ============================================================
-- Fonction RPC pour upsert les préférences (évite les conflits)
-- ============================================================
create or replace function public.upsert_user_preferences(
  p_language text,
  p_currency text,
  p_push_notifications boolean,
  p_email_notifications boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, language, currency, push_notifications, email_notifications)
  values (auth.uid(), p_language, p_currency, p_push_notifications, p_email_notifications)
  on conflict (user_id)
  do update set
    language = excluded.language,
    currency = excluded.currency,
    push_notifications = excluded.push_notifications,
    email_notifications = excluded.email_notifications,
    updated_at = now();
end;
$$;

-- [supabase/migrations/00012_service_orders.sql:47]
-- ============================================================
-- Fonction RPC pour créer une commande + débiter le wallet
-- ============================================================
create or replace function public.create_service_order(
  p_company_name text,
  p_contact_email text,
  p_contact_phone text,
  p_service_type text,
  p_description text,
  p_pack text,
  p_pack_amount numeric,
  p_duration text,
  p_target_users integer,
  p_url text default null,
  p_download_url text default null,
  p_questions text default null,
  p_ia_url text default null,
  p_app_name text default null,
  p_game_name text default null,
  p_site_name text default null,
  p_instructions text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_balance numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Non authentifié');
  end if;

  -- Vérifier le solde du wallet
  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  limit 1;

  if v_wallet_id is null then
    return json_build_object('success', false, 'error', 'Wallet introuvable');
  end if;

  if v_balance < p_pack_amount then
    return json_build_object('success', false, 'error', 'Solde insuffisant. Rechargez votre wallet.');
  end if;

  -- Débiter le wallet
  update public.wallets
  set balance = balance - p_pack_amount,
      updated_at = now()
  where id = v_wallet_id;

  -- Créer la transaction
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
  values (v_user_id, v_wallet_id, -p_pack_amount, 'service', 'Paiement pack ' || p_pack || ' - ' || p_service_type, 'completed');

  -- Créer la commande
  insert into public.service_orders (
    user_id, company_name, contact_email, contact_phone,
    service_type, description, pack, pack_amount, duration, target_users,
    url, download_url, questions, ia_url, app_name, game_name, site_name, instructions,
    status, payment_status
  ) values (
    v_user_id, p_company_name, p_contact_email, p_contact_phone,
    p_service_type, p_description, p_pack, p_pack_amount, p_duration, p_target_users,
    p_url, p_download_url, p_questions, p_ia_url, p_app_name, p_game_name, p_site_name, p_instructions,
    'pending', 'paid'
  ) returning id into v_order_id;

  return json_build_object('success', true, 'order_id', v_order_id);
end;
$$;

-- [supabase/migrations/00016_push_tokens.sql:38]
-- Trigger pour maintenir updated_at
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- [supabase/migrations/00022_referral_investment_commission.sql:115]
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
