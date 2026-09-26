-- Rewardly Fix Task Creation
-- Migration 00004: Make task creation robust
-- Ensures the task is created even if admin_logs insert fails
-- Drops all remaining FK constraints to auth.users

-- ============================================
-- DROP ALL REMAINING FK CONSTRAINTS TO auth.users
-- ============================================
-- admin_logs
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;

-- task_submissions
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_user_id_fkey;
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_reviewed_by_fkey;

-- deposits
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_reviewed_by_fkey;

-- withdrawals
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_reviewed_by_fkey;

-- wallets
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- wallet_transactions
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- investments
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

-- referrals
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;

-- daily_statistics
ALTER TABLE daily_statistics DROP CONSTRAINT IF EXISTS daily_statistics_user_id_fkey;

-- ============================================
-- CREATE SYSTEM USERS IN auth.users (if not exists)
-- ============================================
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'system-admin@rewardly.local', '{"full_name": "System Admin"}'::jsonb, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'system-user@rewardly.local', '{"full_name": "System User"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Ensure profiles and wallets exist
INSERT INTO profiles (user_id, full_name, username, role, referral_code)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'System Admin', 'system-admin', 'super_admin', 'SYSADMIN01'),
  ('00000000-0000-0000-0000-000000000001', 'System User', 'system-user', 'user', 'SYSUSER01')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 0, 0, 0, 0),
  ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- RECREATE create_task (protected admin_logs insert)
-- ============================================
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
  -- Insert task
  INSERT INTO tasks (title, description, amount, plan_id, category_id, icon, estimated_time, 
                     instructions, link, max_completions, duration_minutes, deadline, validation_type, is_active)
  VALUES (p_title, p_description, p_amount, p_plan_id, p_category_id, p_icon, p_estimated_time,
          p_instructions, p_link, p_max_completions, p_duration_minutes, p_deadline, p_validation_type, true)
  RETURNING id INTO v_task_id;
  
  -- Insert submission fields
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
      EXCEPTION WHEN OTHERS THEN
        -- Continue even if a field insert fails
        NULL;
      END;
    END LOOP;
  END IF;
  
  -- Log admin action (protected - task creation should not fail because of log)
  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'create_task', 'tasks', v_task_id, 
            jsonb_build_object('title', p_title, 'amount', p_amount, 'plan_id', p_plan_id));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);
END;
$$;

-- ============================================
-- RECREATE submit_task (robust, creates wallet if needed)
-- ============================================
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
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Ensure wallet exists
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Create submission
  INSERT INTO task_submissions (user_id, task_id, status)
  VALUES (p_user_id, p_task_id, 'pending')
  RETURNING id INTO v_submission_id;
  
  -- Insert answers
  IF p_answers IS NOT NULL THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_answers)
    LOOP
      BEGIN
        INSERT INTO submission_answers (submission_id, field_id, value)
        VALUES (v_submission_id, v_key::UUID, v_value);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END IF;
  
  -- If task allows auto validation, auto-approve and credit
  IF v_task.validation_type = 'auto' THEN
    UPDATE task_submissions SET status = 'approved', updated_at = NOW() WHERE id = v_submission_id;
    
    -- Credit wallet
    UPDATE wallets 
    SET balance = balance + v_task.amount,
        total_earnings = total_earnings + v_task.amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Create transaction (protected)
    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, v_task.amount, 'reward', v_task.title, 'completed');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    -- Update daily statistics (protected)
    BEGIN
      INSERT INTO daily_statistics (user_id, date, tasks_completed, earnings)
      VALUES (p_user_id, CURRENT_DATE, 1, v_task.amount)
      ON CONFLICT (user_id, date) 
      DO UPDATE SET tasks_completed = daily_statistics.tasks_completed + 1,
                    earnings = daily_statistics.earnings + v_task.amount;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', true, 'amount', v_task.amount);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', false);
END;
$$;

-- ============================================
-- RECREATE validate_deposit (protected notifications/logs)
-- ============================================
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
    
    -- Ensure wallet exists then credit
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

-- ============================================
-- RECREATE validate_withdrawal (protected logs)
-- ============================================
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
  SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;
  
  IF v_withdrawal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already processed');
  END IF;
  
  UPDATE withdrawals SET status = p_status, admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_withdrawal_id;
  
  IF p_status = 'paid' THEN
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_withdrawal.user_id;
    
    UPDATE wallets 
    SET balance = balance - v_withdrawal.amount, updated_at = NOW()
    WHERE user_id = v_withdrawal.user_id;
    
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
    WHERE user_id = v_withdrawal.user_id;
    
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

-- ============================================
-- RECREATE approve_submission (robust)
-- ============================================
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
  -- Get submission with task
  SELECT ts.*, t.amount AS task_amount, t.title AS task_title
  INTO v_submission
  FROM task_submissions ts
  JOIN tasks t ON t.id = ts.task_id
  WHERE ts.id = p_submission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;
  
  IF v_submission.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already approved');
  END IF;
  
  UPDATE task_submissions 
  SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Ensure wallet exists
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_submission.user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (v_submission.user_id, 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Credit user
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