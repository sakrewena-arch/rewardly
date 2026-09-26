-- ======================================================================
-- REWARDLY — SCHÉMA — extensions, types, tables, index, seeds, storage   (étape 1/4)
-- GÉNÉRÉ par scripts/build-supabase-setup.mjs — NE PAS ÉDITER À LA MAIN.
-- Modifier supabase/migrations/, puis régénérer.
-- À exécuter en premier (idempotent).
-- ======================================================================

-- [supabase/legacy/consolidated_schema.sql:1]
-- ============================================================
-- REWARDLY - CONSOLIDATED SCHEMA (IDEMPOTENT)
-- ============================================================
-- Ce fichier regroupe TOUT le SQL nécessaire pour la plateforme.
-- Il est IDEMPOTENT : peut être exécuté plusieurs fois sans erreur.
-- Utilise IF NOT EXISTS / DROP IF EXISTS / DO $ $ blocks partout.
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- [supabase/legacy/consolidated_schema.sql:1]
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

-- [supabase/legacy/consolidated_schema.sql:1]
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

-- [supabase/legacy/consolidated_schema.sql:1]
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

-- [supabase/legacy/consolidated_schema.sql:1]
-- Compatibilité : applique le type 'service' sur les bases existantes (idempotent)
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- [supabase/legacy/consolidated_schema.sql:63]
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment', 'service'));

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
-- TASK CATEGORIES
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'CheckSquare',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
-- SUBMISSION ANSWERS
CREATE TABLE IF NOT EXISTS submission_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES submission_fields(id) ON DELETE CASCADE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
-- REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  commission DECIMAL(12,0) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/legacy/consolidated_schema.sql:63]
-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
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

-- [supabase/legacy/consolidated_schema.sql:63]
-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/legacy/consolidated_schema.sql:63]
-- ============================================================
-- 3. INDEXES (IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- [supabase/legacy/consolidated_schema.sql:286]
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- [supabase/legacy/consolidated_schema.sql:287]
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- [supabase/legacy/consolidated_schema.sql:288]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);

-- [supabase/legacy/consolidated_schema.sql:289]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

-- [supabase/legacy/consolidated_schema.sql:290]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- [supabase/legacy/consolidated_schema.sql:291]
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

-- [supabase/legacy/consolidated_schema.sql:292]
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- [supabase/legacy/consolidated_schema.sql:293]
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);

-- [supabase/legacy/consolidated_schema.sql:294]
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON tasks(is_active);

-- [supabase/legacy/consolidated_schema.sql:295]
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON task_submissions(user_id);

-- [supabase/legacy/consolidated_schema.sql:296]
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);

-- [supabase/legacy/consolidated_schema.sql:297]
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);

-- [supabase/legacy/consolidated_schema.sql:298]
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- [supabase/legacy/consolidated_schema.sql:299]
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);

-- [supabase/legacy/consolidated_schema.sql:300]
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- [supabase/legacy/consolidated_schema.sql:301]
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- [supabase/legacy/consolidated_schema.sql:302]
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- [supabase/legacy/consolidated_schema.sql:303]
CREATE INDEX IF NOT EXISTS idx_daily_statistics_user_date ON daily_statistics(user_id, date);

-- [supabase/legacy/consolidated_schema.sql:304]
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);

-- [supabase/legacy/consolidated_schema.sql:305]
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- [supabase/legacy/consolidated_schema.sql:470]
-- ============================================================
-- 6. ROW LEVEL SECURITY (ENABLE + POLICIES)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:489]
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:490]
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:491]
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:492]
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:493]
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:494]
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:495]
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:496]
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:497]
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:498]
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:499]
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:500]
ALTER TABLE submission_fields ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:501]
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:502]
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:503]
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:504]
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:505]
ALTER TABLE daily_statistics ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:506]
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:507]
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- [supabase/legacy/consolidated_schema.sql:507]
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

-- [supabase/legacy/consolidated_schema.sql:1959]
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

-- [supabase/legacy/consolidated_schema.sql:1959]
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

-- [supabase/legacy/consolidated_schema.sql:1959]
-- Default payment methods
INSERT INTO payment_methods (name, slug, icon, instructions)
VALUES
  ('Orange Money', 'orange-money', 'Smartphone', 'Envoyez le montant au numéro +225 0102030405'),
  ('MTN Mobile Money', 'mtn-money', 'Smartphone', 'Envoyez le montant au numéro +225 0506070809'),
  ('Wave', 'wave', 'Building', 'Envoyez via Wave au +225 0102030405'),
  ('Carte bancaire', 'card', 'CreditCard', 'Payez par carte bancaire (Visa/Mastercard)')
ON CONFLICT (slug) DO NOTHING;

-- [supabase/legacy/consolidated_schema.sql:1959]
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

-- [supabase/legacy/consolidated_schema.sql:1959]
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

-- [supabase/legacy/consolidated_schema.sql:2021]
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

-- [supabase/legacy/consolidated_schema.sql:2037]
INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
SELECT id, 0, 0, 0, 0
FROM auth.users
WHERE email = 'wlagbema@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = auth.users.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/legacy/consolidated_schema.sql:2037]
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

-- [supabase/legacy/consolidated_schema.sql:2082]
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

-- [supabase/legacy/consolidated_schema.sql:2082]
-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Rewardly schema consolidé appliqué avec succès !';
END $$;

-- [supabase/migrations/00001_initial_schema.sql:1]
-- ============================================
-- WALLET TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(12,0) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment')),
  description TEXT,
  reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/migrations/00003_system_users.sql:1]
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

-- [supabase/migrations/00003_system_users.sql:1]
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

-- [supabase/migrations/00003_system_users.sql:1]
-- ============================================
-- ENSURE PROFILES AND WALLETS EXIST
-- (in case the trigger was already fired or doesn't run)
-- ============================================
INSERT INTO profiles (user_id, full_name, username, role, referral_code)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'System Admin', 'system-admin', 'super_admin', 'SYSADMIN01'),
  ('00000000-0000-0000-0000-000000000001', 'System User', 'system-user', 'user', 'SYSUSER01')
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/migrations/00003_system_users.sql:43]
INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 0, 0, 0, 0),
  ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/migrations/00003_system_users.sql:43]
-- ============================================
-- DROP FK CONSTRAINTS TO auth.users
-- So public access works even without real auth users
-- ============================================

-- admin_logs
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;

-- [supabase/migrations/00003_system_users.sql:43]
-- task_submissions
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:59]
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_reviewed_by_fkey;

-- [supabase/migrations/00003_system_users.sql:59]
-- deposits
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:63]
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_reviewed_by_fkey;

-- [supabase/migrations/00003_system_users.sql:63]
-- withdrawals
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_reviewed_by_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- wallets
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- wallet_transactions
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- investments
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

-- [supabase/migrations/00003_system_users.sql:67]
-- referrals
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;

-- [supabase/migrations/00003_system_users.sql:89]
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;

-- [supabase/migrations/00003_system_users.sql:89]
-- daily_statistics
ALTER TABLE daily_statistics DROP CONSTRAINT IF EXISTS daily_statistics_user_id_fkey;

-- [supabase/migrations/00004_fix_task_creation.sql:41]
-- ============================================
-- CREATE SYSTEM USERS IN auth.users (if not exists)
-- ============================================
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'system-admin@rewardly.local', '{"full_name": "System Admin"}'::jsonb, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'system-user@rewardly.local', '{"full_name": "System User"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- [supabase/migrations/00006_cleanup_data.sql:1]
-- Rewardly Cleanup Data
-- Migration 00006: Clean all existing demo/system data
-- Requirement: "efface les données des comptes existants et supprime les comptes"

-- ============================================
-- DELETE ALL EXISTING DATA (order matters for FK)
-- ============================================
DELETE FROM submission_answers;

-- [supabase/migrations/00006_cleanup_data.sql:9]
DELETE FROM submission_fields;

-- [supabase/migrations/00006_cleanup_data.sql:10]
DELETE FROM task_submissions;

-- [supabase/migrations/00006_cleanup_data.sql:11]
DELETE FROM tasks;

-- [supabase/migrations/00006_cleanup_data.sql:12]
DELETE FROM task_categories;

-- [supabase/migrations/00006_cleanup_data.sql:13]
DELETE FROM deposits;

-- [supabase/migrations/00006_cleanup_data.sql:14]
DELETE FROM withdrawals;

-- [supabase/migrations/00006_cleanup_data.sql:15]
DELETE FROM wallet_transactions;

-- [supabase/migrations/00006_cleanup_data.sql:16]
DELETE FROM investments;

-- [supabase/migrations/00006_cleanup_data.sql:17]
DELETE FROM referrals;

-- [supabase/migrations/00006_cleanup_data.sql:18]
DELETE FROM notifications;

-- [supabase/migrations/00006_cleanup_data.sql:19]
DELETE FROM admin_logs;

-- [supabase/migrations/00006_cleanup_data.sql:20]
DELETE FROM daily_statistics;

-- [supabase/migrations/00006_cleanup_data.sql:21]
DELETE FROM wallets;

-- [supabase/migrations/00006_cleanup_data.sql:22]
DELETE FROM profiles;

-- [supabase/migrations/00006_cleanup_data.sql:22]
-- Delete system users from auth.users (except the authenticated users)
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001'
);

-- [supabase/migrations/00006_cleanup_data.sql:22]
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

-- [supabase/migrations/00006_cleanup_data.sql:47]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_fkey') THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:54]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_user_id_fkey') THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:61]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_user_id_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:68]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_reviewed_by_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:75]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_user_id_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:82]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_reviewed_by_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:89]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_user_id_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:96]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_reviewed_by_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:103]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:110]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investments_user_id_fkey') THEN
    ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:117]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_logs_admin_id_fkey') THEN
    ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:124]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:131]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey
      FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00006_cleanup_data.sql:138]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_statistics_user_id_fkey') THEN
    ALTER TABLE daily_statistics ADD CONSTRAINT daily_statistics_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/migrations/00009_feexpay_integration.sql:1]
-- ============================================================
-- MIGRATION : Intégration FeeXPay
-- Ajoute les colonnes nécessaires pour les dépôts et retraits
-- ============================================================

-- 1. Ajouter les colonnes à la table deposits
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- [supabase/migrations/00009_feexpay_integration.sql:1]
-- 2. Ajouter les colonnes à la table withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_info TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- [supabase/migrations/00009_feexpay_integration.sql:1]
-- 3. Index pour les recherches par référence FeeXPay
CREATE INDEX IF NOT EXISTS idx_deposits_feexpay_reference ON public.deposits(feexpay_reference);

-- [supabase/migrations/00009_feexpay_integration.sql:20]
CREATE INDEX IF NOT EXISTS idx_withdrawals_feexpay_reference ON public.withdrawals(feexpay_reference);

-- [supabase/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 17. AJOUTER withdrawal_timezone_offset aux settings par défaut
-- ============================================================
INSERT INTO system_settings (key, value, description)
VALUES ('withdrawal_timezone_offset', '0', 'Offset fuseau pour le jour de retrait (heures, défaut 0 = UTC)')
ON CONFLICT (key) DO NOTHING;

-- [supabase/migrations/00011_user_preferences.sql:1]
-- ============================================================
-- Table des préférences utilisateur (langue, devise, notifications)
-- ============================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'fr',
  currency text not null default 'XOF',
  push_notifications boolean not null default true,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [supabase/migrations/00011_user_preferences.sql:24]
-- RLS
alter table public.user_preferences enable row level security;

-- [supabase/migrations/00012_service_orders.sql:1]
-- ============================================================
-- Table des commandes de services publicitaires
-- ============================================================
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_name text not null,
  contact_email text not null,
  contact_phone text not null,
  service_type text not null, -- sondage, visite, test_jeu, test_app, test_site, test_ia, autre
  description text,
  pack text not null, -- 500k, 1m, 2m
  pack_amount numeric not null,
  duration text not null, -- 30j, 60j, 90j, illimite
  target_users integer, -- nombre d'utilisateurs visés
  url text, -- URL du site à visiter/tester
  download_url text, -- URL de téléchargement (jeu, app)
  questions text, -- questions du sondage
  ia_url text, -- URL de l'IA à tester
  app_name text, -- nom de l'application/IA
  game_name text, -- nom du jeu
  site_name text, -- nom du site web
  instructions text, -- instructions pour les utilisateurs
  status text not null default 'pending', -- pending, approved, rejected, completed
  payment_status text not null default 'paid', -- paid, refunded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [supabase/migrations/00012_service_orders.sql:32]
-- RLS
alter table public.service_orders enable row level security;

-- [supabase/migrations/00016_push_tokens.sql:1]
-- ============================================================
-- MIGRATION 00016 : TOKENS PUSH NATIFS (Capacitor)
-- ============================================================
-- Stocke les tokens FCM (Android) / APNs (iOS) fournis par le plugin
-- @capacitor/push-notifications pour chaque utilisateur.
-- L'app web (chargée dans la WebView) envoie le token via la Server Action
-- registerPushTokenAction lorsque la plateforme native est détectée.
-- ============================================================

-- Table des tokens de push par utilisateur
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- [supabase/migrations/00016_push_tokens.sql:1]
-- Index pour rechercher rapidement les tokens d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- [supabase/migrations/00016_push_tokens.sql:1]
-- RLS : un utilisateur ne peut gérer que SES tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- [supabase/migrations/00016_push_tokens.sql:27]
DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;

-- [supabase/migrations/00016_push_tokens.sql:28]
CREATE POLICY push_tokens_select_own
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- [supabase/migrations/00016_push_tokens.sql:32]
DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;

-- [supabase/migrations/00016_push_tokens.sql:33]
CREATE POLICY push_tokens_insert_own
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- [supabase/migrations/00016_push_tokens.sql:37]
DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;

-- [supabase/migrations/00016_push_tokens.sql:38]
CREATE POLICY push_tokens_delete_own
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- [supabase/migrations/00018_reminder_notifications.sql:1]
-- ============================================================
-- REWARDLY - NOTIFICATIONS DE RAPPEL (août 2026)
-- ============================================================
-- Les notifications de rappel ("Effectuez vos tâches aujourd'hui",
-- "Passez au plan supérieur", "Dépôt en attente") sont générées côté
-- application (Server Action generateDailyRemindersAction + cron
-- sendReminderNotificationsAction) avec déduplication par jour.
--
-- Cette migration ajoute une colonne `reference` sur notifications pour
-- permettre une déduplication robuste (clé unique métier, ex: date).
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference TEXT;

-- [supabase/migrations/00018_reminder_notifications.sql:17]
CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON public.notifications(reference);

-- [supabase/migrations/00020_ensure_wallet_columns.sql:1]
-- ============================================================
-- REWARDLY - S'assurer que wallets possède les colonnes financières
-- ============================================================
-- Certaines bases de production ont été créées avec un schéma `wallets`
-- incomplet (balance uniquement). Les RPC et le code supposent :
--   balance, invested_capital, total_earnings, locked_amount
-- Cette migration ajoute les colonnes manquantes SANS toucher aux données.
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS invested_capital DECIMAL(12,0) NOT NULL DEFAULT 0;

-- [supabase/migrations/00020_ensure_wallet_columns.sql:14]
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,0) NOT NULL DEFAULT 0;

-- [supabase/migrations/00020_ensure_wallet_columns.sql:17]
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS locked_amount DECIMAL(12,0) NOT NULL DEFAULT 0;

-- [supabase/migrations/00020_ensure_wallet_columns.sql:17]
-- Vérification
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'wallets'
order by ordinal_position;

-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:134]
-- ============================================================
-- 3. GARANTIR profiles.referred_by (si absente)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- [supabase/migrations/00022_referral_investment_commission.sql:1]
-- ============================================================
-- MIGRATION 00022 : PARRAINAGE = 10% DE L'INVESTISSEMENT DU FILLEUL
-- ============================================================
-- PROBLÈME CORRIGÉ
--   Avant : dès qu'un utilisateur s'inscrivait avec un code de parrainage
--   (ou saisissait le code après inscription), le parrain recevait
--   AUTOMATIQUEMENT 500 FCFA (system_settings.referral_commission_fixed),
--   même si le filleul n'investissait jamais.
--
--   Après : AUCUN crédit à l'inscription / à la saisie du code.
--   Le parrain touche `referral_commission_percent` % (défaut 10%) du
--   MONTANT RÉELLEMENT INVESTI par son filleul, au moment où celui-ci
--   active (ou upgrade) un pack -> fonction activate_plan().
--     • activation d'un pack 10 000  -> parrain +1 000
--     • upgrade 10 000 -> 20 000     -> parrain +1 000 (soit 10% des
--       10 000 réellement investis en plus, pas du prix total)
--     • filleul qui n'investit pas   -> parrain +0
--
-- CONTENU
--   1. rewardly_handle_new_user()      : relation de parrainage SANS crédit
--   2. credit_referral_commission()    : crédit générique (%), anti-doublon
--   3. activate_plan()                 : appelle le crédit sur l'investissement
--   4. system_settings                 : referral_commission_percent = 10
--   5. REVOKE/GRANT                    : la fonction de commission n'est
--      appelable QUE par les fonctions serveur (service_role), jamais par
--      un client anon/authenticated (anti auto-crédit).
-- IDEMPOTENT : exécutable plusieurs fois sans erreur.
-- ============================================================

-- ============================================================
-- 0. Colonnes de réglage (sécurité : la clé doit exister)
-- ============================================================
INSERT INTO public.system_settings (key, value, description)
VALUES ('referral_commission_percent', '10'::jsonb, 'Pourcentage de parrainage sur l''investissement du filleul')
ON CONFLICT (key) DO NOTHING;

-- [supabase/migrations/00022_referral_investment_commission.sql:1]
-- Passe l'ancienne valeur (5%) à 10% ; laisse toute autre valeur choisie par l'admin.
UPDATE public.system_settings
SET value = '10'::jsonb, updated_at = NOW()
WHERE key = 'referral_commission_percent'
  AND COALESCE(value::text, '') IN ('5', '"5"');

-- [supabase/migrations/00022_referral_investment_commission.sql:1]
-- La commission fixe n'est plus utilisée par le parrainage (conservée pour
-- compatibilité de l'écran admin / de la validation Zod).
INSERT INTO public.system_settings (key, value, description)
VALUES ('referral_commission_fixed', '0'::jsonb, 'OBSOLÈTE : plus utilisée (parrainage = % de l''investissement)')
ON CONFLICT (key) DO NOTHING;

-- [supabase/migrations/00022_referral_investment_commission.sql:370]
-- ============================================================
-- 5. AUDIT (optionnel) — anciennes commissions de 500 FCFA
-- ============================================================
-- Cette migration ne supprime AUCUN historique : les commissions fixes
-- déjà versées restent visibles. Pour les inspecter :
--
--   SELECT wt.created_at, wt.user_id AS parrain, wt.amount, wt.description
--   FROM public.wallet_transactions wt
--   WHERE wt.type = 'referral' AND wt.amount = 500
--   ORDER BY wt.created_at DESC;
--
-- Pour annuler un crédit (à faire au cas par cas) :
--
--   UPDATE public.wallets SET balance = balance - 500,
--                             total_earnings = GREATEST(0, total_earnings - 500)
--   WHERE user_id = '<PARRAIN_UUID>';
--   UPDATE public.wallet_transactions SET status = 'failed' WHERE id = '<TX_UUID>';
-- ============================================================
