-- Rewardly Public SELECT Policies
-- Migration 00005: Add missing public SELECT policies
-- Fixes: tasks not visible, wallet not loading from DB

-- ============================================
-- TASKS: public can view all tasks
-- ============================================
DROP POLICY IF EXISTS "Public can view tasks" ON tasks;
CREATE POLICY "Public can view tasks" ON tasks FOR SELECT USING (true);

-- ============================================
-- WALLETS: public can view all wallets
-- ============================================
DROP POLICY IF EXISTS "Public can view wallets" ON wallets;
CREATE POLICY "Public can view wallets" ON wallets FOR SELECT USING (true);

-- ============================================
-- WALLET TRANSACTIONS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view transactions" ON wallet_transactions;
CREATE POLICY "Public can view transactions" ON wallet_transactions FOR SELECT USING (true);

-- ============================================
-- DEPOSITS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view deposits" ON deposits;
CREATE POLICY "Public can view deposits" ON deposits FOR SELECT USING (true);

-- ============================================
-- WITHDRAWALS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view withdrawals" ON withdrawals;
CREATE POLICY "Public can view withdrawals" ON withdrawals FOR SELECT USING (true);

-- ============================================
-- TASK SUBMISSIONS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view submissions" ON task_submissions;
CREATE POLICY "Public can view submissions" ON task_submissions FOR SELECT USING (true);

-- ============================================
-- INVESTMENTS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view investments" ON investments;
CREATE POLICY "Public can view investments" ON investments FOR SELECT USING (true);

-- ============================================
-- NOTIFICATIONS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view notifications" ON notifications;
CREATE POLICY "Public can view notifications" ON notifications FOR SELECT USING (true);

-- ============================================
-- PROFILES: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (true);

-- ============================================
-- REFERRALS: public can view all
-- ============================================
DROP POLICY IF EXISTS "Public can view referrals" ON referrals;
CREATE POLICY "Public can view referrals" ON referrals FOR SELECT USING (true);

-- ============================================
-- PLANS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view plans" ON plans;
CREATE POLICY "Public can view plans" ON plans FOR SELECT USING (true);

-- ============================================
-- TASK CATEGORIES: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view categories" ON task_categories;
CREATE POLICY "Public can view categories" ON task_categories FOR SELECT USING (true);

-- ============================================
-- SUBMISSION FIELDS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view submission fields" ON submission_fields;
CREATE POLICY "Public can view submission fields" ON submission_fields FOR SELECT USING (true);

-- ============================================
-- SUBMISSION ANSWERS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view submission answers" ON submission_answers;
CREATE POLICY "Public can view submission answers" ON submission_answers FOR SELECT USING (true);

-- ============================================
-- SYSTEM SETTINGS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view settings" ON system_settings;
CREATE POLICY "Public can view settings" ON system_settings FOR SELECT USING (true);

-- ============================================
-- PAYMENT METHODS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view payment methods" ON payment_methods;
CREATE POLICY "Public can view payment methods" ON payment_methods FOR SELECT USING (true);

-- ============================================
-- ADMIN LOGS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view logs" ON admin_logs;
CREATE POLICY "Public can view logs" ON admin_logs FOR SELECT USING (true);

-- ============================================
-- DAILY STATISTICS: public can view all (already exists but ensure)
-- ============================================
DROP POLICY IF EXISTS "Public can view stats" ON daily_statistics;
CREATE POLICY "Public can view stats" ON daily_statistics FOR SELECT USING (true);