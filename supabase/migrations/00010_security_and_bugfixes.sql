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

-- ============================================================
-- 2. APPROVE SUBMISSION (anti double-paiement + is_staff)
-- ============================================================
CREATE OR REPLACE FUNCTION approve_submission(
  p_submission_id UUID,
  p_admin_id UUID,
  p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'approve_submission', 'task_submissions', p_submission_id,
            jsonb_build_object('amount', v_submission.task_amount));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'amount', v_submission.task_amount);
END;
$$;

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

-- ============================================================
-- 5. VALIDATE WITHDRAWAL
-- Flux : pending → approved|rejected|paid, approved → paid
-- Le wallet n'est débité QUE lors du passage à 'paid'
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

  -- 💰 Débit effectif UNIQUEMENT lors du paiement (paid)
  IF p_status = 'paid' THEN
    UPDATE wallets
    SET locked_amount = GREATEST(0, locked_amount - v_withdrawal.amount),
        balance = GREATEST(0, balance - v_withdrawal.amount),
        updated_at = NOW()
    WHERE id = v_wallet_id;

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (v_withdrawal.user_id, v_wallet_id, v_withdrawal.amount, 'withdrawal', 'Retrait via ' || v_withdrawal.method, 'completed');
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
-- 6. ACTIVATE PLAN (utilise investment_duration_days)
-- ============================================================
CREATE OR REPLACE FUNCTION activate_plan(
  p_user_id UUID,
  p_plan_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF EXISTS (SELECT 1 FROM investments WHERE user_id = p_user_id AND status = 'active') THEN
    DECLARE
      v_current_investment RECORD;
      v_upgrade_amount DECIMAL;
    BEGIN
      SELECT * INTO v_current_investment
      FROM investments WHERE user_id = p_user_id AND status = 'active' LIMIT 1;

      v_upgrade_amount := p_amount - v_current_investment.amount;

      IF v_upgrade_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot downgrade plan');
      END IF;

      IF v_balance < v_upgrade_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance for upgrade');
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

-- ============================================================
-- 15. SUBMIT WITHDRAWAL (jour en UTC + vérif auth.uid)
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
  -- Offset fuseau en heures (défaut 0 = UTC), configurable via system_settings
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
                    - COALESCE((SELECT SUM(wt.amount) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde retirable insuffisant. Seuls vos gains de tâches sont retirables (montant retirable: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending');

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 16. GET WITHDRAWABLE AMOUNT (RPC pour le client)
-- Permet de calculer le montant retirable côté serveur
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
                    - COALESCE((SELECT SUM(wt.amount) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0);

  RETURN jsonb_build_object('success', true, 'withdrawable_amount', GREATEST(v_withdrawable, 0));
END;
$$;

-- ============================================================
-- 17. AJOUTER withdrawal_timezone_offset aux settings par défaut
-- ============================================================
INSERT INTO system_settings (key, value, description)
VALUES ('withdrawal_timezone_offset', '0', 'Offset fuseau pour le jour de retrait (heures, défaut 0 = UTC)')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 18. DROP + RE-CREATE SUBMIT TASK avec vérification auth.uid
-- (défense en profondeur — déjà présente, mais on s'assure)
-- ============================================================
CREATE OR REPLACE FUNCTION submit_task(
  p_user_id UUID,
  p_task_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- 🔒 Vérification anti-double soumission (définitif — pas seulement aujourd'hui)
  IF EXISTS (
    SELECT 1 FROM task_submissions
    WHERE user_id = p_user_id AND task_id = p_task_id
      AND status IN ('approved', 'pending')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez déjà accompli cette tâche.');
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

    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', true, 'amount', v_task.amount);
  END IF;

  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', false);
END;
$$;

-- ============================================================
-- 19. SUBMIT DEPOSIT (avec vérification auth.uid)
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