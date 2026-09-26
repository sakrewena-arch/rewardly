-- Rewardly Cleanup Data
-- Migration 00006: Clean all existing demo/system data
-- Requirement: "efface les données des comptes existants et supprime les comptes"

-- ============================================
-- DELETE ALL EXISTING DATA (order matters for FK)
-- ============================================
DELETE FROM submission_answers;
DELETE FROM submission_fields;
DELETE FROM task_submissions;
DELETE FROM tasks;
DELETE FROM task_categories;
DELETE FROM deposits;
DELETE FROM withdrawals;
DELETE FROM wallet_transactions;
DELETE FROM investments;
DELETE FROM referrals;
DELETE FROM notifications;
DELETE FROM admin_logs;
DELETE FROM daily_statistics;
DELETE FROM wallets;
DELETE FROM profiles;

-- Delete system users from auth.users (except the authenticated users)
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001'
);

-- Keep plans, system_settings, payment_methods, banners, announcements
-- (these are platform configuration, not user data)

-- ============================================
-- RESTORE FK CONSTRAINTS TO auth.users
-- (re-enable security now that we're back to authentication)
-- ============================================

-- Helper macro-style blocks (PostgreSQL does not support IF NOT EXISTS on ADD CONSTRAINT)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_fkey') THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_user_id_fkey') THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_user_id_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_reviewed_by_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_user_id_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_reviewed_by_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_user_id_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_reviewed_by_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investments_user_id_fkey') THEN
    ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_logs_admin_id_fkey') THEN
    ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey
      FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_statistics_user_id_fkey') THEN
    ALTER TABLE daily_statistics ADD CONSTRAINT daily_statistics_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;