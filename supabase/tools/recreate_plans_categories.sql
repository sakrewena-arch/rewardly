-- ============================================================
-- RECRÉER LES PLANS PAR DÉFAUT + CATÉGORIES DE TÂCHES
-- À exécuter après reset_platform.sql (qui les supprime)
-- ============================================================

begin;

-- ============================================================
-- 1. PLANS PAR DÉFAUT (Bronze, Silver, Gold)
-- ============================================================

insert into public.plans (name, slug, price, daily_tasks, min_profitability, max_profitability, color, icon, badge, is_active, sort_order)
values
  ('Bronze', 'bronze', 5000, 1, 0.08, 0.12, '#CD7F32', 'Medal', 'Débutant', true, 1),
  ('Silver', 'silver', 10000, 3, 0.12, 0.18, '#C0C0C0', 'Medal', 'Intermédiaire', true, 2),
  ('Gold', 'gold', 20000, -1, 0.18, 0.25, '#FFD700', 'Crown', 'Premium', true, 3);

-- ============================================================
-- 2. CATÉGORIES DE TÂCHES
-- ============================================================

-- La table task_categories n'a PAS de colonne description
insert into public.task_categories (name, slug, icon)
values
  ('Visite de site', 'visite-site', '🌐'),
  ('Sondage', 'sondage', '📊'),
  ('Test d''application', 'test-app', '📱'),
  ('Abonnement', 'abonnement', '🔔'),
  ('Partage', 'partage', '📣');

-- ============================================================
-- 3. VÉRIFICATION
-- ============================================================

select 'Plans recréés' as info, count(*) as count from public.plans
union all
select 'Catégories recréées', count(*) from public.task_categories;

commit;