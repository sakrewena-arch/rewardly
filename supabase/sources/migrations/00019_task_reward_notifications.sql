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

-- Privilèges
GRANT EXECUTE ON FUNCTION submit_task(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_submission(UUID, UUID, TEXT) TO authenticated;