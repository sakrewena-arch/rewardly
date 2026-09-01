-- ============================================================
-- REWARDLY - CONSOLIDATED SCHEMA (IDEMPOTENT)
-- ============================================================
-- Ce fichier regroupe TOUT le SQL nécessaire pour la plateforme.
-- Il est IDEMPOTENT : peut être exécuté plusieurs fois sans erreur.
-- Utilise IF NOT EXISTS / DROP IF EXISTS / DO $$ blocks partout.
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 2. TABLES (CREATE IF NOT EXISTS)
-- ============================================================

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  phone TEXT,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES profiles(id),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALLETS
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance DECIMAL(12,0) DEFAULT 0,
  invested_capital DECIMAL(12,0) DEFAULT 0,
  total_earnings DECIMAL(12,0) DEFAULT 0,
  locked_amount DECIMAL(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WALLET TRANSACTIONS
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment', 'service')),
  description TEXT,
  reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compatibilité : applique le type 'service' sur les bases existantes (idempotent)
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment', 'service'));

-- PLANS
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price DECIMAL(12,0) NOT NULL,
  daily_tasks INTEGER NOT NULL DEFAULT 1,
  min_profitability DECIMAL(5,2) NOT NULL,
  max_profitability DECIMAL(5,2) NOT NULL,
  color TEXT DEFAULT '#9D3FE7',
  icon TEXT DEFAULT 'Medal',
  badge TEXT DEFAULT 'Standard',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  allow_upgrade BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVESTMENTS
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASK CATEGORIES
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'CheckSquare',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  icon TEXT,
  amount DECIMAL(12,0) NOT NULL,
  estimated_time INTEGER,
  instructions TEXT,
  link TEXT,
  max_completions INTEGER,
  duration_minutes INTEGER,
  deadline TIMESTAMPTZ,
  category_id UUID REFERENCES task_categories(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  validation_type TEXT DEFAULT 'auto' CHECK (validation_type IN ('auto', 'manual')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBMISSION FIELDS
CREATE TABLE IF NOT EXISTS submission_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'email', 'url', 'image', 'screenshot', 'video', 'file', 'telegram', 'whatsapp')),
  is_required BOOLEAN DEFAULT false,
  placeholder TEXT,
  max_size INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TASK SUBMISSIONS
CREATE TABLE IF NOT EXISTS task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBMISSION ANSWERS
CREATE TABLE IF NOT EXISTS submission_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES submission_fields(id) ON DELETE CASCADE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEPOSITS
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  proof_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WITHDRAWALS
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  method TEXT NOT NULL,
  account_info TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  admin_comment TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'task', 'reward', 'investment', 'promotion', 'admin', 'referral')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAYMENT METHODS
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  commission DECIMAL(12,0) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADMIN LOGS
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DAILY STATISTICS
CREATE TABLE IF NOT EXISTS daily_statistics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  tasks_completed INTEGER DEFAULT 0,
  earnings DECIMAL(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- BANNERS
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES (IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON tasks(is_active);
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON task_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_statistics_user_date ON daily_statistics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================================
-- 4. TRIGGERS & FUNCTIONS
-- ============================================================

-- Générateur de code de parrainage UNIQUE (relance tant qu'un code existe déjà)
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Auto-create profile on user signup (avec parrainage)
-- NOTE: utilise rewardly_handle_new_user (nom unique) pour éviter tout conflit
-- avec d'anciennes versions cassées de handle_new_user
-- L'inscription via lien (?ref=CODE) :
--   1. génère un code de parrainage unique au filleul,
--   2. enregistre le lien référent → filleul,
--   3. CRÉDITE IMMÉDIATEMENT la commission dans le wallet du parrain
--      (plus besoin de ressaisir le code après l'inscription).
CREATE OR REPLACE FUNCTION rewardly_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $handler$
DECLARE
  v_code text := NULL;
  v_meta_code text := NULL;
  v_referrer_id uuid := NULL;
  v_commission numeric := 500;
  v_wallet_id uuid := NULL;
BEGIN
  -- 🔢 Code de parrainage unique garanti
  v_code := generate_unique_referral_code();

  -- 📥 Lire le code de parrainage fourni via le lien d'inscription (?ref=CODE)
  v_meta_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code', '');
  IF v_meta_code IS NOT NULL THEN
    SELECT p.id INTO v_referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = UPPER(v_meta_code)
      AND p.user_id <> NEW.id
    LIMIT 1;
  END IF;

  -- 👤 Créer le profil (avec code unique et éventuel parrain)
  INSERT INTO public.profiles (user_id, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_code,
    v_referrer_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, excluded.referral_code);

  -- 💰 Créer le wallet s'il manque
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 🎁 Si un parrain a été trouvé : référence + commission payée immédiatement
  IF v_referrer_id IS NOT NULL THEN
    BEGIN
      SELECT COALESCE(s.value::text::numeric, 500) INTO v_commission
      FROM public.system_settings AS s
      WHERE s.key = 'referral_commission_fixed'
      LIMIT 1;

      -- Référence parrain → filleul
      INSERT INTO public.referrals (referrer_id, referred_id, commission, status)
      VALUES (v_referrer_id, NEW.id, v_commission, 'paid')
      ON CONFLICT (referred_id) DO UPDATE
        SET commission = COALESCE(public.referrals.commission, excluded.commission);

      -- Wallet du parrain
      SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_referrer_id;
      IF v_wallet_id IS NULL THEN
        INSERT INTO public.wallets (user_id, balance, locked_amount)
        VALUES (v_referrer_id, 0, 0)
        RETURNING id INTO v_wallet_id;
      END IF;

      -- 💸 Créditer la commission (balance + gains retirables)
      UPDATE public.wallets
      SET balance = balance + v_commission,
          total_earnings = total_earnings + v_commission,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      -- 📒 Traçabilité
      INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (v_referrer_id, v_wallet_id, v_commission, 'referral',
              'Commission de parrainage (inscription via lien)', 'completed');

      -- 🔔 Notification
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_referrer_id, 'Nouveau filleul 🎉',
              'Un utilisateur s''est inscrit avec votre code de parrainage ! +' || v_commission::TEXT || ' FCFA',
              'referral');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ne jamais bloquer la création d'un utilisateur
    END;
  END IF;

  RETURN NEW;
END;
$handler$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION rewardly_handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_investments_updated_at ON investments;
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_deposits_updated_at ON deposits;
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. RLS HELPER FUNCTIONS
-- ============================================================
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

-- ============================================================
-- 6. ROW LEVEL SECURITY (ENABLE + POLICIES)
-- ============================================================

-- Enable RLS on all tables
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

-- ============================================================
-- DROP ALL OLD POLICIES (to avoid duplicates)
-- ============================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
-- NOTE SÉCURITÉ : l'insertion de profil est limitée au rôle 'user' par défaut.
-- La création réelle du profil est faite par le trigger on_auth_user_created
-- (SECURITY DEFINER). On interdit l'auto-insertion avec un rôle supérieur.
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND role = 'user');
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin());

-- ============================================================
-- WALLETS POLICIES
-- ============================================================
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);
-- NOTE SÉCURITÉ : AUCUNE politique "Users can update own wallet".
-- Les écritures sur wallets passent UNIQUEMENT par les RPC SECURITY DEFINER
-- (submit_task, submit_deposit, credit_feeexpay_deposit, request_withdrawal_feeexpay…)
-- afin qu'un utilisateur ne puisse JAMAIS se créditer lui-même.
CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can manage all wallets" ON wallets
  FOR ALL USING (is_admin());

-- ============================================================
-- WALLET TRANSACTIONS POLICIES
-- ============================================================
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
-- NOTE SÉCURITÉ : AUCUNE politique "Users can insert own transactions".
-- Les transactions sont créées exclusivement par les RPC SECURITY DEFINER.
CREATE POLICY "Admins can view all transactions" ON wallet_transactions
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can manage all transactions" ON wallet_transactions
  FOR ALL USING (is_admin());

-- ============================================================
-- TASKS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view active tasks" ON tasks
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (is_admin());

-- ============================================================
-- TASK SUBMISSIONS POLICIES
-- ============================================================
CREATE POLICY "Users can view own submissions" ON task_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create submissions" ON task_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own submissions" ON task_submissions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all submissions" ON task_submissions
  FOR SELECT USING (is_staff());
CREATE POLICY "Staff can update all submissions" ON task_submissions
  FOR UPDATE USING (is_staff());

-- ============================================================
-- DEPOSITS POLICIES
-- ============================================================
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);
-- NOTE SÉCURITÉ : PAS d'INSERT/UPDATE utilisateur. La création passe par la
-- RPC submit_deposit (SECURITY DEFINER) et la validation par validate_deposit.
CREATE POLICY "Admins can view all deposits" ON deposits
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all deposits" ON deposits
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can insert deposits" ON deposits
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- WITHDRAWALS POLICIES
-- ============================================================
CREATE POLICY "Users can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);
-- NOTE SÉCURITÉ : PAS d'INSERT/UPDATE utilisateur. La demande passe par la
-- RPC submit_withdrawal / request_withdrawal_feeexpay (SECURITY DEFINER),
-- la validation par validate_withdrawal.
CREATE POLICY "Admins can view all withdrawals" ON withdrawals
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all withdrawals" ON withdrawals
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can insert withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- INVESTMENTS POLICIES
-- ============================================================
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create investments" ON investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all investments" ON investments
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update all investments" ON investments
  FOR UPDATE USING (is_admin());

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (is_admin());

-- ============================================================
-- REFERRALS POLICIES
-- ============================================================
CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "Admins can view all referrals" ON referrals
  FOR SELECT USING (is_admin());

-- ============================================================
-- PLANS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can view all plans" ON plans
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL USING (is_admin());

-- ============================================================
-- TASK CATEGORIES POLICIES
-- ============================================================
CREATE POLICY "Anyone can view categories" ON task_categories
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON task_categories
  FOR ALL USING (is_admin());

-- ============================================================
-- SUBMISSION FIELDS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view submission fields" ON submission_fields
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage submission fields" ON submission_fields
  FOR ALL USING (is_admin());

-- ============================================================
-- SUBMISSION ANSWERS POLICIES
-- ============================================================
CREATE POLICY "Users can view own answers" ON submission_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_submissions ts
      WHERE ts.id = submission_answers.submission_id
        AND ts.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can create answers" ON submission_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_submissions ts
      WHERE ts.id = submission_answers.submission_id
        AND ts.user_id = auth.uid()
    )
  );
CREATE POLICY "Staff can view all answers" ON submission_answers
  FOR SELECT USING (is_staff());

-- ============================================================
-- SYSTEM SETTINGS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view settings" ON system_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (is_admin());

-- ============================================================
-- PAYMENT METHODS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view payment methods" ON payment_methods
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage payment methods" ON payment_methods
  FOR ALL USING (is_admin());

-- ============================================================
-- ADMIN LOGS POLICIES
-- ============================================================
CREATE POLICY "Admins can view logs" ON admin_logs
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- DAILY STATISTICS POLICIES
-- ============================================================
CREATE POLICY "Users can view own stats" ON daily_statistics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON daily_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON daily_statistics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all stats" ON daily_statistics
  FOR SELECT USING (is_admin());

-- ============================================================
-- BANNERS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view banners" ON banners
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage banners" ON banners
  FOR ALL USING (is_admin());

-- ============================================================
-- ANNOUNCEMENTS POLICIES
-- ============================================================
CREATE POLICY "Anyone can view announcements" ON announcements
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (is_admin());

-- ============================================================
-- 7. RPC FUNCTIONS
-- ============================================================

-- ADD REWARD
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

-- SUBMIT TASK (sécurisé + anti-double soumission + limite quotidienne)
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
    
    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', true, 'amount', v_task.amount);
  END IF;
  
  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'auto_approved', false);
END;
$$;

-- APPROVE SUBMISSION
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

-- REJECT SUBMISSION
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
  
  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'reject_submission', 'task_submissions', p_submission_id, 
            jsonb_build_object('comment', p_comment));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- VALIDATE DEPOSIT
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

-- VALIDATE WITHDRAWAL
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
  
  -- 💰 Débit UNIQUE effectué À LA DEMANDE (via /api/feexpay/payout ou submit_withdrawal).
  -- Au passage à 'paid', on ne débite PLUS le wallet : on clôture simplement la
  -- transaction de débit en attente qui référence ce retrait.
  IF p_status = 'paid' THEN
    UPDATE wallets
    SET locked_amount = GREATEST(0, locked_amount - v_withdrawal.amount), updated_at = NOW()
    WHERE user_id = v_withdrawal.user_id;

    BEGIN
      UPDATE wallet_transactions
      SET status = 'completed'
      WHERE id = (
        SELECT id FROM wallet_transactions
        WHERE user_id = v_withdrawal.user_id
          AND type = 'withdrawal'
          AND status = 'pending'
          AND amount = -v_withdrawal.amount
          AND (reference = v_withdrawal.id OR reference IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      );
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
      -- Le montant réservé à la demande a été remboursé côté application :
      -- la transaction de débit est marquée comme échouée (aucun transfert effectué).
      UPDATE wallet_transactions
      SET status = 'failed'
      WHERE id = (
        SELECT id FROM wallet_transactions
        WHERE user_id = v_withdrawal.user_id
          AND type = 'withdrawal'
          AND status = 'pending'
          AND amount = -v_withdrawal.amount
          AND (reference = v_withdrawal.id OR reference IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
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

-- BAN USER
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

-- DELETE USER
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET is_banned = true, is_active = false, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'delete_user', 'profiles', 
            (SELECT id FROM profiles WHERE user_id = p_user_id),
            jsonb_build_object('user_id', p_user_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  DELETE FROM profiles WHERE user_id = p_user_id;
  DELETE FROM wallets WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ACTIVATE PLAN
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
      VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + INTERVAL '7 days');
      
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
    VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + INTERVAL '7 days');
    
    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, p_amount, 'investment', 'Activation pack ' || v_plan.name, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    RETURN jsonb_build_object('success', true, 'upgrade', false);
  END IF;
END;
$$;

-- CREATE TASK
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
            jsonb_build_object('title', p_title, 'amount', p_amount, 'plan_id', p_plan_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);
END;
$$;

-- UPDATE TASK
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

-- DELETE TASK
CREATE OR REPLACE FUNCTION delete_task(
  p_admin_id UUID,
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM tasks WHERE id = p_task_id;
  
  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id)
    VALUES (p_admin_id, 'delete_task', 'tasks', p_task_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- CREATE PLAN
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

-- TOGGLE PLAN STATUS
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
  UPDATE plans SET is_active = p_is_active, updated_at = NOW() WHERE id = p_plan_id;
  
  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'toggle_plan', 'plans', p_plan_id, jsonb_build_object('is_active', p_is_active));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- UPDATE PLAN
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

-- GET PLATFORM STATS
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

-- GET USERS WITH DETAILS
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

-- SUBMIT WITHDRAWAL
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
  v_withdrawal_id UUID;
  v_withdrawal_day INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
  v_min_withdrawal DECIMAL;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  SELECT COALESCE((SELECT value::TEXT::NUMERIC FROM system_settings WHERE key = 'min_withdrawal'), 5000)
  INTO v_min_withdrawal;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'withdrawal_day'), 5)
  INTO v_withdrawal_day;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration;
  
  IF EXTRACT(DOW FROM NOW()) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le vendredi');
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
                    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0);
  
  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Solde retirable insuffisant. Seuls vos gains de tâches sont retirables (montant retirable: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;
  
  -- 💰 Vérifier que le solde du wallet couvre bien le retrait
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde insuffisant pour ce retrait'
    );
  END IF;
  
  -- 💰 Débit UNIQUE À LA DEMANDE (montant réservé immédiatement).
  -- validate_withdrawal ne débitera PLUS au passage à 'paid' → aucun double débit.
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;
  
  BEGIN
    -- Transaction de débit liée au retrait (retrouvée par validate_withdrawal)
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
    VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal', 'Retrait via ' || p_method, 'pending', v_withdrawal_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- SUBMIT DEPOSIT
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

-- ============================================================
-- 7bis. RPC FEEXPAY ATOMIQUES (service_role uniquement)
-- ============================================================
-- Retrait FeeXPay : débit + demande + transaction en UNE transaction,
-- le montant est limité aux GAINS retirables (jamais dépôts/capital).
CREATE OR REPLACE FUNCTION request_withdrawal_feeexpay(
  p_user_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_account_info TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_withdrawable DECIMAL := 0;
  v_withdrawal_id UUID;
  v_role TEXT;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  -- 🔒 Verrouiller le wallet (anti course)
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_amount)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- 💰 Montant retirable = gains - retraits payés - retraits en attente
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
      - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt
                  WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
      - COALESCE((SELECT SUM(w.amount) FROM withdrawals w
                  WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE + demande + transaction
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal',
          COALESCE(p_description, 'Retrait via ' || p_method), 'pending', v_withdrawal_id);

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'withdrawable_amount', v_withdrawable);
END;
$$;

REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

-- Crédit de dépôt FeeXPay ATOMIQUE (verrou ligne + anti double-crédit)
CREATE OR REPLACE FUNCTION credit_feeexpay_deposit(
  p_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deposit deposits%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_role TEXT;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_deposit
  FROM deposits
  WHERE reference = p_reference
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'reason', 'not_found');
  END IF;

  IF v_deposit.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'creditable', false, 'reason', 'already_credited');
  END IF;

  IF v_deposit.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'reason', 'rejected');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_deposit.user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_amount)
    VALUES (v_deposit.user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  UPDATE deposits SET status = 'approved', updated_at = NOW() WHERE id = v_deposit.id;
  UPDATE wallets SET balance = balance + v_deposit.amount, updated_at = NOW() WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (v_deposit.user_id, v_wallet.id, v_deposit.amount, 'deposit',
          'Dépôt via FeeXPay (' || p_reference || ')', 'completed', p_reference);

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (v_deposit.user_id, 'Dépôt confirmé ✅',
          'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été crédité automatiquement.', 'deposit');

  RETURN jsonb_build_object('success', true, 'creditable', true, 'credited', true);
END;
$$;

REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM anon;
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION credit_feeexpay_deposit(TEXT) TO service_role;

-- ============================================================
-- 8. SEED DATA (ON CONFLICT DO NOTHING)
-- ============================================================

-- Default plans
INSERT INTO plans (name, slug, price, daily_tasks, min_profitability, max_profitability, color, icon, badge, sort_order)
VALUES
  ('Bronze', 'bronze', 5000, 1, 10, 20, '#CD7F32', 'Medal', 'Bronze', 1),
  ('Silver', 'silver', 10000, 3, 20, 30, '#C0C0C0', 'Award', 'Silver', 2),
  ('Gold', 'gold', 20000, -1, 40, 50, '#FFD700', 'Crown', 'Premium', 3)
ON CONFLICT (slug) DO NOTHING;

-- Default task categories
INSERT INTO task_categories (name, slug, icon)
VALUES
  ('Telegram', 'telegram', 'Send'),
  ('WhatsApp', 'whatsapp', 'MessageCircle'),
  ('Réseaux sociaux', 'social', 'Share2'),
  ('Visite de site', 'visit', 'Globe'),
  ('Installation', 'install', 'Download'),
  ('Vidéo', 'video', 'Play'),
  ('Questionnaire', 'survey', 'ClipboardList'),
  ('Mission personnalisée', 'custom', 'Target')
ON CONFLICT (slug) DO NOTHING;

-- Default payment methods
INSERT INTO payment_methods (name, slug, icon, instructions)
VALUES
  ('Orange Money', 'orange-money', 'Smartphone', 'Envoyez le montant au numéro +225 0102030405'),
  ('MTN Mobile Money', 'mtn-money', 'Smartphone', 'Envoyez le montant au numéro +225 0506070809'),
  ('Wave', 'wave', 'Building', 'Envoyez via Wave au +225 0102030405'),
  ('Carte bancaire', 'card', 'CreditCard', 'Payez par carte bancaire (Visa/Mastercard)')
ON CONFLICT (slug) DO NOTHING;

-- Default system settings
INSERT INTO system_settings (key, value, description)
VALUES
  ('platform_name', '"Rewardly"', 'Nom de la plateforme'),
  ('min_withdrawal', '5000', 'Montant minimum de retrait'),
  ('withdrawal_day', '5', 'Jour autorisé pour les retraits (0=Dimanche, 5=Vendredi)'),
  ('investment_duration_days', '7', 'Duree d un investissement en jours'),
  ('referral_commission_fixed', '500', 'Commission fixe de parrainage'),
  ('referral_commission_percent', '5', 'Commission en pourcentage de parrainage'),
  ('default_currency', '"XOF"', 'Devise par défaut'),
  ('maintenance_mode', 'false', 'Mode maintenance'),
  ('max_referrals', '50', 'Nombre maximum de filleuls')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 9. SET ADMIN ROLE FOR wlagbema@gmail.com
-- ============================================================
UPDATE profiles
SET role = 'admin',
    is_active = true,
    is_banned = false,
    updated_at = NOW()
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'wlagbema@gmail.com'
);

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

INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
SELECT id, 0, 0, 0, 0
FROM auth.users
WHERE email = 'wlagbema@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = auth.users.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- 10. STORAGE BUCKET (proofs)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proofs',
  'proofs',
  true,
  10485760, -- 10 MB
  ARRAY['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload to their own folder
DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;
CREATE POLICY "Users can upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view proofs" ON storage.objects;
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
CREATE POLICY "Admins can delete proofs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'proofs'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- 11. VERIFICATION
-- ============================================================
-- Vérifie que toutes les tables existent
DO $$
DECLARE
  missing TEXT;
BEGIN
  missing := '';
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN missing := missing || 'profiles, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallets') THEN missing := missing || 'wallets, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'wallet_transactions') THEN missing := missing || 'wallet_transactions, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'plans') THEN missing := missing || 'plans, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'investments') THEN missing := missing || 'investments, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN missing := missing || 'tasks, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'task_submissions') THEN missing := missing || 'task_submissions, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposits') THEN missing := missing || 'deposits, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'withdrawals') THEN missing := missing || 'withdrawals, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN missing := missing || 'notifications, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'system_settings') THEN missing := missing || 'system_settings, '; END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_logs') THEN missing := missing || 'admin_logs, '; END IF;
  
  IF missing != '' THEN
    RAISE EXCEPTION 'Tables manquantes: %', missing;
  END IF;
END $$;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Rewardly schema consolidé appliqué avec succès !';
END $$;

-- ============================================================
-- 12. CORRECTIFS SÉCURITÉ & BUGS (migration 00010)
-- ============================================================
-- ⚠️ IMPORTANT : Ces correctifs sont également dans
-- supabase/migrations/00010_security_and_bugfixes.sql
-- Exécutez la migration 00010 après ce fichier pour appliquer
-- les corrections de sécurité (add_reward, approve_submission,
-- validate_withdrawal, activate_plan, create_task, etc.)
-- ============================================================
-- Les fonctions corrigées sont définies dans la migration 00010.
-- Ce fichier reste la source de vérité pour les tables, RLS,
-- triggers et seed data. La migration 00010 contient les
-- versions corrigées des fonctions RPC.
-- ============================================================
-- REWARDLY - CORRECTIFS SÉCURITÉ & FINANCE (août 2026)
-- ============================================================
-- À exécuter dans le SQL Editor Supabase (ou en migration).
-- Contenu :
--   1. RLS : suppression des politiques permissives sur wallets /
--      wallet_transactions (auto-crédit impossible pour l'utilisateur).
--   2. Trigger anti auto-promotion (role / is_active / is_banned protégés).
--   3. activate_plan : le montant débité = prix du plan (jamais arbitraire).
--   4. Calcul retirable COHÉRENT dans toutes les RPC :
--      gains - retraits payés - retraits pending/approuvés - services.
--   5. submit_withdrawal & submit_deposit : check auth.uid() (défense en profondeur).
--   6. request_withdrawal_feeexpay : règles métier (jour + délai) appliquées.
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- ============================================================
-- 1. RLS : supprimer les politiques dangereuses
-- ============================================================
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.wallet_transactions;

-- ============================================================
-- 2. TRIGGER : bloquer la modification des champs sensibles du profil
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_security_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Un utilisateur AUTHENTIFIÉ (JWT présent) ne peut pas modifier les champs
  -- sensibles de son profil. Seul un admin (ou le service role) peut le faire.
  IF auth.uid() IS NOT NULL THEN
    IF (NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_active IS DISTINCT FROM OLD.is_active
        OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
        OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
      IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Modification non autorisée : rôle/statut protégés';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_profile_security_changes ON public.profiles;
CREATE TRIGGER prevent_profile_security_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_security_changes();
-- ============================================================
-- 3. ACTIVATE PLAN : le montant débité = prix du plan (jamais arbitraire)
-- ============================================================
CREATE OR REPLACE FUNCTION activate_plan(
  p_user_id UUID,
  p_plan_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  -- 🔒 Le montant débité est TOUJOURS le prix du plan (paramètre ignoré)
  p_amount := v_plan.price;

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
-- 4. SUBMIT DEPOSIT : check auth.uid (défense en profondeur)
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
SET search_path = public, auth
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
-- ============================================================
-- 5. SUBMIT WITHDRAWAL : règles métier + calcul retirable cohérent
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
SET search_path = public, auth
AS $$
DECLARE
  v_wallet RECORD;
  v_withdrawable DECIMAL;
  v_withdrawal_id UUID;
  v_min_withdrawal DECIMAL;
  v_withdrawal_day INTEGER;
  v_timezone_offset INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
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
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'withdrawal_timezone_offset'), 0)
  INTO v_timezone_offset;
  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration;

  -- 📅 Jour de retrait (UTC + offset configurable)
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC') + (v_timezone_offset * INTERVAL '1 hour')) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le jour configuré');
  END IF;

  -- ⏳ Délai minimum après le premier investissement
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

  -- 💰 Montant retirable COHÉRENT : gains - retraits payés - retraits
  --    pending/approuvés - paiements services (aligné avec get_withdrawable_amount
  --    et request_withdrawal_feeexpay).
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)'
    );
  END IF;

  -- 💰 Solde total du wallet
  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE à la demande (aucun second débit au passage à 'paid')
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  BEGIN
    INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
    VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal', 'Retrait via ' || p_method, 'pending', v_withdrawal_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'withdrawal_id', v_withdrawal_id, 'withdrawable_amount', v_withdrawable);
END;
$$;
-- ============================================================
-- 6. GET WITHDRAWABLE AMOUNT : calcul cohérent (gains - retraits - services)
-- ============================================================
CREATE OR REPLACE FUNCTION get_withdrawable_amount(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  RETURN jsonb_build_object('success', true, 'withdrawable_amount', GREATEST(v_withdrawable, 0));
END;
$$;
-- ============================================================
-- 7. REQUEST WITHDRAWAL FEEXPAY : règles métier + calcul cohérent
-- ============================================================
CREATE OR REPLACE FUNCTION request_withdrawal_feeexpay(
  p_user_id UUID,
  p_amount DECIMAL,
  p_method TEXT,
  p_account_info TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_withdrawable DECIMAL := 0;
  v_withdrawal_id UUID;
  v_role TEXT;
  v_withdrawal_day INTEGER;
  v_timezone_offset INTEGER;
  v_investment_duration INTEGER;
  v_last_investment RECORD;
BEGIN
  -- 🔒 Appel réservé au serveur (service_role)
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'withdrawal_day'), 5)
  INTO v_withdrawal_day;
  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'withdrawal_timezone_offset'), 0)
  INTO v_timezone_offset;
  SELECT COALESCE((SELECT s.value::text::integer FROM system_settings s WHERE s.key = 'investment_duration_days'), 7)
  INTO v_investment_duration;

  -- 📅 Jour de retrait (UTC + offset)
  IF EXTRACT(DOW FROM (NOW() AT TIME ZONE 'UTC') + (v_timezone_offset * INTERVAL '1 hour')) != v_withdrawal_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les retraits ne sont disponibles que le jour configuré');
  END IF;

  -- ⏳ Délai minimum après le premier investissement
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

  -- 🔒 Verrouiller le wallet (anti course)
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, locked_amount)
    VALUES (p_user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- 💰 Montant retirable cohérent (gains - retraits - services)
  v_withdrawable := COALESCE(v_wallet.total_earnings, 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'withdrawal' AND wt.status = 'completed'), 0)
    - COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.user_id = p_user_id AND w.status IN ('pending', 'approved')), 0)
    - COALESCE((SELECT SUM(ABS(wt.amount)) FROM wallet_transactions wt WHERE wt.user_id = p_user_id AND wt.type = 'service'), 0);

  IF v_withdrawable < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde retirable insuffisant. Seuls vos gains sont retirables (disponible: ' || v_withdrawable::TEXT || ' FCFA)');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce retrait');
  END IF;

  -- 💸 Débit UNIQUE + demande + transaction (ATOMIQUE)
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO withdrawals (user_id, amount, method, account_info, status)
  VALUES (p_user_id, p_amount, p_method, p_account_info, 'pending')
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (p_user_id, v_wallet.id, -p_amount, 'withdrawal',
          COALESCE(p_description, 'Retrait via ' || p_method), 'pending', v_withdrawal_id);

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'withdrawable_amount', v_withdrawable
  );
END;
$$;

REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================
-- 8. PRIVILÈGES D'EXÉCUTION des fonctions corrigées
-- ============================================================
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_withdrawable_amount(UUID) TO authenticated;
-- 🔒 Défense en profondeur : réserver les RPC financières user-facing au rôle
--    authenticated (l'anon ne doit PAS pouvoir les appeler).
REVOKE ALL ON FUNCTION activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_withdrawable_amount(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;
