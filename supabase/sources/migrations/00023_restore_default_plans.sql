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
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS min_profitability DECIMAL(5,2) DEFAULT 10;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_profitability DECIMAL(5,2) DEFAULT 20;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#9D3FE7';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Medal';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Standard';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS allow_upgrade BOOLEAN DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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

-- ------------------------------------------------------------
-- 4. Compléter les champs d'affichage manquants des 3 packs
-- ------------------------------------------------------------
UPDATE public.plans p
SET daily_tasks = CASE p.slug WHEN 'bronze' THEN 1 WHEN 'silver' THEN 3 WHEN 'gold' THEN -1 ELSE p.daily_tasks END,
    sort_order  = CASE p.slug WHEN 'bronze' THEN 1 WHEN 'silver' THEN 2 WHEN 'gold' THEN 3 ELSE p.sort_order END,
    updated_at  = NOW()
WHERE p.slug IN ('bronze', 'silver', 'gold')
  AND (p.daily_tasks IS NULL OR p.sort_order IS NULL);

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

-- ------------------------------------------------------------
-- 6. Contrôle du résultat (visible dans le SQL Editor)
-- ------------------------------------------------------------
SELECT slug, name, price, daily_tasks, is_active
FROM public.plans
ORDER BY sort_order, name;
