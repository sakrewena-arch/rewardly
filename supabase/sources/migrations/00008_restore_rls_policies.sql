-- Rewardly Restore RLS Policies
-- Migration 00008: Restore strict Row Level Security policies
-- Fixes: Public access vulnerability from migrations 00002-00005

-- ============================================
-- DROP ALL PUBLIC POLICIES
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
DROP POLICY IF EXISTS "Public can update profiles" ON profiles;
DROP POLICY IF EXISTS "Public can delete profiles" ON profiles;

-- wallets
DROP POLICY IF EXISTS "Public can view wallets" ON wallets;
DROP POLICY IF EXISTS "Public can update wallets" ON wallets;
DROP POLICY IF EXISTS "Public can delete wallets" ON wallets;

-- wallet_transactions
DROP POLICY IF EXISTS "Public can view transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Public can update transactions" ON wallet_transactions;
DROP POLICY IF EXISTS "Public can delete transactions" ON wallet_transactions;

-- tasks
DROP POLICY IF EXISTS "Public can view tasks" ON tasks;
DROP POLICY IF EXISTS "Public can update tasks" ON tasks;
DROP POLICY IF EXISTS "Public can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Public can manage tasks" ON tasks;

-- task_submissions
DROP POLICY IF EXISTS "Public can view submissions" ON task_submissions;
DROP POLICY IF EXISTS "Public can update submissions" ON task_submissions;
DROP POLICY IF EXISTS "Public can delete submissions" ON task_submissions;

-- deposits
DROP POLICY IF EXISTS "Public can view deposits" ON deposits;
DROP POLICY IF EXISTS "Public can update deposits" ON deposits;
DROP POLICY IF EXISTS "Public can delete deposits" ON deposits;

-- withdrawals
DROP POLICY IF EXISTS "Public can view withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Public can update withdrawals" ON withdrawals;
DROP POLICY IF EXISTS "Public can delete withdrawals" ON withdrawals;

-- investments
DROP POLICY IF EXISTS "Public can view investments" ON investments;
DROP POLICY IF EXISTS "Public can update investments" ON investments;
DROP POLICY IF EXISTS "Public can delete investments" ON investments;

-- notifications
DROP POLICY IF EXISTS "Public can view notifications" ON notifications;
DROP POLICY IF EXISTS "Public can update notifications" ON notifications;
DROP POLICY IF EXISTS "Public can delete notifications" ON notifications;

-- referrals
DROP POLICY IF EXISTS "Public can view referrals" ON referrals;
DROP POLICY IF EXISTS "Public can update referrals" ON referrals;
DROP POLICY IF EXISTS "Public can delete referrals" ON referrals;

-- plans
DROP POLICY IF EXISTS "Public can view plans" ON plans;
DROP POLICY IF EXISTS "Public can manage plans" ON plans;

-- task_categories
DROP POLICY IF EXISTS "Public can view categories" ON task_categories;

-- submission_fields
DROP POLICY IF EXISTS "Public can view submission fields" ON submission_fields;

-- submission_answers
DROP POLICY IF EXISTS "Public can view submission answers" ON submission_answers;

-- system_settings
DROP POLICY IF EXISTS "Public can view settings" ON system_settings;

-- payment_methods
DROP POLICY IF EXISTS "Public can view payment methods" ON payment_methods;

-- admin_logs
DROP POLICY IF EXISTS "Public can view logs" ON admin_logs;

-- daily_statistics
DROP POLICY IF EXISTS "Public can view stats" ON daily_statistics;

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

-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can insert their own profile (trigger creates it, but allow fallback)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin());

-- ============================================
-- WALLETS POLICIES
-- ============================================
-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own wallet (for balance display)
CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT USING (is_admin());

-- Admins can update all wallets
CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE USING (is_admin());

-- ============================================
-- WALLET TRANSACTIONS POLICIES
-- ============================================
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own transactions (via RPC)
CREATE POLICY "Users can insert own transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" ON wallet_transactions
  FOR SELECT USING (is_admin());

-- Admins can manage all transactions
CREATE POLICY "Admins can manage all transactions" ON wallet_transactions
  FOR ALL USING (is_admin());

-- ============================================
-- TASKS POLICIES
-- ============================================
-- Anyone can view active tasks
CREATE POLICY "Anyone can view active tasks" ON tasks
  FOR SELECT USING (is_active = true);

-- Admins can view all tasks (including inactive)
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT USING (is_admin());

-- Admins can manage tasks
CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (is_admin());

-- ============================================
-- TASK SUBMISSIONS POLICIES
-- ============================================
-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON task_submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create submissions
CREATE POLICY "Users can create submissions" ON task_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own submissions
CREATE POLICY "Users can update own submissions" ON task_submissions
  FOR UPDATE USING (auth.uid() = user_id);

-- Staff can view all submissions
CREATE POLICY "Staff can view all submissions" ON task_submissions
  FOR SELECT USING (is_staff());

-- Staff can update all submissions
CREATE POLICY "Staff can update all submissions" ON task_submissions
  FOR UPDATE USING (is_staff());

-- ============================================
-- DEPOSITS POLICIES
-- ============================================
-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create deposits
CREATE POLICY "Users can create deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own deposits
CREATE POLICY "Users can update own deposits" ON deposits
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all deposits
CREATE POLICY "Admins can view all deposits" ON deposits
  FOR SELECT USING (is_admin());

-- Admins can update all deposits
CREATE POLICY "Admins can update all deposits" ON deposits
  FOR UPDATE USING (is_admin());

-- ============================================
-- WITHDRAWALS POLICIES
-- ============================================
-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create withdrawals
CREATE POLICY "Users can create withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own withdrawals
CREATE POLICY "Users can update own withdrawals" ON withdrawals
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals" ON withdrawals
  FOR SELECT USING (is_admin());

-- Admins can update all withdrawals
CREATE POLICY "Admins can update all withdrawals" ON withdrawals
  FOR UPDATE USING (is_admin());

-- ============================================
-- INVESTMENTS POLICIES
-- ============================================
-- Users can view their own investments
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create investments
CREATE POLICY "Users can create investments" ON investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own investments
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all investments
CREATE POLICY "Admins can view all investments" ON investments
  FOR SELECT USING (is_admin());

-- Admins can update all investments
CREATE POLICY "Admins can update all investments" ON investments
  FOR UPDATE USING (is_admin());

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
-- Users can view their own notifications (or global ones)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (is_admin());

-- ============================================
-- REFERRALS POLICIES
-- ============================================
-- Users can view their own referrals
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals" ON referrals
  FOR SELECT USING (is_admin());

-- ============================================
-- PLANS POLICIES
-- ============================================
-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);

-- Admins can view all plans
CREATE POLICY "Admins can view all plans" ON plans
  FOR SELECT USING (is_admin());

-- Admins can manage plans
CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL USING (is_admin());

-- ============================================
-- TASK CATEGORIES POLICIES
-- ============================================
-- Anyone can view categories
CREATE POLICY "Anyone can view categories" ON task_categories
  FOR SELECT USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can manage categories" ON task_categories
  FOR ALL USING (is_admin());

-- ============================================
-- SUBMISSION FIELDS POLICIES
-- ============================================
-- Anyone can view submission fields (needed for task display)
CREATE POLICY "Anyone can view submission fields" ON submission_fields
  FOR SELECT USING (true);

-- Admins can manage submission fields
CREATE POLICY "Admins can manage submission fields" ON submission_fields
  FOR ALL USING (is_admin());

-- ============================================
-- SUBMISSION ANSWERS POLICIES
-- ============================================
-- Users can view their own submission answers
CREATE POLICY "Users can view own answers" ON submission_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_submissions ts
      WHERE ts.id = submission_answers.submission_id
        AND ts.user_id = auth.uid()
    )
  );

-- Users can create submission answers
CREATE POLICY "Users can create answers" ON submission_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_submissions ts
      WHERE ts.id = submission_answers.submission_id
        AND ts.user_id = auth.uid()
    )
  );

-- Staff can view all submission answers
CREATE POLICY "Staff can view all answers" ON submission_answers
  FOR SELECT USING (is_staff());

-- ============================================
-- SYSTEM SETTINGS POLICIES
-- ============================================
-- Anyone can view system settings (needed for display)
CREATE POLICY "Anyone can view settings" ON system_settings
  FOR SELECT USING (true);

-- Admins can manage settings
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (is_admin());

-- ============================================
-- PAYMENT METHODS POLICIES
-- ============================================
-- Anyone can view active payment methods
CREATE POLICY "Anyone can view payment methods" ON payment_methods
  FOR SELECT USING (is_active = true);

-- Admins can manage payment methods
CREATE POLICY "Admins can manage payment methods" ON payment_methods
  FOR ALL USING (is_admin());

-- ============================================
-- ADMIN LOGS POLICIES
-- ============================================
-- Only admins can view admin logs
CREATE POLICY "Admins can view logs" ON admin_logs
  FOR SELECT USING (is_admin());

-- Only admins can insert logs
CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- DAILY STATISTICS POLICIES
-- ============================================
-- Users can view their own statistics
CREATE POLICY "Users can view own stats" ON daily_statistics
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own statistics
CREATE POLICY "Users can insert own stats" ON daily_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own statistics
CREATE POLICY "Users can update own stats" ON daily_statistics
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all statistics
CREATE POLICY "Admins can view all stats" ON daily_statistics
  FOR SELECT USING (is_admin());

-- ============================================
-- BANNERS POLICIES
-- ============================================
-- Anyone can view active banners
CREATE POLICY "Anyone can view banners" ON banners
  FOR SELECT USING (is_active = true);

-- Admins can manage banners
CREATE POLICY "Admins can manage banners" ON banners
  FOR ALL USING (is_admin());

-- ============================================
-- ANNOUNCEMENTS POLICIES
-- ============================================
-- Anyone can view active announcements
CREATE POLICY "Anyone can view announcements" ON announcements
  FOR SELECT USING (is_active = true);

-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (is_admin());

-- ============================================
-- VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;