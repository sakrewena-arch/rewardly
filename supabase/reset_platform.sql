-- ============================================================
-- RÉINITIALISATION COMPLÈTE DE LA PLATEFORME REWARDLY
-- ⚠️ À EXÉCUTER UNE SEULE FOIS AVANT LE LANCEMENT
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
delete from public.wallet_transactions;

-- Supprimer les retraits
delete from public.withdrawals;

-- Supprimer les dépôts
delete from public.deposits;

-- Supprimer les investissements
delete from public.investments;

-- ============================================================
-- 2. SUPPRIMER L'ACTIVITÉ DES TÂCHES
-- ============================================================

-- Supprimer les réponses de soumission
delete from public.submission_answers;

-- Supprimer les soumissions de tâches
delete from public.task_submissions;

-- ============================================================
-- 3. SUPPRIMER LE PARRAINAGE
-- ============================================================

delete from public.referrals;

-- Réinitialiser referred_by dans les profils
update public.profiles
set referred_by = null;

-- ============================================================
-- 4. SUPPRIMER LES COMMANDES DE SERVICES
-- ============================================================

delete from public.service_orders;

-- ============================================================
-- 5. SUPPRIMER LES NOTIFICATIONS
-- ============================================================

delete from public.notifications;

-- ============================================================
-- 6. SUPPRIMER LES TÂCHES ET LEURS STRUCTURES
-- ============================================================

-- Supprimer les champs de soumission
delete from public.submission_fields;

-- Supprimer les tâches
delete from public.tasks;

-- Supprimer les catégories de tâches
delete from public.task_categories;

-- ============================================================
-- 7. SUPPRIMER LES PLANS
-- ============================================================

delete from public.plans;

-- ============================================================
-- 8. RÉINITIALISER LES WALLETS À ZÉRO
-- ============================================================

update public.wallets
set
  balance = 0,
  invested_capital = 0,
  total_earnings = 0,
  locked_amount = 0,
  updated_at = now();

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
select 'tasks (supprimées)', count(*), 0
from public.tasks
union all
select 'plans (supprimés)', count(*), 0
from public.plans
union all
select 'task_categories (supprimées)', count(*), 0
from public.task_categories
union all
select 'submission_fields (supprimés)', count(*), 0
from public.submission_fields
union all
select 'profiles (utilisateurs conservés)', count(*), 0
from public.profiles;

commit;