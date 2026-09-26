-- Rewardly Cleanup + Admin Role
-- Migration 00007: Clean all data and set admin role for wlagbema@gmail.com

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

-- ============================================
-- SENSIBLE DATA: keep user accounts in auth.users
-- (we only cleaned public tables and system accounts)
-- ============================================

-- ============================================
-- SET ADMIN ROLE FOR wlagbema@gmail.com
-- ============================================
-- Update the profile of the user with email wlagbema@gmail.com to role 'admin'
UPDATE profiles
SET role = 'admin',
    is_active = true,
    is_banned = false,
    updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'wlagbema@gmail.com'
);

-- If the profile doesn't exist yet (user registered but trigger may have failed), create it
INSERT INTO profiles (user_id, full_name, username, role, referral_code, is_active, is_banned)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', 'Admin'),
  'admin-' || LEFT(u.id::TEXT, 8),
  'admin',
  UPPER(SUBSTRING(MD5(u.id::TEXT) FROM 1 FOR 8)),
  true,
  false
FROM auth.users u
WHERE u.email = 'wlagbema@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = u.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- Ensure the user has a wallet
INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
SELECT id, 0, 0, 0, 0
FROM auth.users
WHERE email = 'wlagbema@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = auth.users.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- RESTORE FK CONSTRAINTS TO auth.users
-- ============================================

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