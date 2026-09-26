/*
 * ==========================================================================
 * REWARDLY — INSTALLATION / MISE À JOUR COMPLÈTE DE LA BASE DE DONNÉES
 * ==========================================================================
 *
 * ⭐ FICHIER UNIQUE À EXÉCUTER :
 *      Supabase → SQL Editor → coller TOUT ce fichier → Run
 *
 * ✅ Idempotent : peut être exécuté plusieurs fois, sans erreur et
 *    sans perte de données (CREATE IF NOT EXISTS / DROP IF EXISTS /
 *    CREATE OR REPLACE / DROP FUNCTION puis CREATE pour les RPC).
 *
 * Contenu :
--   • §1 — SCHÉMA (tables, index, types, seeds, stockage)
--   • §2 — FONCTIONS (34)
--   • §3 — TRIGGERS (12) + RLS (106 policies)
--   • §4 — PRIVILÈGES (GRANT/REVOKE + durcissement)
 *
 * ⚠️ NE PAS ÉDITER À LA MAIN : ce fichier est GÉNÉRÉ par
 *    scripts/build-supabase-setup.mjs à partir de supabase/sources/
 *    (modifier une migration dans supabase/sources/migrations/, puis
 *     exécuter : npm run db:build).
 *
 * ==========================================================================
 */


/* ======================================================================
 * §1 — SCHÉMA (tables, index, types, seeds, stockage)
 * ====================================================================== */

-- [supabase/sources/base_schema.sql:1]
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

-- [supabase/sources/base_schema.sql:1]
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

-- [supabase/sources/base_schema.sql:1]
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

-- [supabase/sources/base_schema.sql:1]
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

-- [supabase/sources/base_schema.sql:1]
-- Compatibilité : applique le type 'service' sur les bases existantes (idempotent)
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

-- [supabase/sources/base_schema.sql:63]
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment', 'service'));

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
-- TASK CATEGORIES
CREATE TABLE IF NOT EXISTS task_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'CheckSquare',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
-- SUBMISSION ANSWERS
CREATE TABLE IF NOT EXISTS submission_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES task_submissions(id) ON DELETE CASCADE NOT NULL,
  field_id UUID REFERENCES submission_fields(id) ON DELETE CASCADE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
-- REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  commission DECIMAL(12,0) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/sources/base_schema.sql:63]
-- SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
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

-- [supabase/sources/base_schema.sql:63]
-- ANNOUNCEMENTS
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- [supabase/sources/base_schema.sql:63]
-- ============================================================
-- 3. INDEXES (IF NOT EXISTS)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- [supabase/sources/base_schema.sql:286]
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- [supabase/sources/base_schema.sql:287]
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- [supabase/sources/base_schema.sql:288]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);

-- [supabase/sources/base_schema.sql:289]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

-- [supabase/sources/base_schema.sql:290]
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

-- [supabase/sources/base_schema.sql:291]
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

-- [supabase/sources/base_schema.sql:292]
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- [supabase/sources/base_schema.sql:293]
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON tasks(plan_id);

-- [supabase/sources/base_schema.sql:294]
CREATE INDEX IF NOT EXISTS idx_tasks_is_active ON tasks(is_active);

-- [supabase/sources/base_schema.sql:295]
CREATE INDEX IF NOT EXISTS idx_task_submissions_user_id ON task_submissions(user_id);

-- [supabase/sources/base_schema.sql:296]
CREATE INDEX IF NOT EXISTS idx_task_submissions_status ON task_submissions(status);

-- [supabase/sources/base_schema.sql:297]
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);

-- [supabase/sources/base_schema.sql:298]
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- [supabase/sources/base_schema.sql:299]
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);

-- [supabase/sources/base_schema.sql:300]
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- [supabase/sources/base_schema.sql:301]
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- [supabase/sources/base_schema.sql:302]
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- [supabase/sources/base_schema.sql:303]
CREATE INDEX IF NOT EXISTS idx_daily_statistics_user_date ON daily_statistics(user_id, date);

-- [supabase/sources/base_schema.sql:304]
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);

-- [supabase/sources/base_schema.sql:305]
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- [supabase/sources/base_schema.sql:470]
-- ============================================================
-- 6. ROW LEVEL SECURITY (ENABLE + POLICIES)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:489]
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:490]
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:491]
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:492]
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:493]
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:494]
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:495]
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:496]
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:497]
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:498]
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:499]
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:500]
ALTER TABLE submission_fields ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:501]
ALTER TABLE submission_answers ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:502]
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:503]
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:504]
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:505]
ALTER TABLE daily_statistics ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:506]
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:507]
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/base_schema.sql:507]
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

-- [supabase/sources/base_schema.sql:1959]
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

-- [supabase/sources/base_schema.sql:1959]
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

-- [supabase/sources/base_schema.sql:1959]
-- Default payment methods
INSERT INTO payment_methods (name, slug, icon, instructions)
VALUES
  ('Orange Money', 'orange-money', 'Smartphone', 'Envoyez le montant au numéro +225 0102030405'),
  ('MTN Mobile Money', 'mtn-money', 'Smartphone', 'Envoyez le montant au numéro +225 0506070809'),
  ('Wave', 'wave', 'Building', 'Envoyez via Wave au +225 0102030405'),
  ('Carte bancaire', 'card', 'CreditCard', 'Payez par carte bancaire (Visa/Mastercard)')
ON CONFLICT (slug) DO NOTHING;

-- [supabase/sources/base_schema.sql:1959]
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

-- [supabase/sources/base_schema.sql:1959]
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

-- [supabase/sources/base_schema.sql:2021]
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

-- [supabase/sources/base_schema.sql:2037]
INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
SELECT id, 0, 0, 0, 0
FROM auth.users
WHERE email = 'wlagbema@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM wallets w WHERE w.user_id = auth.users.id
  )
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/sources/base_schema.sql:2037]
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

-- [supabase/sources/base_schema.sql:2082]
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

-- [supabase/sources/base_schema.sql:2082]
-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Rewardly schema consolidé appliqué avec succès !';
END $$;

-- [supabase/sources/migrations/00001_initial_schema.sql:1]
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

-- [supabase/sources/migrations/00003_system_users.sql:1]
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

-- [supabase/sources/migrations/00003_system_users.sql:1]
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

-- [supabase/sources/migrations/00003_system_users.sql:1]
-- ============================================
-- ENSURE PROFILES AND WALLETS EXIST
-- (in case the trigger was already fired or doesn't run)
-- ============================================
INSERT INTO profiles (user_id, full_name, username, role, referral_code)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'System Admin', 'system-admin', 'super_admin', 'SYSADMIN01'),
  ('00000000-0000-0000-0000-000000000001', 'System User', 'system-user', 'user', 'SYSUSER01')
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/sources/migrations/00003_system_users.sql:43]
INSERT INTO wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 0, 0, 0, 0),
  ('00000000-0000-0000-0000-000000000001', 0, 0, 0, 0)
ON CONFLICT (user_id) DO NOTHING;

-- [supabase/sources/migrations/00003_system_users.sql:43]
-- ============================================
-- DROP FK CONSTRAINTS TO auth.users
-- So public access works even without real auth users
-- ============================================

-- admin_logs
ALTER TABLE admin_logs DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:43]
-- task_submissions
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:59]
ALTER TABLE task_submissions DROP CONSTRAINT IF EXISTS task_submissions_reviewed_by_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:59]
-- deposits
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:63]
ALTER TABLE deposits DROP CONSTRAINT IF EXISTS deposits_reviewed_by_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:63]
-- withdrawals
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
ALTER TABLE withdrawals DROP CONSTRAINT IF EXISTS withdrawals_reviewed_by_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- wallets
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- wallet_transactions
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- investments
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:67]
-- referrals
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:89]
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;

-- [supabase/sources/migrations/00003_system_users.sql:89]
-- daily_statistics
ALTER TABLE daily_statistics DROP CONSTRAINT IF EXISTS daily_statistics_user_id_fkey;

-- [supabase/sources/migrations/00004_fix_task_creation.sql:41]
-- ============================================
-- CREATE SYSTEM USERS IN auth.users (if not exists)
-- ============================================
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'system-admin@rewardly.local', '{"full_name": "System Admin"}'::jsonb, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'system-user@rewardly.local', '{"full_name": "System User"}'::jsonb, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- [supabase/sources/migrations/00006_cleanup_data.sql:1]
-- Rewardly Cleanup Data
-- Migration 00006: Clean all existing demo/system data
-- Requirement: "efface les données des comptes existants et supprime les comptes"

-- ============================================
-- DELETE ALL EXISTING DATA (order matters for FK)
-- ============================================
DELETE FROM submission_answers;

-- [supabase/sources/migrations/00006_cleanup_data.sql:9]
DELETE FROM submission_fields;

-- [supabase/sources/migrations/00006_cleanup_data.sql:10]
DELETE FROM task_submissions;

-- [supabase/sources/migrations/00006_cleanup_data.sql:11]
DELETE FROM tasks;

-- [supabase/sources/migrations/00006_cleanup_data.sql:12]
DELETE FROM task_categories;

-- [supabase/sources/migrations/00006_cleanup_data.sql:13]
DELETE FROM deposits;

-- [supabase/sources/migrations/00006_cleanup_data.sql:14]
DELETE FROM withdrawals;

-- [supabase/sources/migrations/00006_cleanup_data.sql:15]
DELETE FROM wallet_transactions;

-- [supabase/sources/migrations/00006_cleanup_data.sql:16]
DELETE FROM investments;

-- [supabase/sources/migrations/00006_cleanup_data.sql:17]
DELETE FROM referrals;

-- [supabase/sources/migrations/00006_cleanup_data.sql:18]
DELETE FROM notifications;

-- [supabase/sources/migrations/00006_cleanup_data.sql:19]
DELETE FROM admin_logs;

-- [supabase/sources/migrations/00006_cleanup_data.sql:20]
DELETE FROM daily_statistics;

-- [supabase/sources/migrations/00006_cleanup_data.sql:21]
DELETE FROM wallets;

-- [supabase/sources/migrations/00006_cleanup_data.sql:22]
DELETE FROM profiles;

-- [supabase/sources/migrations/00006_cleanup_data.sql:22]
-- Delete system users from auth.users (except the authenticated users)
DELETE FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001'
);

-- [supabase/sources/migrations/00006_cleanup_data.sql:22]
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

-- [supabase/sources/migrations/00006_cleanup_data.sql:47]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_fkey') THEN
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:54]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_user_id_fkey') THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:61]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_user_id_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:68]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_submissions_reviewed_by_fkey') THEN
    ALTER TABLE task_submissions ADD CONSTRAINT task_submissions_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:75]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_user_id_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:82]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_reviewed_by_fkey') THEN
    ALTER TABLE deposits ADD CONSTRAINT deposits_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:89]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_user_id_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:96]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawals_reviewed_by_fkey') THEN
    ALTER TABLE withdrawals ADD CONSTRAINT withdrawals_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:103]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:110]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'investments_user_id_fkey') THEN
    ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:117]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_logs_admin_id_fkey') THEN
    ALTER TABLE admin_logs ADD CONSTRAINT admin_logs_admin_id_fkey
      FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:124]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referrer_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:131]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_referred_id_fkey') THEN
    ALTER TABLE referrals ADD CONSTRAINT referrals_referred_id_fkey
      FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00006_cleanup_data.sql:138]
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_statistics_user_id_fkey') THEN
    ALTER TABLE daily_statistics ADD CONSTRAINT daily_statistics_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- [supabase/sources/migrations/00009_feexpay_integration.sql:1]
-- ============================================================
-- MIGRATION : Intégration FeeXPay
-- Ajoute les colonnes nécessaires pour les dépôts et retraits
-- ============================================================

-- 1. Ajouter les colonnes à la table deposits
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- [supabase/sources/migrations/00009_feexpay_integration.sql:1]
-- 2. Ajouter les colonnes à la table withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_info TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- [supabase/sources/migrations/00009_feexpay_integration.sql:1]
-- 3. Index pour les recherches par référence FeeXPay
CREATE INDEX IF NOT EXISTS idx_deposits_feexpay_reference ON public.deposits(feexpay_reference);

-- [supabase/sources/migrations/00009_feexpay_integration.sql:20]
CREATE INDEX IF NOT EXISTS idx_withdrawals_feexpay_reference ON public.withdrawals(feexpay_reference);

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 17. AJOUTER withdrawal_timezone_offset aux settings par défaut
-- ============================================================
INSERT INTO system_settings (key, value, description)
VALUES ('withdrawal_timezone_offset', '0', 'Offset fuseau pour le jour de retrait (heures, défaut 0 = UTC)')
ON CONFLICT (key) DO NOTHING;

-- [supabase/sources/migrations/00011_user_preferences.sql:1]
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

-- [supabase/sources/migrations/00011_user_preferences.sql:24]
-- RLS
alter table public.user_preferences enable row level security;

-- [supabase/sources/migrations/00012_service_orders.sql:1]
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

-- [supabase/sources/migrations/00012_service_orders.sql:32]
-- RLS
alter table public.service_orders enable row level security;

-- [supabase/sources/migrations/00016_push_tokens.sql:1]
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

-- [supabase/sources/migrations/00016_push_tokens.sql:1]
-- Index pour rechercher rapidement les tokens d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- [supabase/sources/migrations/00016_push_tokens.sql:1]
-- RLS : un utilisateur ne peut gérer que SES tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- [supabase/sources/migrations/00016_push_tokens.sql:27]
DROP POLICY IF EXISTS push_tokens_select_own ON public.push_tokens;

-- [supabase/sources/migrations/00016_push_tokens.sql:28]
CREATE POLICY push_tokens_select_own
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- [supabase/sources/migrations/00016_push_tokens.sql:32]
DROP POLICY IF EXISTS push_tokens_insert_own ON public.push_tokens;

-- [supabase/sources/migrations/00016_push_tokens.sql:33]
CREATE POLICY push_tokens_insert_own
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- [supabase/sources/migrations/00016_push_tokens.sql:37]
DROP POLICY IF EXISTS push_tokens_delete_own ON public.push_tokens;

-- [supabase/sources/migrations/00016_push_tokens.sql:38]
CREATE POLICY push_tokens_delete_own
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- [supabase/sources/migrations/00018_reminder_notifications.sql:1]
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

-- [supabase/sources/migrations/00018_reminder_notifications.sql:17]
CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON public.notifications(reference);

-- [supabase/sources/migrations/00020_ensure_wallet_columns.sql:1]
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

-- [supabase/sources/migrations/00020_ensure_wallet_columns.sql:14]
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,0) NOT NULL DEFAULT 0;

-- [supabase/sources/migrations/00020_ensure_wallet_columns.sql:17]
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS locked_amount DECIMAL(12,0) NOT NULL DEFAULT 0;

-- [supabase/sources/migrations/00020_ensure_wallet_columns.sql:17]
-- Vérification
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'wallets'
order by ordinal_position;

-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:134]
-- ============================================================
-- 3. GARANTIR profiles.referred_by (si absente)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id);

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:1]
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

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:1]
-- Passe l'ancienne valeur (5%) à 10% ; laisse toute autre valeur choisie par l'admin.
UPDATE public.system_settings
SET value = '10'::jsonb, updated_at = NOW()
WHERE key = 'referral_commission_percent'
  AND COALESCE(value::text, '') IN ('5', '"5"');

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:1]
-- La commission fixe n'est plus utilisée par le parrainage (conservée pour
-- compatibilité de l'écran admin / de la validation Zod).
INSERT INTO public.system_settings (key, value, description)
VALUES ('referral_commission_fixed', '0'::jsonb, 'OBSOLÈTE : plus utilisée (parrainage = % de l''investissement)')
ON CONFLICT (key) DO NOTHING;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:370]
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

-- [supabase/sources/migrations/00023_restore_default_plans.sql:1]
-- ============================================================
-- MIGRATION 00023 : RÉTABLIR LES PACKS PAR DÉFAUT (Bronze / Silver / Gold)
-- ============================================================
-- PROBLÈME CORRIGÉ
--   L'application n'affiche et n'active un pack que s'il est **ACTIF** :
--     • `getPlans()` filtre `is_active = true` ;
--     • la page /invest cherche le pack par `slug` puis appelle
--       `activate_plan(plan_id, …)` → si le slug n'existe pas ou n'est pas
--       actif, l'utilisateur voit « Impossible de trouver le plan ».
--   Or l'ancien seed utilisait « ON CONFLICT (slug) DO NOTHING » : il ne
--   rétablissait JAMAIS un pack supprimé, ni un pack désactivé
--   (typiquement après un reset ou une base construite avec une autre
--   version du schéma).
--
-- CE QUE FAIT CE SCRIPT (idempotent, sans dépendre d'index unique)
--   1. garantit les colonnes utilisées par l'application ;
--   2. (re)crée les 3 packs s'ils manquent ;
--   3. réactive les 3 packs par défaut SI la plateforme n'a AUCUN pack actif ;
--   4. complète les champs d'affichage manquants (ordre, tâches/jour) ;
--   5. garantit les catégories de tâches (si la table est vide) ;
--   6. affiche le résultat pour contrôle immédiat.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Colonnes indispensables (cas d'une table issue d'une autre version)
-- ------------------------------------------------------------
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS daily_tasks INTEGER DEFAULT 1;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:28]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS min_profitability DECIMAL(5,2) DEFAULT 10;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:29]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_profitability DECIMAL(5,2) DEFAULT 20;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:30]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#9D3FE7';

-- [supabase/sources/migrations/00023_restore_default_plans.sql:31]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Medal';

-- [supabase/sources/migrations/00023_restore_default_plans.sql:32]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Standard';

-- [supabase/sources/migrations/00023_restore_default_plans.sql:33]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:34]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS allow_upgrade BOOLEAN DEFAULT true;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:35]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- [supabase/sources/migrations/00023_restore_default_plans.sql:36]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
-- ------------------------------------------------------------
-- 2. Créer les 3 packs s'ils n'existent pas (par slug)
-- ------------------------------------------------------------
INSERT INTO public.plans (
  name, slug, price, daily_tasks, min_profitability, max_profitability,
  color, icon, badge, sort_order, is_active
)
SELECT
  v.name, v.slug, v.price, v.daily_tasks, v.min_profitability, v.max_profitability,
  v.color, v.icon, v.badge, v.sort_order, true
FROM (
  VALUES
    ('Bronze', 'bronze',  5000,  1, 10, 20, '#CD7F32', 'Medal', 'Bronze',  1),
    ('Silver', 'silver', 10000,  3, 20, 30, '#C0C0C0', 'Award', 'Silver',  2),
    ('Gold',   'gold',   20000, -1, 40, 50, '#FFD700', 'Crown', 'Premium', 3)
) AS v(name, slug, price, daily_tasks, min_profitability, max_profitability, color, icon, badge, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.slug = v.slug);

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
-- ------------------------------------------------------------
-- 3. Réactiver les packs par défaut si AUCUN pack n'est actif
--    (un pack volontairement désactivé via l'admin n'est PAS réactivé
--     tant qu'un autre pack reste actif)
-- ------------------------------------------------------------
UPDATE public.plans p
SET is_active = true,
    updated_at = NOW()
WHERE p.slug IN ('bronze', 'silver', 'gold')
  AND p.is_active IS DISTINCT FROM true
  AND NOT EXISTS (SELECT 1 FROM public.plans x WHERE x.is_active = true);

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
-- ------------------------------------------------------------
-- 4. Compléter les champs d'affichage manquants des 3 packs
-- ------------------------------------------------------------
UPDATE public.plans p
SET daily_tasks = CASE p.slug WHEN 'bronze' THEN 1 WHEN 'silver' THEN 3 WHEN 'gold' THEN -1 ELSE p.daily_tasks END,
    sort_order  = CASE p.slug WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 ELSE p.sort_order END,
    updated_at  = NOW()
WHERE p.slug IN ('bronze', 'silver', 'gold')
  AND (p.daily_tasks IS NULL OR p.sort_order IS NULL);

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
-- ------------------------------------------------------------
-- 5. Catégories de tâches : garantir la présence des catégories par défaut
--    (uniquement si la table est vide, pour ne rien écraser)
-- ------------------------------------------------------------
INSERT INTO public.task_categories (name, slug, icon)
SELECT v.name, v.slug, v.icon
FROM (
  VALUES
    ('Telegram', 'telegram', 'Send'),
    ('WhatsApp', 'whatsapp', 'MessageCircle'),
    ('Réseaux sociaux', 'social', 'Share2'),
    ('Visite de site', 'visit', 'Globe'),
    ('Installation', 'install', 'Download'),
    ('Vidéo', 'video', 'Play'),
    ('Questionnaire', 'survey', 'ClipboardList'),
    ('Mission personnalisée', 'custom', 'Target')
) AS v(name, slug, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.task_categories c WHERE c.slug = v.slug)
  AND NOT EXISTS (SELECT 1 FROM public.task_categories c2);

-- [supabase/sources/migrations/00023_restore_default_plans.sql:37]
-- ------------------------------------------------------------
-- 6. Contrôle du résultat (visible dans le SQL Editor)
-- ------------------------------------------------------------
SELECT slug, name, price, daily_tasks, is_active
FROM public.plans
ORDER BY sort_order, name;

/* ======================================================================
 * §2 — FONCTIONS (34)
 * ====================================================================== */

DROP FUNCTION IF EXISTS public.add_reward(uuid, decimal, text);
DROP FUNCTION IF EXISTS public.submit_task(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.approve_submission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.reject_submission(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.validate_deposit(uuid, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.validate_withdrawal(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.ban_user(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.delete_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.activate_plan(uuid, uuid, decimal);
DROP FUNCTION IF EXISTS public.create_task(uuid, text, text, decimal, uuid, uuid, text, integer, text, text, integer, integer, timestamptz, text, jsonb);
DROP FUNCTION IF EXISTS public.update_task(uuid, uuid, text, text, decimal, uuid, text, integer, text, text, integer, integer, timestamptz, text, boolean);
DROP FUNCTION IF EXISTS public.delete_task(uuid, uuid);
DROP FUNCTION IF EXISTS public.create_plan(uuid, text, text, decimal, integer, decimal, decimal, text, text, text);
DROP FUNCTION IF EXISTS public.toggle_plan_status(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.update_plan(uuid, uuid, text, decimal, integer, decimal, decimal, text, text, text);
DROP FUNCTION IF EXISTS public.get_users_with_details(text);
DROP FUNCTION IF EXISTS public.submit_withdrawal(uuid, decimal, text, text);
DROP FUNCTION IF EXISTS public.submit_deposit(uuid, decimal, text, text, text);
DROP FUNCTION IF EXISTS public.request_withdrawal_feeexpay(uuid, decimal, text, text, text);
DROP FUNCTION IF EXISTS public.credit_feeexpay_deposit(text);
DROP FUNCTION IF EXISTS public.get_withdrawable_amount(uuid);
DROP FUNCTION IF EXISTS public.upsert_user_preferences(text, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.create_service_order(text, text, text, text, text, text, numeric, text, integer, text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.credit_referral_commission(uuid, numeric, uuid);

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:1]
-- ============================================================
-- MIGRATION 00015 : PARRAINAGE ROBUSTE + OPÉRATIONS WALLET ATOMIQUES
-- ============================================================
-- 1. Codes de parrainage TOUJOURS uniques (générateur avec retry).
-- 2. Inscription via lien (?ref=CODE) → le filleul est enregistré comme
--    sous-affilié ET la commission du parrain est créditée IMMÉDIATEMENT
--    (plus besoin de ressaisir le code après inscription).
-- 3. request_withdrawal_feeexpay : demande de retrait ATOMIQUE.
--    Le montant est vérifié contre les GAINS retirables (jamais les dépôts
--    ni le capital), puis le wallet est débité, la demande créée et la
--    transaction enregistrée dans une SEULE transaction (SELECT FOR UPDATE).
--      → remplace le flux manuel /api/feexpay/payout (et son rollback bugué).
-- 4. credit_feeexpay_deposit : crédit de dépôt ATOMIQUE (anti double-crédit)
--    utilisé par /api/feexpay/deposit-status.
-- Ces 2 RPC sont réservées au rôle service_role (revoked from PUBLIC/anon/authenticated).
-- IDEMPOTENT : CREATE OR REPLACE / DROP IF EXISTS.
-- ============================================================

-- ============================================================
-- 1. GÉNÉRATEUR DE CODE DE PARRAINAGE UNIQUE
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
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

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:1]
-- ============================================================
-- 1. INSCRIPTION : enregistrer la relation, NE RIEN CRÉDITER
-- ============================================================
CREATE OR REPLACE FUNCTION public.rewardly_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_code text := NULL;
  v_meta_code text := NULL;
  v_referrer_id uuid := NULL;
BEGIN
  -- 🔢 Code de parrainage unique garanti
  v_code := public.generate_unique_referral_code();

  -- 📥 Code fourni via le lien d'inscription (?ref=CODE)
  v_meta_code := NULLIF(NEW.raw_user_meta_data ->> 'referral_code', '');
  IF v_meta_code IS NOT NULL THEN
    SELECT p.id INTO v_referrer_id
    FROM public.profiles AS p
    WHERE p.referral_code = UPPER(v_meta_code)
      AND p.user_id <> NEW.id
    LIMIT 1;
  END IF;

  -- 👤 Profil (code unique + éventuel parrain)
  INSERT INTO public.profiles (user_id, full_name, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    v_code,
    v_referrer_id
  )
  ON CONFLICT (user_id) DO UPDATE
    SET referral_code = COALESCE(public.profiles.referral_code, excluded.referral_code),
        referred_by   = COALESCE(public.profiles.referred_by, excluded.referred_by);

  -- 💰 Wallet s'il manque
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- 🤝 Relation de parrainage UNIQUEMENT (0 FCFA à l'inscription).
  --    La commission (10% de l'investissement) est versée par activate_plan().
  IF v_referrer_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.referrals (referrer_id, referred_id, commission, status)
      VALUES (
        (SELECT p.user_id FROM public.profiles p WHERE p.id = v_referrer_id),
        NEW.id,
        0,
        'pending'
      )
      ON CONFLICT (referred_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ne jamais bloquer la création d'un compte
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- [supabase/sources/migrations/00001_initial_schema.sql:418]
-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
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

-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- MIGRATION 00010 : Correctifs sécurité et bugs
-- Corrige :
--   1. add_reward → restriction admin/service role (anti auto-crédit)
--   2. approve_submission → anti double-paiement (rejected → approved impossible)
--   3. approve_submission/reject_submission → vérification is_staff() dans la RPC
--   4. validate_deposit → vérification is_admin() dans la RPC
--   5. validate_withdrawal → transitions propres (pending→approved|rejected|paid, approved→paid)
--                           + vérification is_admin() dans la RPC
--   6. activate_plan → utilise investment_duration_days de system_settings
--   7. create_task → utilise p_category_id (bug)
--   8. submit_withdrawal → jour calculé en UTC avec offset configurable
--   9. delete_user/ban_user → vérification is_admin() dans la RPC
--  10. create_task/update_task/delete_task/create_plan/toggle_plan_status/update_plan
--      → vérification is_admin() dans la RPC (défense en profondeur)
--  11. DROP + RE-CREATE des RPC avec SECURITY INVOKER pour add_reward/submit_* 
--      → les RPC utilisateurs vérifient auth.uid() en leur sein
-- ============================================================

-- ============================================================
-- 1. ADD REWARD (sécurisé : admin ou service role uniquement)
-- ============================================================
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
  -- 🔒 Si c'est un utilisateur authentifié (pas service role), vérifier admin
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide');
  END IF;

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

-- [supabase/sources/migrations/00019_task_reward_notifications.sql:1]
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

-- [supabase/sources/migrations/00019_task_reward_notifications.sql:1]
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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 3. REJECT SUBMISSION (is_staff)
-- ============================================================
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
  -- 🔒 Vérification : staff uniquement
  IF auth.uid() IS NOT NULL AND NOT is_staff() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 4. VALIDATE DEPOSIT (is_admin dans la RPC)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00014_fix_double_debit_withdrawal.sql:1]
-- ============================================================
-- MIGRATION 00014 : CORRECTION DU DOUBLE DÉBIT DES RETRAITS FEEXPAY
-- ============================================================
-- Problème : /api/feexpay/payout débite le wallet À LA DEMANDE, puis
-- validate_withdrawal re-débitait le wallet au passage à 'paid'
-- → l'utilisateur perdait 2× le montant.
--
-- Correctif : le wallet n'est débité QU'UNE SEULE FOIS, À LA DEMANDE.
--  - validate_withdrawal : plus AUCUN débit sur balance au passage à 'paid' ;
--    il clôture seulement la transaction de débit liée (reference = id retrait).
--  - submit_withdrawal : débite aussi à la demande (cohérence des deux flux).
--  - get_withdrawable_amount : calcul avec ABS (les transactions de débit sont
--    désormais négatives ; les anciennes données positives restent supportées).
--
-- IDEMPOTENT : peut être exécuté plusieurs fois (CREATE OR REPLACE).
-- ============================================================

-- ============================================================
-- 1. VALIDATE WITHDRAWAL (corrigé : débit UNIQUE à la demande)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- 🔒 Transitions autorisées
  IF v_withdrawal.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already paid');
  END IF;
  IF v_withdrawal.status = 'rejected' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already rejected');
  END IF;
  IF v_withdrawal.status = 'approved' AND p_status != 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal déjà approuvé — seul le passage à paid est possible');
  END IF;
  IF v_withdrawal.status = 'pending' AND p_status NOT IN ('approved', 'rejected', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide pour une soumission en attente');
  END IF;

  UPDATE withdrawals SET status = p_status, admin_comment = p_comment, reviewed_by = p_admin_id, updated_at = NOW()
  WHERE id = p_withdrawal_id;

  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_withdrawal.user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, locked_amount) VALUES (v_withdrawal.user_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- 💰 Débit UNIQUE effectué À LA DEMANDE. Au passage à 'paid', on ne débite
  -- PLUS le wallet : on clôture la transaction de débit en attente.
  IF p_status = 'paid' THEN
    UPDATE wallets
    SET locked_amount = GREATEST(0, locked_amount - v_withdrawal.amount),
        updated_at = NOW()
    WHERE id = v_wallet_id;

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
    WHERE id = v_wallet_id;

    BEGIN
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (v_withdrawal.user_id, 'Retrait approuvé', 'Votre retrait de ' || v_withdrawal.amount::TEXT || ' FCFA a été approuvé. Paiement en cours.', 'withdrawal');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  ELSIF p_status = 'rejected' THEN
    BEGIN
      -- Débit annulé : le montant réservé est remboursé côté application,
      -- la transaction de débit est marquée échouée.
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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 13. BAN USER (is_admin dans la RPC)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 14. DELETE USER (is_admin dans la RPC + gestion d'erreurs)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_user(
  p_user_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Interdire la suppression de soi-même (un admin ne peut pas se supprimer)
  IF p_user_id = p_admin_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un administrateur ne peut pas supprimer son propre compte');
  END IF;

  SELECT id INTO v_profile_id FROM profiles WHERE user_id = p_user_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'delete_user', 'profiles', v_profile_id,
            jsonb_build_object('user_id', p_user_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Suppression en cascade : profiles, wallets, puis auth.users
  DELETE FROM profiles WHERE user_id = p_user_id;
  DELETE FROM wallets WHERE user_id = p_user_id;

  -- Supprimer l'utilisateur auth (peut échouer si l'utilisateur n'existe plus)
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- L'utilisateur auth n'existe peut-être pas (déjà supprimé) — ce n'est pas bloquant
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:115]
-- ============================================================
-- 3. ACTIVATION DE PACK : verser 10% au parrain (sur l'investissement)
-- ============================================================
-- Reprend la version sécurisée existante (le montant débité = PRIX DU PLAN,
-- jamais le paramètre client) et ajoute la commission de parrainage.
CREATE OR REPLACE FUNCTION public.activate_plan(
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
  v_new_investment_id UUID;
BEGIN
  -- 🔒 seul l'utilisateur connecté peut activer un plan pour lui-même
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT COALESCE((SELECT value::TEXT::INTEGER FROM system_settings WHERE key = 'investment_duration_days'), 7)
  INTO v_investment_duration_days;

  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
  END IF;

  -- 🔒 Le montant débité est le PRIX DU PLAN (paramètre client ignoré)
  p_amount := v_plan.price;

  SELECT id, balance INTO v_wallet_id, v_balance FROM wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  IF EXISTS (SELECT 1 FROM investments WHERE user_id = p_user_id AND status = 'active') THEN
    DECLARE
      v_current_investment RECORD;
      v_upgrade_amount DECIMAL;
    BEGIN
      SELECT * INTO v_current_investment
      FROM investments WHERE user_id = p_user_id AND status = 'active' LIMIT 1;

      -- 🔧 UPGRADE : on ne débite que la DIFFÉRENCE (nouveau prix - déjà investi)
      v_upgrade_amount := v_plan.price - v_current_investment.amount;

      IF v_upgrade_amount < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot downgrade plan');
      END IF;

      IF v_balance < v_upgrade_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour l''upgrade. Il vous manque ' || (v_upgrade_amount - v_balance)::TEXT || ' FCFA.');
      END IF;

      UPDATE wallets
      SET balance = balance - v_upgrade_amount,
          invested_capital = invested_capital + v_upgrade_amount,
          updated_at = NOW()
      WHERE id = v_wallet_id;

      UPDATE investments SET status = 'cancelled', updated_at = NOW()
      WHERE id = v_current_investment.id;

      INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
      VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'))
      RETURNING id INTO v_new_investment_id;

      BEGIN
        INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
        VALUES (p_user_id, v_wallet_id, v_upgrade_amount, 'investment', 'Upgrade vers ' || v_plan.name, 'completed');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      -- 🎁 PARRAINAGE : 10% du montant RÉELLEMENT investi (la différence)
      BEGIN
        PERFORM public.credit_referral_commission(p_user_id, v_upgrade_amount, v_new_investment_id);
      EXCEPTION WHEN OTHERS THEN NULL; -- ne doit jamais bloquer l'activation
      END;

      RETURN jsonb_build_object('success', true, 'upgrade', true, 'upgrade_amount', v_upgrade_amount);
    END;
  ELSE
    -- 🆕 Nouvelle activation : la balance doit couvrir le prix TOTAL du pack
    IF v_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour activer ce pack. Il vous manque ' || (p_amount - v_balance)::TEXT || ' FCFA.');
    END IF;

    UPDATE wallets SET balance = balance - p_amount, invested_capital = invested_capital + p_amount, updated_at = NOW()
    WHERE id = v_wallet_id;

    INSERT INTO investments (user_id, plan_id, wallet_id, amount, status, start_date, end_date)
    VALUES (p_user_id, p_plan_id, v_wallet_id, p_amount, 'active', NOW(), NOW() + (v_investment_duration_days * INTERVAL '1 day'))
    RETURNING id INTO v_new_investment_id;

    BEGIN
      INSERT INTO wallet_transactions (user_id, wallet_id, amount, type, description, status)
      VALUES (p_user_id, v_wallet_id, p_amount, 'investment', 'Activation pack ' || v_plan.name, 'completed');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 🎁 PARRAINAGE : 10% du montant investi par le filleul
    BEGIN
      PERFORM public.credit_referral_commission(p_user_id, p_amount, v_new_investment_id);
    EXCEPTION WHEN OTHERS THEN NULL; -- ne doit jamais bloquer l'activation
    END;

    RETURN jsonb_build_object('success', true, 'upgrade', false);
  END IF;
END;
$$;

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 7. CREATE TASK (corrige bug p_category_id jamais utilisé)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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
            jsonb_build_object('title', p_title, 'amount', p_amount, 'plan_id', p_plan_id, 'category_id', p_category_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'task_id', v_task_id);
END;
$$;

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 8. UPDATE TASK (is_admin)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 9. DELETE TASK (is_admin)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_task(
  p_admin_id UUID,
  p_task_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  DELETE FROM tasks WHERE id = p_task_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id)
    VALUES (p_admin_id, 'delete_task', 'tasks', p_task_id);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 10. CREATE PLAN (is_admin)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 11. TOGGLE PLAN STATUS (is_admin)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  UPDATE plans SET is_active = p_is_active, updated_at = NOW() WHERE id = p_plan_id;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details)
    VALUES (p_admin_id, 'toggle_plan', 'plans', p_plan_id, jsonb_build_object('is_active', p_is_active));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- [supabase/sources/migrations/00010_security_and_bugfixes.sql:1]
-- ============================================================
-- 12. UPDATE PLAN (is_admin)
-- ============================================================
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
  -- 🔒 Vérification : admin uniquement
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

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

-- [supabase/sources/migrations/00002_platform_management.sql:1]  << garde admin ajoutée automatiquement
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
  -- 🔒 Réservé aux administrateurs (défense en profondeur)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
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

-- [supabase/sources/migrations/00002_platform_management.sql:1]  << garde admin ajoutée automatiquement
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
  -- 🔒 Réservé aux administrateurs (défense en profondeur)
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;
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

-- [supabase/sources/migrations/00017_security_fixes.sql:87]
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

-- [supabase/sources/migrations/00017_security_fixes.sql:87]
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

-- [supabase/sources/migrations/00017_security_fixes.sql:87]
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

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:217]
-- ============================================================
-- 4. CRÉDIT DE DÉPÔT FEEXPAY ATOMIQUE (anti double-crédit)
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_feeexpay_deposit(
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deposit public.deposits%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_role text;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
  IF v_role IN ('anon', 'authenticated') THEN
    RETURN jsonb_build_object('success', false, 'creditable', false, 'error', 'Non autorisé');
  END IF;

  -- 🔒 Verrouiller la ligne de dépôt recherchée (dernière occurrence)
  SELECT * INTO v_deposit
  FROM public.deposits
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

  -- 🔒 Verrouiller le wallet du déposant
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount)
    VALUES (v_deposit.user_id, 0, 0)
    RETURNING * INTO v_wallet;
  END IF;

  -- ✅ Statut approuvé + crédit + traçabilité + notification (une transaction)
  UPDATE public.deposits
  SET status = 'approved', updated_at = NOW()
  WHERE id = v_deposit.id;

  UPDATE public.wallets
  SET balance = balance + v_deposit.amount,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status, reference)
  VALUES (v_deposit.user_id, v_wallet.id, v_deposit.amount, 'deposit',
          'Dépôt via FeeXPay (' || p_reference || ')', 'completed', p_reference);

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_deposit.user_id, 'Dépôt confirmé ✅',
          'Votre dépôt de ' || v_deposit.amount::TEXT || ' FCFA a été crédité automatiquement.', 'deposit');

  RETURN jsonb_build_object('success', true, 'creditable', true, 'credited', true);
END;
$$;

-- [supabase/sources/migrations/00017_security_fixes.sql:47]
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

-- [supabase/sources/migrations/00017_security_fixes.sql:87]
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

-- [supabase/sources/migrations/00001_initial_schema.sql:394]
-- ============================================
-- TRIGGERS
-- ============================================
-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, referral_code)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    UPPER(SUBSTRING(MD5(NEW.id::TEXT) FROM 1 FOR 8))
  );
  
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [supabase/sources/migrations/00011_user_preferences.sql:1]
-- Trigger pour mettre à jour updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- [supabase/sources/migrations/00011_user_preferences.sql:43]
-- ============================================================
-- Fonction RPC pour upsert les préférences (évite les conflits)
-- ============================================================
create or replace function public.upsert_user_preferences(
  p_language text,
  p_currency text,
  p_push_notifications boolean,
  p_email_notifications boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, language, currency, push_notifications, email_notifications)
  values (auth.uid(), p_language, p_currency, p_push_notifications, p_email_notifications)
  on conflict (user_id)
  do update set
    language = excluded.language,
    currency = excluded.currency,
    push_notifications = excluded.push_notifications,
    email_notifications = excluded.email_notifications,
    updated_at = now();
end;
$$;

-- [supabase/sources/migrations/00012_service_orders.sql:47]
-- ============================================================
-- Fonction RPC pour créer une commande + débiter le wallet
-- ============================================================
create or replace function public.create_service_order(
  p_company_name text,
  p_contact_email text,
  p_contact_phone text,
  p_service_type text,
  p_description text,
  p_pack text,
  p_pack_amount numeric,
  p_duration text,
  p_target_users integer,
  p_url text default null,
  p_download_url text default null,
  p_questions text default null,
  p_ia_url text default null,
  p_app_name text default null,
  p_game_name text default null,
  p_site_name text default null,
  p_instructions text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_balance numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Non authentifié');
  end if;

  -- Vérifier le solde du wallet
  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  limit 1;

  if v_wallet_id is null then
    return json_build_object('success', false, 'error', 'Wallet introuvable');
  end if;

  if v_balance < p_pack_amount then
    return json_build_object('success', false, 'error', 'Solde insuffisant. Rechargez votre wallet.');
  end if;

  -- Débiter le wallet
  update public.wallets
  set balance = balance - p_pack_amount,
      updated_at = now()
  where id = v_wallet_id;

  -- Créer la transaction
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
  values (v_user_id, v_wallet_id, -p_pack_amount, 'service', 'Paiement pack ' || p_pack || ' - ' || p_service_type, 'completed');

  -- Créer la commande
  insert into public.service_orders (
    user_id, company_name, contact_email, contact_phone,
    service_type, description, pack, pack_amount, duration, target_users,
    url, download_url, questions, ia_url, app_name, game_name, site_name, instructions,
    status, payment_status
  ) values (
    v_user_id, p_company_name, p_contact_email, p_contact_phone,
    p_service_type, p_description, p_pack, p_pack_amount, p_duration, p_target_users,
    p_url, p_download_url, p_questions, p_ia_url, p_app_name, p_game_name, p_site_name, p_instructions,
    'pending', 'paid'
  ) returning id into v_order_id;

  return json_build_object('success', true, 'order_id', v_order_id);
end;
$$;

-- [supabase/sources/migrations/00016_push_tokens.sql:38]
-- Trigger pour maintenir updated_at
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:115]
-- ============================================================
-- 2. CRÉDIT DE COMMISSION (sur l'investissement du filleul)
-- ============================================================
-- Fonction GÉNÉRIQUE : `p_amount` = base de calcul (ici le montant
-- investi par le filleul). Le pourcentage vient de system_settings
-- (`referral_commission_percent`, défaut 10).
-- Anti-doublon : une seule commission par source (p_source_id).
CREATE OR REPLACE FUNCTION public.credit_referral_commission(
  p_user_id UUID,     -- id (auth.users) du filleul qui investit
  p_amount NUMERIC,   -- montant investi par le filleul
  p_source_id UUID    -- id de l'investissement (source unique du crédit)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_referrer_id uuid := NULL;
  v_percent numeric := 10;
  v_commission numeric := 0;
  v_wallet_id uuid := NULL;
  v_already boolean := false;
BEGIN
  -- 🔒 Parrain du filleul (relation de parrainage)
  SELECT referrer_id INTO v_referrer_id
  FROM public.referrals
  WHERE referred_id = p_user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN; -- pas de parrain : rien à faire
  END IF;

  -- 📊 Pourcentage configuré (10% par défaut)
  SELECT COALESCE(
           NULLIF(
             TRIM(BOTH '"' FROM (SELECT s.value::text FROM public.system_settings s
                                 WHERE s.key = 'referral_commission_percent' LIMIT 1)),
             ''
           )::numeric,
           10
         )
  INTO v_percent;

  IF v_percent IS NULL OR v_percent <= 0 THEN
    RETURN;
  END IF;

  -- 💰 Commission = % du montant investi (arrondi à l'unité inférieure)
  v_commission := FLOOR(COALESCE(p_amount, 0) * v_percent / 100.0);
  IF v_commission <= 0 THEN
    RETURN;
  END IF;

  -- 🔒 Anti-doublon : déjà crédité pour cette source ?
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE user_id = v_referrer_id
      AND type = 'referral'
      AND reference = 'referral_' || p_source_id::TEXT
  ) INTO v_already;
  IF v_already THEN
    RETURN;
  END IF;

  -- 💰 Wallet du parrain (créé si manquant)
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_referrer_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance, locked_amount)
    VALUES (v_referrer_id, 0, 0)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- 💸 Créditer le parrain (solde + gains retirables)
  UPDATE public.wallets
  SET balance = balance + v_commission,
      total_earnings = total_earnings + v_commission,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- 📒 Traçabilité
  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, amount, type, description, status, reference
  )
  VALUES (
    v_referrer_id, v_wallet_id, v_commission, 'referral',
    FLOOR(v_percent)::TEXT || '% de l''investissement de votre filleul',
    'completed',
    'referral_' || p_source_id::TEXT
  );

  -- 🔄 Mettre à jour le cumul de la relation de parrainage
  UPDATE public.referrals
  SET commission = COALESCE(commission, 0) + v_commission,
      status = 'paid'
  WHERE referred_id = p_user_id;

  -- 🔔 Notification du parrain
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_referrer_id,
      'Commission de parrainage 🎉',
      'Votre filleul a investi ' || FLOOR(COALESCE(p_amount, 0))::TEXT || ' FCFA — vous recevez '
        || v_commission::TEXT || ' FCFA (' || FLOOR(v_percent)::TEXT || '%).',
      'referral'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

/* ======================================================================
 * §3 — TRIGGERS (12) + RLS (106 policies)
 * ====================================================================== */

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- [supabase/sources/migrations/00022_referral_investment_commission.sql:115]
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.rewardly_handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
-- [supabase/sources/migrations/00001_initial_schema.sql:431]
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
-- [supabase/sources/migrations/00001_initial_schema.sql:432]
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_investments_updated_at ON investments;
-- [supabase/sources/migrations/00001_initial_schema.sql:433]
CREATE TRIGGER update_investments_updated_at BEFORE UPDATE ON investments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
-- [supabase/sources/migrations/00001_initial_schema.sql:434]
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_deposits_updated_at ON deposits;
-- [supabase/sources/migrations/00001_initial_schema.sql:435]
CREATE TRIGGER update_deposits_updated_at BEFORE UPDATE ON deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_withdrawals_updated_at ON withdrawals;
-- [supabase/sources/migrations/00001_initial_schema.sql:436]
CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
-- [supabase/sources/base_schema.sql:452]
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS prevent_profile_security_changes ON public.profiles;
-- [supabase/sources/migrations/00017_security_fixes.sql:87]
CREATE TRIGGER prevent_profile_security_changes
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_security_changes();

DROP TRIGGER IF EXISTS set_user_preferences_updated_at ON public.user_preferences;
-- [supabase/sources/migrations/00011_user_preferences.sql:24]
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.handle_updated_at();

DROP TRIGGER IF EXISTS set_service_orders_updated_at ON public.service_orders;
-- [supabase/sources/migrations/00012_service_orders.sql:32]
create trigger set_service_orders_updated_at
  before update on public.service_orders
  for each row execute function public.handle_updated_at();

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON public.push_tokens;
-- [supabase/sources/migrations/00016_push_tokens.sql:52]
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_push_tokens_updated_at();

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PROFILES POLICIES
-- ============================================
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view referral-linked profiles" ON public.profiles;
-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:148]
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
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own profile (trigger creates it, but allow fallback)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WALLETS POLICIES
-- ============================================
-- Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all wallets
CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all wallets" ON wallets;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all wallets
CREATE POLICY "Admins can update all wallets" ON wallets
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all wallets" ON wallets;
-- [supabase/sources/base_schema.sql:571]
CREATE POLICY "Admins can manage all wallets" ON wallets
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own transactions" ON wallet_transactions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WALLET TRANSACTIONS POLICIES
-- ============================================
-- Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all transactions" ON wallet_transactions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all transactions
CREATE POLICY "Admins can view all transactions" ON wallet_transactions
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage all transactions" ON wallet_transactions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage all transactions
CREATE POLICY "Admins can manage all transactions" ON wallet_transactions
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view active tasks" ON tasks;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASKS POLICIES
-- ============================================
-- Anyone can view active tasks
CREATE POLICY "Anyone can view active tasks" ON tasks
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all tasks" ON tasks;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all tasks (including inactive)
CREATE POLICY "Admins can view all tasks" ON tasks
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage tasks" ON tasks;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage tasks
CREATE POLICY "Admins can manage tasks" ON tasks
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own submissions" ON task_submissions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASK SUBMISSIONS POLICIES
-- ============================================
-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON task_submissions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create submissions" ON task_submissions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can create submissions
CREATE POLICY "Users can create submissions" ON task_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own submissions" ON task_submissions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own submissions
CREATE POLICY "Users can update own submissions" ON task_submissions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all submissions" ON task_submissions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Staff can view all submissions
CREATE POLICY "Staff can view all submissions" ON task_submissions
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS "Staff can update all submissions" ON task_submissions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Staff can update all submissions
CREATE POLICY "Staff can update all submissions" ON task_submissions
  FOR UPDATE USING (is_staff());

DROP POLICY IF EXISTS "Users can view own deposits" ON deposits;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- DEPOSITS POLICIES
-- ============================================
-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all deposits" ON deposits;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all deposits
CREATE POLICY "Admins can view all deposits" ON deposits
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all deposits" ON deposits;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all deposits
CREATE POLICY "Admins can update all deposits" ON deposits
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert deposits" ON deposits;
-- [supabase/sources/base_schema.sql:621]
CREATE POLICY "Admins can insert deposits" ON deposits
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- WITHDRAWALS POLICIES
-- ============================================
-- Users can view their own withdrawals
CREATE POLICY "Users can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all withdrawals
CREATE POLICY "Admins can view all withdrawals" ON withdrawals
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all withdrawals
CREATE POLICY "Admins can update all withdrawals" ON withdrawals
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert withdrawals" ON withdrawals;
-- [supabase/sources/base_schema.sql:636]
CREATE POLICY "Admins can insert withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own investments" ON investments;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- INVESTMENTS POLICIES
-- ============================================
-- Users can view their own investments
CREATE POLICY "Users can view own investments" ON investments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create investments" ON investments;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can create investments
CREATE POLICY "Users can create investments" ON investments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own investments" ON investments;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own investments
CREATE POLICY "Users can update own investments" ON investments
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all investments" ON investments;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all investments
CREATE POLICY "Admins can view all investments" ON investments
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can update all investments" ON investments;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can update all investments
CREATE POLICY "Admins can update all investments" ON investments
  FOR UPDATE USING (is_admin());

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================
-- Users can view their own notifications (or global ones)
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage notifications" ON notifications;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage all notifications
CREATE POLICY "Admins can manage notifications" ON notifications
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:124]
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Users can insert own referrals" ON public.referrals;
-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:130]
CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:134]
CREATE POLICY "Users can update own referrals" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admins can view all referrals" ON referrals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals" ON referrals
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view active plans" ON plans;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PLANS POLICIES
-- ============================================
-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can view all plans" ON plans;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all plans
CREATE POLICY "Admins can view all plans" ON plans
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage plans" ON plans;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage plans
CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view categories" ON task_categories;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- TASK CATEGORIES POLICIES
-- ============================================
-- Anyone can view categories
CREATE POLICY "Anyone can view categories" ON task_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON task_categories;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage categories
CREATE POLICY "Admins can manage categories" ON task_categories
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view submission fields" ON submission_fields;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- SUBMISSION FIELDS POLICIES
-- ============================================
-- Anyone can view submission fields (needed for task display)
CREATE POLICY "Anyone can view submission fields" ON submission_fields
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage submission fields" ON submission_fields;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage submission fields
CREATE POLICY "Admins can manage submission fields" ON submission_fields
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can view own answers" ON submission_answers;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
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
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
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
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Staff can view all submission answers
CREATE POLICY "Staff can view all answers" ON submission_answers
  FOR SELECT USING (is_staff());

DROP POLICY IF EXISTS "Anyone can view settings" ON system_settings;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- SYSTEM SETTINGS POLICIES
-- ============================================
-- Anyone can view system settings (needed for display)
CREATE POLICY "Anyone can view settings" ON system_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage settings" ON system_settings;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage settings
CREATE POLICY "Admins can manage settings" ON system_settings
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view payment methods" ON payment_methods;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- PAYMENT METHODS POLICIES
-- ============================================
-- Anyone can view active payment methods
CREATE POLICY "Anyone can view payment methods" ON payment_methods
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage payment methods" ON payment_methods;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage payment methods
CREATE POLICY "Admins can manage payment methods" ON payment_methods
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- ADMIN LOGS POLICIES
-- ============================================
-- Only admins can view admin logs
CREATE POLICY "Admins can view logs" ON admin_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Only admins can insert logs
CREATE POLICY "Admins can insert logs" ON admin_logs
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users can view own stats" ON daily_statistics;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- DAILY STATISTICS POLICIES
-- ============================================
-- Users can view their own statistics
CREATE POLICY "Users can view own stats" ON daily_statistics
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON daily_statistics;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own statistics
CREATE POLICY "Users can insert own stats" ON daily_statistics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON daily_statistics;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own statistics
CREATE POLICY "Users can update own stats" ON daily_statistics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all stats" ON daily_statistics;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can view all statistics
CREATE POLICY "Admins can view all stats" ON daily_statistics
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view banners" ON banners;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- BANNERS POLICIES
-- ============================================
-- Anyone can view active banners
CREATE POLICY "Anyone can view banners" ON banners
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage banners" ON banners;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage banners
CREATE POLICY "Admins can manage banners" ON banners
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- ============================================
-- ANNOUNCEMENTS POLICIES
-- ============================================
-- Anyone can view active announcements
CREATE POLICY "Anyone can view announcements" ON announcements
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage announcements" ON announcements;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Users can upload proofs" ON storage.objects;
-- [supabase/sources/base_schema.sql:2061]
CREATE POLICY "Users can upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view proofs" ON storage.objects;
-- [supabase/sources/base_schema.sql:2068]
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
-- [supabase/sources/base_schema.sql:2082]
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
-- [supabase/sources/migrations/00001_initial_schema.sql:374]
CREATE POLICY "Admins can view all submissions" ON task_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin', 'moderator'))
);

DROP POLICY IF EXISTS "Users can create deposits" ON deposits;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can create deposits
CREATE POLICY "Users can create deposits" ON deposits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can create withdrawals
CREATE POLICY "Users can create withdrawals" ON withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view submission answers" ON submission_answers;
-- [supabase/sources/migrations/00005_public_select_policies.sql:87]
CREATE POLICY "Public can view submission answers" ON submission_answers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view submission fields" ON submission_fields;
-- [supabase/sources/migrations/00005_public_select_policies.sql:81]
CREATE POLICY "Public can view submission fields" ON submission_fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view logs" ON admin_logs;
-- [supabase/sources/migrations/00005_public_select_policies.sql:105]
CREATE POLICY "Public can view logs" ON admin_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view stats" ON daily_statistics;
-- [supabase/sources/migrations/00005_public_select_policies.sql:111]
CREATE POLICY "Public can view stats" ON daily_statistics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view settings" ON system_settings;
-- [supabase/sources/migrations/00005_public_select_policies.sql:93]
CREATE POLICY "Public can view settings" ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view payment methods" ON payment_methods;
-- [supabase/sources/migrations/00005_public_select_policies.sql:99]
CREATE POLICY "Public can view payment methods" ON payment_methods FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update tasks" ON tasks;
-- [supabase/sources/migrations/00002_platform_management.sql:1040]
CREATE POLICY "Public can update tasks" ON tasks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete tasks" ON tasks;
-- [supabase/sources/migrations/00002_platform_management.sql:1042]
CREATE POLICY "Public can delete tasks" ON tasks FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public can view plans" ON plans;
-- [supabase/sources/migrations/00005_public_select_policies.sql:69]
CREATE POLICY "Public can view plans" ON plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can manage plans" ON plans;
-- [supabase/sources/migrations/00002_platform_management.sql:1049]
CREATE POLICY "Public can manage plans" ON plans FOR ALL USING (true);

DROP POLICY IF EXISTS "Public can view categories" ON task_categories;
-- [supabase/sources/migrations/00005_public_select_policies.sql:75]
CREATE POLICY "Public can view categories" ON task_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update deposits" ON deposits;
-- [supabase/sources/migrations/00002_platform_management.sql:1058]
CREATE POLICY "Public can update deposits" ON deposits FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can update withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00002_platform_management.sql:1062]
CREATE POLICY "Public can update withdrawals" ON withdrawals FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can update submissions" ON task_submissions;
-- [supabase/sources/migrations/00002_platform_management.sql:1066]
CREATE POLICY "Public can update submissions" ON task_submissions FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can view investments" ON investments;
-- [supabase/sources/migrations/00005_public_select_policies.sql:45]
CREATE POLICY "Public can view investments" ON investments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update investments" ON investments;
-- [supabase/sources/migrations/00002_platform_management.sql:1072]
CREATE POLICY "Public can update investments" ON investments FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can view tasks" ON tasks;
-- [supabase/sources/migrations/00005_public_select_policies.sql:9]
CREATE POLICY "Public can view tasks" ON tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view wallets" ON wallets;
-- [supabase/sources/migrations/00005_public_select_policies.sql:15]
CREATE POLICY "Public can view wallets" ON wallets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view transactions" ON wallet_transactions;
-- [supabase/sources/migrations/00005_public_select_policies.sql:21]
CREATE POLICY "Public can view transactions" ON wallet_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view deposits" ON deposits;
-- [supabase/sources/migrations/00005_public_select_policies.sql:27]
CREATE POLICY "Public can view deposits" ON deposits FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00005_public_select_policies.sql:33]
CREATE POLICY "Public can view withdrawals" ON withdrawals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view submissions" ON task_submissions;
-- [supabase/sources/migrations/00005_public_select_policies.sql:39]
CREATE POLICY "Public can view submissions" ON task_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view notifications" ON notifications;
-- [supabase/sources/migrations/00005_public_select_policies.sql:51]
CREATE POLICY "Public can view notifications" ON notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
-- [supabase/sources/migrations/00005_public_select_policies.sql:57]
CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view referrals" ON referrals;
-- [supabase/sources/migrations/00005_public_select_policies.sql:63]
CREATE POLICY "Public can view referrals" ON referrals FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own wallet (for balance display)
CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON wallet_transactions;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can insert their own transactions (via RPC)
CREATE POLICY "Users can insert own transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own deposits" ON deposits;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own deposits
CREATE POLICY "Users can update own deposits" ON deposits
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own withdrawals" ON withdrawals;
-- [supabase/sources/migrations/00008_restore_rls_policies.sql:62]
-- Users can update their own withdrawals
CREATE POLICY "Users can update own withdrawals" ON withdrawals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own preferences" ON public.user_preferences;
-- [supabase/sources/migrations/00011_user_preferences.sql:33]
create policy "Users read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own preferences" ON public.user_preferences;
-- [supabase/sources/migrations/00011_user_preferences.sql:38]
create policy "Users insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own preferences" ON public.user_preferences;
-- [supabase/sources/migrations/00011_user_preferences.sql:43]
create policy "Users update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own service orders" ON public.service_orders;
-- [supabase/sources/migrations/00012_service_orders.sql:41]
create policy "Users read own service orders"
  on public.service_orders for select
  using (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert service orders" ON public.service_orders;
-- [supabase/sources/migrations/00012_service_orders.sql:47]
create policy "Users insert service orders"
  on public.service_orders for insert
  with check (auth.uid() = user_id);

/* ======================================================================
 * §4 — PRIVILÈGES (GRANT/REVOKE + durcissement)
 * ====================================================================== */

-- [supabase/sources/base_schema.sql:1891]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;

-- [supabase/sources/base_schema.sql:1892]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM anon;

-- [supabase/sources/base_schema.sql:1893]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM authenticated;

-- [supabase/sources/base_schema.sql:1894]
GRANT EXECUTE ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

-- [supabase/sources/base_schema.sql:1956]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM PUBLIC;

-- [supabase/sources/base_schema.sql:1957]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM anon;

-- [supabase/sources/base_schema.sql:1958]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM authenticated;

-- [supabase/sources/base_schema.sql:1959]
GRANT EXECUTE ON FUNCTION credit_feeexpay_deposit(TEXT) TO service_role;

-- [supabase/sources/base_schema.sql:2572]
-- ============================================================
-- 8. PRIVILÈGES D'EXÉCUTION des fonctions corrigées
-- ============================================================
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/sources/base_schema.sql:2578]
GRANT EXECUTE ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;

-- [supabase/sources/base_schema.sql:2579]
GRANT EXECUTE ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;

-- [supabase/sources/base_schema.sql:2580]
GRANT EXECUTE ON FUNCTION get_withdrawable_amount(UUID) TO authenticated;

-- [supabase/sources/base_schema.sql:2580]
-- 🔒 Défense en profondeur : réserver les RPC financières user-facing au rôle
--    authenticated (l'anon ne doit PAS pouvoir les appeler).
REVOKE ALL ON FUNCTION activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;

-- [supabase/sources/base_schema.sql:2584]
REVOKE ALL ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;

-- [supabase/sources/base_schema.sql:2585]
REVOKE ALL ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;

-- [supabase/sources/base_schema.sql:2586]
REVOKE ALL ON FUNCTION get_withdrawable_amount(UUID) FROM PUBLIC;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:214]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM PUBLIC;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:215]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM anon;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:216]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM authenticated;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:217]
GRANT EXECUTE ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) TO service_role;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:290]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM PUBLIC;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:291]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM anon;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:292]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM authenticated;

-- [supabase/sources/migrations/00015_referral_atomic_wallet.sql:293]
GRANT EXECUTE ON FUNCTION public.credit_feeexpay_deposit(text) TO service_role;

-- [supabase/sources/migrations/00019_task_reward_notifications.sql:1]
-- Privilèges
GRANT EXECUTE ON FUNCTION submit_task(UUID, UUID, JSONB) TO authenticated;

-- [supabase/sources/migrations/00019_task_reward_notifications.sql:247]
GRANT EXECUTE ON FUNCTION approve_submission(UUID, UUID, TEXT) TO authenticated;

-- [supabase/sources/migrations/00021_fix_upgrade_and_referrals.sql:118]
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:115]
-- ============================================================
-- 4. PRIVILÈGES
-- ============================================================
-- activate_plan reste appelable par l'utilisateur connecté (il débite SON
-- propre wallet, contrôlé par auth.uid()).
GRANT EXECUTE ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:361]
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:362]
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM anon;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:362]
-- 🔒 credit_referral_commission ne doit JAMAIS être appelable depuis un
-- client (sinon un utilisateur pourrait se créditer une commission) :
-- réservée aux fonctions serveur (SECURITY DEFINER) et au service_role.
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM PUBLIC;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:368]
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM anon;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:369]
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM authenticated;

-- [supabase/sources/migrations/00022_referral_investment_commission.sql:370]
GRANT EXECUTE ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.add_reward(uuid, decimal, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_reward(uuid, decimal, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_submission(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_submission(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.reject_submission(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_submission(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_deposit(uuid, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_deposit(uuid, uuid, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_withdrawal(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_withdrawal(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ban_user(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ban_user(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_task(uuid, text, text, decimal, uuid, uuid, text, integer, text, text, integer, integer, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_task(uuid, text, text, decimal, uuid, uuid, text, integer, text, text, integer, integer, timestamptz, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_task(uuid, uuid, text, text, decimal, uuid, text, integer, text, text, integer, integer, timestamptz, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_task(uuid, uuid, text, text, decimal, uuid, text, integer, text, text, integer, integer, timestamptz, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.delete_task(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_task(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_plan(uuid, text, text, decimal, integer, decimal, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_plan(uuid, text, text, decimal, integer, decimal, decimal, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_plan(uuid, uuid, text, decimal, integer, decimal, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_plan(uuid, uuid, text, decimal, integer, decimal, decimal, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.toggle_plan_status(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_plan_status(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_users_with_details(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_users_with_details(text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_referral_commission(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_referral_commission(uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM anon;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, decimal, text, text, text) FROM anon;
