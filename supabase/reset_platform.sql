-- ============================================================
-- RÉINITIALISATION COMPLÈTE DE LA PLATEFORME REWARDLY
-- ⚠️ À EXÉCUTER UNE SEULE FOIS AVANT LE LANCEMENT
--
-- ✅ ROBUSTE : chaque suppression est conditionnée à l'existence
--    de la table (to_regclass). Si une table manque (ex: investments
--    non créée), le script continue sans erreur.
--
-- Ce script remet tous les compteurs à zéro ET supprime :
--   • Balances des wallets → 0
--   • Gains totaux → 0
--   • Toutes les transactions → supprimées
--   • Tous les dépôts / retraits → supprimés
--   • Toutes les soumissions de tâches → supprimées
--   • Tous les parrainages → supprimés
--   • Toutes les commandes services → supprimées
--   • Toutes les notifications → supprimées
--   • Toutes les TÂCHES → supprimées
--   • Tous les PLANS → supprimés
--   • Toutes les CATÉGORIES → supprimées
--   • Tous les CHAMPS DE SOUMISSION → supprimés
--
-- ⚠️ CONSERVE :
--   • Les utilisateurs (profiles + auth.users)
--   • Les préférences (user_preferences)
--   • Les paramètres (system_settings)
-- ============================================================

begin;

-- ============================================================
-- 1. SUPPRIMER LES EXTRAITS FINANCIERS
-- ============================================================

-- Supprimer les transactions de wallet
do $$
begin
  if to_regclass(''public.wallet_transactions'') is not null then
    delete from public.wallet_transactions;
  end if;
end $$;

-- Supprimer les retraits
do $$
begin
  if to_regclass(''public.withdrawals'') is not null then
    delete from public.withdrawals;
  end if;
end $$;

-- Supprimer les dépôts
do $$
begin
  if to_regclass(''public.deposits'') is not null then
    delete from public.deposits;
  end if;
end $$;

-- Supprimer les investissements
do $$
begin
  if to_regclass(''public.investments'') is not null then
    delete from public.investments;
  end if;
end $$;

-- ============================================================
-- 2. SUPPRIMER L'ACTIVITÉ DES TÂCHES
-- ============================================================

-- Supprimer les réponses de soumission
do $$
begin
  if to_regclass(''public.submission_answers'') is not null then
    delete from public.submission_answers;
  end if;
end $$;

-- Supprimer les soumissions de tâches
do $$
begin
  if to_regclass(''public.task_submissions'') is not null then
    delete from public.task_submissions;
  end if;
end $$;

-- ============================================================
-- 3. SUPPRIMER LE PARRAINAGE
-- ============================================================

do $$
begin
  if to_regclass(''public.referrals'') is not null then
    delete from public.referrals;
  end if;
end $$;

-- Réinitialiser referred_by dans les profils
do $$
begin
  if to_regclass(''public.profiles'') is not null then
    update public.profiles
    set referred_by = null;
  end if;
end $$;

-- ============================================================
-- 4. SUPPRIMER LES COMMANDES DE SERVICES
-- ============================================================

do $$
begin
  if to_regclass(''public.service_orders'') is not null then
    delete from public.service_orders;
  end if;
end $$;

-- ============================================================
-- 5. SUPPRIMER LES NOTIFICATIONS
-- ============================================================

do $$
begin
  if to_regclass(''public.notifications'') is not null then
    delete from public.notifications;
  end if;
end $$;
-- ============================================================
-- 6. SUPPRIMER LES TÂCHES ET LEURS STRUCTURES
-- ============================================================

-- Supprimer les champs de soumission
do $$
begin
  if to_regclass(''public.submission_fields'') is not null then
    delete from public.submission_fields;
  end if;
end $$;

-- Supprimer les tâches
do $$
begin
  if to_regclass(''public.tasks'') is not null then
    delete from public.tasks;
  end if;
end $$;

-- Supprimer les catégories de tâches
do $$
begin
  if to_regclass(''public.task_categories'') is not null then
    delete from public.task_categories;
  end if;
end $$;

-- ============================================================
-- 7. SUPPRIMER LES PLANS
-- ============================================================

do $$
begin
  if to_regclass(''public.plans'') is not null then
    delete from public.plans;
  end if;
end $$;

-- ============================================================
-- 8. RÉINITIALISER LES WALLETS À ZÉRO
-- ============================================================

do $$
begin
  if to_regclass(''public.wallets'') is not null then
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
-- 9. RÉINITIALISER LES SESSIONS (facultatif - déconnecte tout le monde)
-- ============================================================

-- Déconnecter toutes les sessions utilisateurs (optionnel, commenter si non souhaité)
-- delete from auth.sessions;

-- ============================================================
-- 10. VÉRIFICATION APRÈS RÉINITIALISATION
-- ============================================================

-- Afficher les totaux après reset (doit afficher 0 partout)
select 'wallets' as table_name, count(*) as count, coalesce(sum(balance), 0) as total_balance
from public.wallets
union all
select ''wallet_transactions'', count(*), 0
from public.wallet_transactions
union all
select ''deposits'', count(*), 0
from public.deposits
union all
select ''withdrawals'', count(*), 0
from public.withdrawals
union all
select ''task_submissions'', count(*), 0
from public.task_submissions
union all
select ''referrals'', count(*), 0
from public.referrals
union all
select ''service_orders'', count(*), 0
from public.service_orders
union all
select ''notifications'', count(*), 0
from public.notifications
union all
select ''tasks (supprimées)'', count(*), 0
from public.tasks
union all
select ''plans (supprimés)'', count(*), 0
from public.plans
union all
select ''task_categories (supprimées)'', count(*), 0
from public.task_categories
union all
select ''submission_fields (supprimés)'', count(*), 0
from public.submission_fields
union all
select ''profiles (utilisateurs conservés)'', count(*), 0
from public.profiles;

commit;
