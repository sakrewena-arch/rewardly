-- ======================================================================
-- REWARDLY — TRIGGERS (12) + RLS POLICIES (106)   (étape 3/4)
-- GÉNÉRÉ par scripts/build-supabase-setup.mjs — NE PAS ÉDITER À LA MAIN.
-- Modifier supabase/migrations/, puis régénérer.
-- Chaque objet est supprimé puis recréé : idempotent.
-- ======================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- [supabase/migrations/00022_referral_investment_commission.sql:115]
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rewardly_handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
-- [supabase/migrations/00001_initial_schema.sql:431]
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
-- [supabase/migrations/00001_initial_schema.sql:432]
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_investments_updated_at ON investments;
-- [supabase/migrations/00001_initial_schema.sql:433]
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
-- [supabase/migrations/00001_initial_schema.sql:434]
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_deposits_updated_at ON deposits;
-- [supabase/migrations/00001_initial_schema.sql:435]
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
-- [supabase/migrations/00001_initial_schema.sql:436]
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
-- [supabase/legacy/consolidated_schema.sql:452]
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS prevent_profile_security_changes ON public.profiles;
-- [supabase/migrations/00017_security_fixes.sql:87]
CREATE TRIGGER prevent_profile_security_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_security_changes();

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
-- [supabase/migrations/00011_user_preferences.sql:24]
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.handle_updated_at();

DROP TRIGGER IF EXISTS set_service_orders_updated_at ON public.service_orders;
-- [supabase/migrations/00012_service_orders.sql:32]
create trigger set_service_orders_updated_at
  before update on public.service_orders
  for each row execute function public.handle_updated_at();

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON public.push_tokens;
-- [supabase/migrations/00016_push_tokens.sql:52]
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_push_tokens_updated_at();

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view referral-linked profiles" ON public.profiles;
-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:148]
CREATE POLICY "Users can view referral-linked profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.referrals r
      WHERE (
        (r.referrer_id = auth.uid() AND r.referred_id = profiles.user_id)
        OR
        (r.referred_id = auth.uid() AND r.referrer_id = profiles.user_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own profile (trigger creates it, but allow fallback)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WALLETS POLICIES
-- ============================================
-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all wallets
CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all wallets" ON wallets;
-- [supabase/legacy/consolidated_schema.sql:571]
CREATE POLICY "Admins can manage all wallets" ON wallets
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WALLET TRANSACTIONS POLICIES
-- ============================================
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" ON wallet_transactions
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all transactions" ON wallet_transactions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage all transactions
CREATE POLICY "Admins can manage all transactions" ON wallet_transactions
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view active tasks" ON tasks;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASKS POLICIES
-- ============================================
-- Anyone can view active tasks
CREATE POLICY "Anyone can view active tasks" ON tasks
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all tasks (including inactive)
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage tasks
CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own submissions" ON task_submissions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASK SUBMISSIONS POLICIES
-- ============================================
-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON task_submissions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create submissions" ON task_submissions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can create submissions
CREATE POLICY "Users can create submissions" ON task_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own submissions" ON task_submissions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own submissions
CREATE POLICY "Users can update own submissions" ON task_submissions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all submissions" ON task_submissions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Staff can view all submissions
CREATE POLICY "Staff can view all submissions" ON task_submissions
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS "Staff can update all submissions" ON task_submissions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Staff can update all submissions
CREATE POLICY "Staff can update all submissions" ON task_submissions
  FOR UPDATE USING (is_staff());

DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- DEPOSITS POLICIES
-- ============================================
-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all deposits" ON deposits;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all deposits
CREATE POLICY "Admins can view all deposits" ON deposits
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all deposits" ON deposits;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all deposits
CREATE POLICY "Admins can update all deposits" ON deposits
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert deposits" ON deposits;
-- [supabase/legacy/consolidated_schema.sql:621]
CREATE POLICY "Admins can insert deposits" ON deposits
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WITHDRAWALS POLICIES
-- ============================================
-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all withdrawals" ON withdrawals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals" ON withdrawals
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all withdrawals" ON withdrawals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all withdrawals
CREATE POLICY "Admins can update all withdrawals" ON withdrawals
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert withdrawals" ON withdrawals;
-- [supabase/legacy/consolidated_schema.sql:636]
CREATE POLICY "Admins can insert withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own investments" ON investments;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- INVESTMENTS POLICIES
-- ============================================
-- Users can view their own investments
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create investments" ON investments;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can create investments
CREATE POLICY "Users can create investments" ON investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON investments;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own investments
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all investments" ON investments;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all investments
CREATE POLICY "Admins can view all investments" ON investments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all investments" ON investments;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all investments
CREATE POLICY "Admins can update all investments" ON investments
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
-- Users can view their own notifications (or global ones)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:124]
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:130]
CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:134]
CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can view all referrals" ON referrals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals" ON referrals
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view active plans" ON plans;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PLANS POLICIES
-- ============================================
-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all plans" ON plans;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all plans
CREATE POLICY "Admins can view all plans" ON plans
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage plans" ON plans;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage plans
CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view categories" ON task_categories;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASK CATEGORIES POLICIES
-- ============================================
-- Anyone can view categories
CREATE POLICY "Anyone can view categories" ON task_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON task_categories;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage categories
CREATE POLICY "Admins can manage categories" ON task_categories
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view submission fields" ON submission_fields;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- SUBMISSION FIELDS POLICIES
-- ============================================
-- Anyone can view submission fields (needed for task display)
CREATE POLICY "Anyone can view submission fields" ON submission_fields
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage submission fields" ON submission_fields;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage submission fields
CREATE POLICY "Admins can manage submission fields" ON submission_fields
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own answers" ON submission_answers;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
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

DROP POLICY IF EXISTS "Users can create answers" ON submission_answers;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can create submission answers
CREATE POLICY "Users can create answers" ON submission_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_submissions ts
      WHERE ts.id = submission_answers.submission_id
        AND ts.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can view all answers" ON submission_answers;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Staff can view all submission answers
CREATE POLICY "Staff can view all answers" ON submission_answers
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS "Anyone can view settings" ON system_settings;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- SYSTEM SETTINGS POLICIES
-- ============================================
-- Anyone can view system settings (needed for display)
CREATE POLICY "Anyone can view settings" ON system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage settings
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view payment methods" ON payment_methods;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PAYMENT METHODS POLICIES
-- ============================================
-- Anyone can view active payment methods
CREATE POLICY "Anyone can view payment methods" ON payment_methods
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage payment methods" ON payment_methods;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage payment methods
CREATE POLICY "Admins can manage payment methods" ON payment_methods
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- ADMIN LOGS POLICIES
-- ============================================
-- Only admins can view admin logs
CREATE POLICY "Admins can view logs" ON admin_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Only admins can insert logs
CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own stats" ON daily_statistics;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- DAILY STATISTICS POLICIES
-- ============================================
-- Users can view their own statistics
CREATE POLICY "Users can view own stats" ON daily_statistics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON daily_statistics;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own statistics
CREATE POLICY "Users can insert own stats" ON daily_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON daily_statistics;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own statistics
CREATE POLICY "Users can update own stats" ON daily_statistics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all stats" ON daily_statistics;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all statistics
CREATE POLICY "Admins can view all stats" ON daily_statistics
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view banners" ON banners;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- BANNERS POLICIES
-- ============================================
-- Anyone can view active banners
CREATE POLICY "Anyone can view banners" ON banners
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage banners" ON banners;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage banners
CREATE POLICY "Admins can manage banners" ON banners
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- ANNOUNCEMENTS POLICIES
-- ============================================
-- Anyone can view active announcements
CREATE POLICY "Anyone can view announcements" ON announcements
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;
-- [supabase/legacy/consolidated_schema.sql:2061]
CREATE POLICY "Users can upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view proofs" ON storage.objects;
-- [supabase/legacy/consolidated_schema.sql:2068]
CREATE POLICY "Users can view proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'proofs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE user_id = auth.uid()
          AND role IN ('admin', 'super_admin', 'moderator')
      )
    )
  );

DROP POLICY IF EXISTS "Admins can delete proofs" ON storage.objects;
-- [supabase/legacy/consolidated_schema.sql:2082]
CREATE POLICY "Admins can delete proofs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'proofs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins can view all submissions" ON task_submissions;
-- [supabase/migrations/00001_initial_schema.sql:374]
CREATE POLICY "Admins can view all submissions" ON task_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
);

DROP POLICY IF EXISTS "Users can create deposits" ON deposits;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can create deposits
CREATE POLICY "Users can create deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create withdrawals" ON withdrawals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can create withdrawals
CREATE POLICY "Users can create withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view submission answers" ON submission_answers;
-- [supabase/migrations/00005_public_select_policies.sql:87]
CREATE POLICY "Public can view submission answers" ON submission_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view submission fields" ON submission_fields;
-- [supabase/migrations/00005_public_select_policies.sql:81]
CREATE POLICY "Public can view submission fields" ON submission_fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view logs" ON admin_logs;
-- [supabase/migrations/00005_public_select_policies.sql:105]
CREATE POLICY "Public can view logs" ON admin_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view stats" ON daily_statistics;
-- [supabase/migrations/00005_public_select_policies.sql:111]
CREATE POLICY "Public can view stats" ON daily_statistics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view settings" ON system_settings;
-- [supabase/migrations/00005_public_select_policies.sql:93]
CREATE POLICY "Public can view settings" ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view payment methods" ON payment_methods;
-- [supabase/migrations/00005_public_select_policies.sql:99]
CREATE POLICY "Public can view payment methods" ON payment_methods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update tasks" ON tasks;
-- [supabase/migrations/00002_platform_management.sql:1040]
CREATE POLICY "Public can update tasks" ON tasks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete tasks" ON tasks;
-- [supabase/migrations/00002_platform_management.sql:1042]
CREATE POLICY "Public can delete tasks" ON tasks FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public can view plans" ON plans;
-- [supabase/migrations/00005_public_select_policies.sql:69]
CREATE POLICY "Public can view plans" ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can manage plans" ON plans;
-- [supabase/migrations/00002_platform_management.sql:1049]
CREATE POLICY "Public can manage plans" ON plans FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view categories" ON task_categories;
-- [supabase/migrations/00005_public_select_policies.sql:75]
CREATE POLICY "Public can view categories" ON task_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update deposits" ON deposits;
-- [supabase/migrations/00002_platform_management.sql:1058]
CREATE POLICY "Public can update deposits" ON deposits FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can update withdrawals" ON withdrawals;
-- [supabase/migrations/00002_platform_management.sql:1062]
CREATE POLICY "Public can update withdrawals" ON withdrawals FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can update submissions" ON task_submissions;
-- [supabase/migrations/00002_platform_management.sql:1066]
CREATE POLICY "Public can update submissions" ON task_submissions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can view investments" ON investments;
-- [supabase/migrations/00005_public_select_policies.sql:45]
CREATE POLICY "Public can view investments" ON investments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update investments" ON investments;
-- [supabase/migrations/00002_platform_management.sql:1072]
CREATE POLICY "Public can update investments" ON investments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can view tasks" ON tasks;
-- [supabase/migrations/00005_public_select_policies.sql:9]
CREATE POLICY "Public can view tasks" ON tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view wallets" ON wallets;
-- [supabase/migrations/00005_public_select_policies.sql:15]
CREATE POLICY "Public can view wallets" ON wallets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view transactions" ON wallet_transactions;
-- [supabase/migrations/00005_public_select_policies.sql:21]
CREATE POLICY "Public can view transactions" ON wallet_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view deposits" ON deposits;
-- [supabase/migrations/00005_public_select_policies.sql:27]
CREATE POLICY "Public can view deposits" ON deposits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view withdrawals" ON withdrawals;
-- [supabase/migrations/00005_public_select_policies.sql:33]
CREATE POLICY "Public can view withdrawals" ON withdrawals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view submissions" ON task_submissions;
-- [supabase/migrations/00005_public_select_policies.sql:39]
CREATE POLICY "Public can view submissions" ON task_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view notifications" ON notifications;
-- [supabase/migrations/00005_public_select_policies.sql:51]
CREATE POLICY "Public can view notifications" ON notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
-- [supabase/migrations/00005_public_select_policies.sql:57]
CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view referrals" ON referrals;
-- [supabase/migrations/00005_public_select_policies.sql:63]
CREATE POLICY "Public can view referrals" ON referrals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own wallet (for balance display)
CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON wallet_transactions;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own transactions (via RPC)
CREATE POLICY "Users can insert own transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own deposits" ON deposits;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own deposits
CREATE POLICY "Users can update own deposits" ON deposits
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own withdrawals" ON withdrawals;
-- [supabase/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own withdrawals
CREATE POLICY "Users can update own withdrawals" ON withdrawals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own preferences" ON public.user_preferences;
-- [supabase/migrations/00011_user_preferences.sql:33]
create policy "Users read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;
-- [supabase/migrations/00011_user_preferences.sql:38]
create policy "Users insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own preferences" ON public.user_preferences;
-- [supabase/migrations/00011_user_preferences.sql:43]
create policy "Users update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own service orders" ON public.service_orders;
-- [supabase/migrations/00012_service_orders.sql:41]
create policy "Users read own service orders"
  on public.service_orders for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert service orders" ON public.service_orders;
-- [supabase/migrations/00012_service_orders.sql:47]
create policy "Users insert service orders"
  on public.service_orders for insert
  with check (auth.uid() = user_id);
