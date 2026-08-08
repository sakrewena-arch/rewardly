-- Rewardly Platform Management
-- Migration 00002: RPC Functions for platform operations

-- ============================================
-- ADD REWARD (credit user balance after task completion)
-- ============================================
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
  -- Get user wallet
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Update balance + earnings
  UPDATE wallets 
  SET balance = balance + p_amount,
      total_earnings = total_earnings + p_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
  VALUES (p_user_id, v_wallet_id, p_amount, 'reward', p_description, 'completed');
  
  RETURN jsonb_build_object('success', true, 'wallet_id', v_wallet_id, 'new_balance', v_balance + p_amount);
END;
$$;

-- ============================================
-- SUBMIT TASK (create submission with answers)
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
  v_auto_approve BOOLEAN DEFAULT false;
  v_answer JSONB;
  v_key TEXT;
  v_value TEXT;
BEGIN
  -- Get task details
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Task not found');
  END IF;
  
  -- Active pack check removed (public access)
  
  -- Check daily completion limit
  IF NOT EXISTS (
    SELECT 1 FROM task_submissions 
    WHERE user_id = p_user_id 
      AND status IN ('pending', 'approved') 
      AND created_at >= CURRENT_DATE
  ) THEN
    -- First submission today, check if user has remaining quota
    NULL;
  END IF;
  
  -- Create submission
  INSERT INTO task_submissions (user_id, task_id, status)
  VALUES (p_user_id, p_task_id, 'pending')
  RETURNING id INTO v_submission_id;
  
  -- Insert answers
  IF p_answers IS NOT NULL THEN
    FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_answers)
    LOOP
      INSERT INTO submission_answers (submission_id, field_id, value)
      VALUES (
        v_submission_id, 
        v_key::UUID,
        v_value
      );
    END LOOP;
  END IF;
  
  -- If task allows auto validation, auto-approve and credit
  IF v_task.validation_type = 'auto' THEN
    UPDATE task_submissions SET status = 'approved', updated_at = NOW() WHERE id = v_submission_id;
    UPDATE wallets 
    SET balance = balance + v_task.amount,
        total_earnings = total_earnings + v_task.amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
    SELECT p_user_id, id, v_task.amount, 'reward', v_task.title, 'completed'
    FROM wallets WHERE user_id = p_user_id;
    
    -- Update daily statistics
    INSERT INTO daily_statistics (user_id, date, tasks_completed, earnings)
    VALUES (p_user_id, CURRENT_DATE, 1, v_task.amount)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET tasks_completed = daily_statistics.tasks_completed + 1,
                  earnings = daily_statistics.earnings + v_task.amount;
    
    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', true, 'amount', v_task.amount);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', false);
END;
$$;

-- ============================================
-- APPROVE SUBMISSION (manual validation by admin)
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
  -- Get submission with task (single record with joined columns)
  SELECT ts.*, t.amount AS task_amount, t.title AS task_title
  INTO v_submission
  FROM task_submissions ts
  JOIN tasks t ON t.id = ts.task_id
  WHERE ts.id = p_submission_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission not found');
  END IF;
  
  -- Check if already approved
  IF v_submission.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Submission already approved');
  END IF;
  
  -- Update submission
  UPDATE task_submissions 
  SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_submission_id;
  
  -- Find or create wallet
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_submission.user_id;
  
  -- Credit user
  UPDATE wallets 
  SET balance = balance + v_submission.task_amount,
      total_earnings = total_earnings + v_submission.task_amount,
      updated_at = NOW()
  WHERE user_id = v_submission.user_id;
  
  -- Create transaction
  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
  VALUES (v_submission.user_id, v_wallet_id, v_submission.task_amount, 'reward', v_submission.task_title, 'completed');
  
  -- Update daily statistics
  INSERT INTO daily_statistics (user_id, date, tasks_completed, earnings)
  VALUES (v_submission.user_id, CURRENT_DATE, 1, v_submission.task_amount)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET tasks_completed = daily_statistics.tasks_completed + 1,
                earnings = daily_statistics.earnings + v_submission.task_amount;
  
  -- Log admin action
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'approve_submission', 'task_submissions', p_submission_id, 
          jsonb_build_object('amount', v_submission.task_amount));
  
  RETURN jsonb_build_object('success', true, 'amount', v_submission.task_amount);
END;
$$;

-- ============================================
-- REJECT SUBMISSION
-- ============================================
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
  UPDATE task_submissions 
  SET status = 'rejected', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_submission_id;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'reject_submission', 'task_submissions', p_submission_id, 
          jsonb_build_object('comment', p_comment));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- VALIDATE DEPOSIT (approve deposit + credit balance)
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
BEGIN
  SELECT * INTO v_deposit FROM deposits WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  
  IF v_deposit.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already processed');
  END IF;
  
  IF p_approve THEN
    -- Approve deposit
    UPDATE deposits SET status = 'approved', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
    WHERE id = p_deposit_id;
    
    -- Credit user wallet
    UPDATE wallets 
    SET balance = balance + v_deposit.amount, updated_at = NOW()
    WHERE user_id = v_deposit.user_id;
    
    -- Create transaction
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
    SELECT v_deposit.user_id, id, v_deposit.amount, 'deposit', 'Dépôt via ' || v_deposit.method, 'completed'
    FROM wallets WHERE user_id = v_deposit.user_id;
    
    -- Create notification
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_deposit.user_id, 'Dépôt approuvé', 'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été approuvé et crédité.', 'deposit');
  ELSE
    -- Reject deposit
    UPDATE deposits SET status = 'rejected', admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
    WHERE id = p_deposit_id;
    
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_deposit.user_id, 'Dépôt refusé', 'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été refusé.', 'deposit');
  END IF;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, CASE WHEN p_approve THEN 'approve_deposit' ELSE 'reject_deposit' END, 'deposits', p_deposit_id,
          jsonb_build_object('amount', v_deposit.amount, 'comment', p_comment));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- VALIDATE WITHDRAWAL (approve, mark paid, or reject)
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
    -- Deduct from wallet balance
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_withdrawal.user_id;
    
    UPDATE wallets 
    SET balance = balance - v_withdrawal.amount, updated_at = NOW()
    WHERE user_id = v_withdrawal.user_id;
    
    -- Create transaction
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
    VALUES (v_withdrawal.user_id, v_wallet_id, v_withdrawal.amount, 'withdrawal', 'Retrait via ' || v_withdrawal.method, 'completed');
    
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_withdrawal.user_id, 'Retrait payé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été payé.', 'withdrawal');
  ELSIF p_status = 'approved' THEN
    -- Lock the amount
    UPDATE wallets 
    SET locked_amount = locked_amount + v_withdrawal.amount, updated_at = NOW()
    WHERE user_id = v_withdrawal.user_id;
    
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_withdrawal.user_id, 'Retrait approuvé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été approuvé. Paiement en cours.', 'withdrawal');
  ELSIF p_status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_withdrawal.user_id, 'Retrait refusé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été refusé.', 'withdrawal');
  END IF;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'validate_withdrawal_' || p_status, 'withdrawals', p_withdrawal_id,
          jsonb_build_object('amount', v_withdrawal.amount, 'comment', p_comment));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- BAN USER
-- ============================================
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
  UPDATE profiles SET is_banned = p_ban, is_active = NOT p_ban, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, CASE WHEN p_ban THEN 'ban_user' ELSE 'unban_user' END, 'profiles', 
          (SELECT id FROM profiles WHERE user_id = p_user_id),
          jsonb_build_object('banned', p_ban));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- DELETE USER (ban first, then delete profile/wallet/data)
-- ============================================
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Ban user
  UPDATE profiles SET is_banned = true, is_active = false, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log before deletion
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'delete_user', 'profiles', 
          (SELECT id FROM profiles WHERE user_id = p_user_id),
          jsonb_build_object('user_id', p_user_id));
  
  -- Delete user data (cascade will handle the rest)
  DELETE FROM profiles WHERE user_id = p_user_id;
  DELETE FROM wallets WHERE user_id = p_user_id;
  
  -- Option: delete auth user
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- CREATE INVESTMENT (activate a plan)
-- ============================================
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
BEGIN
  -- Get plan
  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
  END IF;
  
  -- Get user wallet (create if not exists)
  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;
  
  -- Check enough balance
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Check for existing active investment
  IF EXISTS (SELECT 1 FROM investments WHERE user_id = p_user_id AND status = 'active') THEN
    -- Check if upgrading
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
      
      -- Deduct upgrade amount
      IF v_balance < v_upgrade_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance for upgrade');
      END IF;
      
      UPDATE wallets SET balance = balance - v_upgrade_amount, updated_at = NOW()
      WHERE id = v_wallet_id;
      
      -- Cancel old investment, create new
      UPDATE investments SET status = 'cancelled', updated_at = NOW()
      WHERE id = v_current_investment.id;
      
      INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
      VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + INTERVAL '7 days');
      
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, v_upgrade_amount, 'investment', 'Upgrade vers ' || v_plan.name, 'completed');
      
      RETURN jsonb_build_object('success', true, 'upgrade', true, 'upgrade_amount', v_upgrade_amount);
    END;
  ELSE
    -- New investment
    UPDATE wallets SET balance = balance - p_amount, invested_capital = invested_capital + p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;
    
    INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
    VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + INTERVAL '7 days');
    
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
    VALUES (p_user_id, v_wallet_id, p_amount, 'investment', 'Activation pack ' || v_plan.name, 'completed');
    
    RETURN jsonb_build_object('success', true, 'upgrade', false);
  END IF;
END;
$$;

-- ============================================
-- CREATE TASK (admin function to create tasks with fields)
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
  -- Admin role check removed (public access)
  
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
    END LOOP;
  END IF;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'create_task', 'tasks', v_task_id, 
          jsonb_build_object('title', p_title, 'amount', p_amount, 'plan_id', p_plan_id));
  
  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);
END;
$$;

-- ============================================
-- UPDATE TASK
-- ============================================
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
DECLARE
BEGIN
  -- Admin role check removed (public access)
  
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
  WHERE id = p_task_id AND is_active = true;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'update_task', 'tasks', p_task_id, jsonb_build_object('title', p_title));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- DELETE TASK
-- ============================================
CREATE OR REPLACE FUNCTION delete_task(
  p_admin_id UUID,
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- Admin role check removed (public access)
  
  DELETE FROM tasks WHERE id = p_task_id;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id)
  VALUES (p_admin_id, 'delete_task', 'tasks', p_task_id);
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- CREATE PLAN (admin function)
-- ============================================
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
  -- Admin role check removed (public access)
  
  INSERT INTO plans (name, slug, price, daily_tasks, min_profitability, max_profitability, color, icon, badge)
  VALUES (p_name, p_slug, p_price, p_daily_tasks, p_min_profitability, p_max_profitability, p_color, p_icon, p_badge)
  RETURNING id INTO v_plan_id;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'create_plan', 'plans', v_plan_id, jsonb_build_object('name', p_name, 'price', p_price));
  
  RETURN jsonb_build_object('success', true, 'plan_id', v_plan_id);
END;
$$;

-- ============================================
-- UPDATE PLAN STATUS (activate/deactivate)
-- ============================================
CREATE OR REPLACE FUNCTION toggle_plan_status(
  p_admin_id UUID,
  p_plan_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- Admin role check removed (public access)
  
  UPDATE plans SET is_active = p_is_active, updated_at = NOW() WHERE id = p_plan_id;
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'toggle_plan', 'plans', p_plan_id, jsonb_build_object('is_active', p_is_active));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- UPDATE PLAN
-- ============================================
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
DECLARE
BEGIN
  -- Admin role check removed (public access)
  
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
  
  INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (p_admin_id, 'update_plan', 'plans', p_plan_id, jsonb_build_object('name', p_name));
  
  RETURN jsonb_build_object('success', true);
END;
$$;

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

-- ============================================
-- SUBMIT WITHDRAWAL (user creates withdrawal request)
-- Rules: Friday only, 7 days after investment, gains only (not invested capital), min 5000
-- ============================================
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
  v_investment_duration INTEGER;
  v_last_investment RECORD;
  v_min_withdrawal DECIMAL;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Get system settings
  SELECT COALESCE((SELECT value::TEXT::NUMERIC FROM system_settings WHERE key = 'min_withdrawal'), 5000)
  INTO v_min_withdrawal;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'withdrawal_day'), 5)
  INTO v_withdrawal_day;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration;
  
  -- Rule 1: Withdrawals only on the configured day (default: Friday = 5)
  IF EXTRACT(DOW FROM NOW()) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le vendredi');
  END IF;
  
  -- Rule 2: Must wait 7 days after investment before withdrawing gains
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
  
  -- Rule 3: Minimum withdrawal amount
  IF p_amount < v_min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant minimum de retrait: ' || v_min_withdrawal::TEXT || ' FCFA');
  END IF;
  
  -- Rule 4: Only earnings are withdrawable (balance - invested capital - locked amount)
  v_withdrawable := v_wallet.balance - v_wallet.invested_capital - v_wallet.locked_amount;
  
  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Solde retirable insuffisant. Seuls vos gains de tâches sont retirables (montant retirable: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;
  
  -- Create withdrawal request
  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending');
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- SUBMIT DEPOSIT (user creates deposit request)
-- ============================================
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
  INSERT INTO deposits (user_id, amount, method, reference, proof_url, status)
  VALUES (p_user_id, p_amount, p_method, p_reference, p_proof_url, 'pending');
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================
-- RLS POLICIES for new operations
-- ============================================

-- Task submissions: users can insert (via RPC secure definer)
-- Admin policies for viewing all data (already have SELECT policies for admins)

-- RLS policies relaxed for public access (no authentication required)

-- ============================================
-- DROP OLD RESTRICTIVE POLICIES FROM MIGRATION 00001
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- wallets
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;

-- wallet_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;

-- tasks
DROP POLICY IF EXISTS "Anyone can view active tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;

-- task_submissions
DROP POLICY IF EXISTS "Users can view own submissions" ON task_submissions;
DROP POLICY IF EXISTS "Users can create submissions" ON task_submissions;
DROP POLICY IF EXISTS "Admins can view all submissions" ON task_submissions;

-- deposits
DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
DROP POLICY IF EXISTS "Users can create deposits" ON deposits;
DROP POLICY IF EXISTS "Admins can view all deposits" ON deposits;

-- withdrawals
DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Users can create withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Admins can view all withdrawals" ON withdrawals;

-- notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- referrals
DROP POLICY IF EXISTS "Users can view own referrals" ON referrals;
DROP POLICY IF EXISTS "Admins can view all referrals" ON referrals;

-- investments
DROP POLICY IF EXISTS "Users can view own investments" ON investments;
DROP POLICY IF EXISTS "Admins can view all investments" ON investments;
DROP POLICY IF EXISTS "Admins can update investments" ON investments;

-- submission_answers: public read access
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view submission answers" ON submission_answers;
CREATE POLICY "Public can view submission answers" ON submission_answers FOR SELECT USING (true);

-- submission_fields: public read access
ALTER TABLE submission_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view submission fields" ON submission_fields;
CREATE POLICY "Public can view submission fields" ON submission_fields FOR SELECT USING (true);

-- admin_logs: public read access
DROP POLICY IF EXISTS "Public can view logs" ON admin_logs;
CREATE POLICY "Public can view logs" ON admin_logs FOR SELECT USING (true);

-- daily_statistics: public read access
DROP POLICY IF EXISTS "Public can view stats" ON daily_statistics;
CREATE POLICY "Public can view stats" ON daily_statistics FOR SELECT USING (true);

-- system_settings: public read access
DROP POLICY IF EXISTS "Public can view settings" ON system_settings;
CREATE POLICY "Public can view settings" ON system_settings FOR SELECT USING (true);

-- payment_methods: public read access
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view payment methods" ON payment_methods;
CREATE POLICY "Public can view payment methods" ON payment_methods FOR SELECT USING (true);

-- tasks: public read/update/delete access
DROP POLICY IF EXISTS "Public can update tasks" ON tasks;
CREATE POLICY "Public can update tasks" ON tasks FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Public can delete tasks" ON tasks;
CREATE POLICY "Public can delete tasks" ON tasks FOR DELETE USING (true);

-- plans: public read/manage access
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view plans" ON plans;
CREATE POLICY "Public can view plans" ON plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can manage plans" ON plans;
CREATE POLICY "Public can manage plans" ON plans FOR ALL USING (true);

-- task_categories: public read access
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view categories" ON task_categories;
CREATE POLICY "Public can view categories" ON task_categories FOR SELECT USING (true);

-- deposits: public read/update access
DROP POLICY IF EXISTS "Public can update deposits" ON deposits;
CREATE POLICY "Public can update deposits" ON deposits FOR UPDATE USING (true);

-- withdrawals: public read/update access
DROP POLICY IF EXISTS "Public can update withdrawals" ON withdrawals;
CREATE POLICY "Public can update withdrawals" ON withdrawals FOR UPDATE USING (true);

-- task_submissions: public read/update access
DROP POLICY IF EXISTS "Public can update submissions" ON task_submissions;
CREATE POLICY "Public can update submissions" ON task_submissions FOR UPDATE USING (true);

-- investments: public read/update access
DROP POLICY IF EXISTS "Public can view investments" ON investments;
CREATE POLICY "Public can view investments" ON investments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public can update investments" ON investments;
CREATE POLICY "Public can update investments" ON investments FOR UPDATE USING (true);
