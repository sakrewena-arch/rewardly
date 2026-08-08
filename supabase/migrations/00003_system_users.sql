-- Rewardly System Users
-- Migration 00003: Create system users for public access
-- Fixes FK violations when inserting with system UUIDs

-- ============================================
-- CREATE SYSTEM USERS
-- ============================================
-- The trigger handle_new_user (from migration 00001)
-- will auto-create profiles and wallets for these users.

-- System Admin (used by admin-actions.ts)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'system-admin@rewardly.local',
  '{"full_name": "System Admin"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- System User (used by user-actions.ts)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system-user@rewardly.local',
  '{"full_name": "System User"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ENSURE PROFILES AND WALLETS EXIST
-- (in case the trigger was already fired or doesn't run)
-- ============================================
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
-- DROP FK CONSTRAINTS TO auth.users
-- So public access works even without real auth users
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

-- task_submissions
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_user_id_fkey;

-- referrals
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;

-- daily_statistics
ALTER TABLE daily_statistics DROP CONSTRAINT IF EXISTS daily_statistics_user_id_fkey;