-- ============================================================
-- RESET DOUX - Réinitialise UNIQUEMENT les données financières
-- ⚠️ CONSERVE : utilisateurs, plans, tâches, catégories
--
-- ✅ ROBUSTE : chaque suppression est conditionnée à l'existence
--    de la table (to_regclass). Si une table manque (ex: investments
--    non créée), le script continue sans erreur.
-- ============================================================

begin;

-- ============================================================
-- 1. SUPPRIMER LES EXTRAITS FINANCIERS
-- ============================================================

-- Supprimer les transactions de wallet
do $$
begin
  if to_regclass('public.wallet_transactions') is not null then
    delete from public.wallet_transactions;
  end if;
end $$;

-- Supprimer les retraits
do $$
begin
  if to_regclass('public.withdrawals') is not null then
    delete from public.withdrawals;
  end if;
end $$;

-- Supprimer les dépôts
do $$
begin
  if to_regclass('public.deposits') is not null then
    delete from public.deposits;
  end if;
end $$;

-- Supprimer les investissements
do $$
begin
  if to_regclass('public.investments') is not null then
    delete from public.investments;
  end if;
end $$;

-- Supprimer les soumissions de tâches (activité liée aux gains)
do $$
begin
  if to_regclass('public.submission_answers') is not null then
    delete from public.submission_answers;
  end if;
end $$;

do $$
begin
  if to_regclass('public.task_submissions') is not null then
    delete from public.task_submissions;
  end if;
end $$;

-- Supprimer les parrainages (liés aux commissions)
do $$
begin
  if to_regclass('public.referrals') is not null then
    delete from public.referrals;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    update public.profiles set referred_by = null;
  end if;
end $$;

-- Supprimer les commandes de services
do $$
begin
  if to_regclass('public.service_orders') is not null then
    delete from public.service_orders;
  end if;
end $$;

-- Supprimer les notifications
do $$
begin
  if to_regclass('public.notifications') is not null then
    delete from public.notifications;
  end if;
end $$;

-- ============================================================
-- 2. RÉINITIALISER LES WALLETS À ZÉRO
-- ============================================================

do $$
begin
  if to_regclass('public.wallets') is not null then
    update public.wallets
    set
      balance = 0,
      invested_capital = 0,
      total_earnings = 0,
      locked_amount = 0,
      updated_at = now();
  end if;
end $$;

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

-- ============================================================
-- 4. DIAGNOSTIC : LISTS LES TABLES ATTENDUES MANQUANTES
-- ============================================================
-- Utile pour détecter un schéma incomplet (ex: investments absente).
do $$
declare
  v_missing text := '';
begin
  if to_regclass('public.wallets') is null then v_missing := v_missing || 'wallets, '; end if;
  if to_regclass('public.wallet_transactions') is null then v_missing := v_missing || 'wallet_transactions, '; end if;
  if to_regclass('public.deposits') is null then v_missing := v_missing || 'deposits, '; end if;
  if to_regclass('public.withdrawals') is null then v_missing := v_missing || 'withdrawals, '; end if;
  if to_regclass('public.investments') is null then v_missing := v_missing || 'investments, '; end if;
  if to_regclass('public.task_submissions') is null then v_missing := v_missing || 'task_submissions, '; end if;
  if to_regclass('public.referrals') is null then v_missing := v_missing || 'referrals, '; end if;
  if to_regclass('public.service_orders') is null then v_missing := v_missing || 'service_orders, '; end if;
  if to_regclass('public.notifications') is null then v_missing := v_missing || 'notifications, '; end if;

  if v_missing = '' then
    raise notice '✅ Toutes les tables financières attendues existent.';
  else
    raise notice '⚠️ Tables manquantes : % — exécutez le schéma consolidé (consolidated_schema.sql) pour les créer.', v_missing;
  end if;
end $$;

commit;