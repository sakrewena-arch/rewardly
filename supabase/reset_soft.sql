-- ============================================================
-- RESET DOUX - Réinitialise UNIQUEMENT les données financières
-- ⚠️ CONSERVE : utilisateurs, plans, tâches, catégories
-- ============================================================

begin;

-- ============================================================
-- 1. SUPPRIMER LES EXTRAITS FINANCIERS
-- ============================================================

-- Supprimer les transactions de wallet
delete from public.wallet_transactions;

-- Supprimer les retraits
delete from public.withdrawals;

-- Supprimer les dépôts
delete from public.deposits;

-- Supprimer les investissements
delete from public.investments;

-- Supprimer les soumissions de tâches (activité liée aux gains)
delete from public.submission_answers;
delete from public.task_submissions;

-- Supprimer les parrainages (liés aux commissions)
delete from public.referrals;
update public.profiles set referred_by = null;

-- Supprimer les commandes de services
delete from public.service_orders;

-- Supprimer les notifications
delete from public.notifications;

-- ============================================================
-- 2. RÉINITIALISER LES WALLETS À ZÉRO
-- ============================================================

update public.wallets
set
  balance = 0,
  invested_capital = 0,
  total_earnings = 0,
  locked_amount = 0,
  updated_at = now();

-- ============================================================
-- 3. VÉRIFICATION (plans/tâches/catégories CONSERVÉS)
-- ============================================================

select 'wallets' as info, count(*) as count, coalesce(sum(balance), 0) as total_balance
from public.wallets
union all
select 'wallet_transactions', count(*), 0
from public.wallet_transactions
union all
select 'deposits', count(*), 0
from public.deposits
union all
select 'withdrawals', count(*), 0
from public.withdrawals
union all
select 'task_submissions', count(*), 0
from public.task_submissions
union all
select 'referrals', count(*), 0
from public.referrals
union all
select 'service_orders', count(*), 0
from public.service_orders
union all
select 'notifications', count(*), 0
from public.notifications
union all
-- ✅ CONSERVÉS (ne doivent pas être 0)
select 'plans (conservés)', count(*), 0
from public.plans
union all
select 'tasks (conservées)', count(*), 0
from public.tasks
union all
select 'task_categories (conservées)', count(*), 0
from public.task_categories
union all
select 'profiles (conservés)', count(*), 0
from public.profiles;

commit;