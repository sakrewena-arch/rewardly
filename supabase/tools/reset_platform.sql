-- ============================================================
-- RESET DOUX - Réinitialise UNIQUEMENT les données d'activité
-- ⚠️ CONSERVE : utilisateurs, plans, tâches, catégories, PACKS (investissements)
--
-- ✅ But :
--   · Remet TOUS les compteurs financiers à 0 (wallets)
--   · Supprime les activités réalisées (transactions, dépôts, retraits,
--     soumissions de tâches, parrainages, commandes services, notifications)
--   · CONSERVE les packs actifs (investissements) → pas besoin de racheter
--
-- ✅ ROBUSTE : chaque suppression est conditionnée à l'existence de la table
--   (to_regclass) et à l'existence de la colonne (information_schema).
--   Aucune erreur même si une table/colonne manque.
-- ============================================================

begin;

-- ============================================================
-- 1. SUPPRIMER LES EXTRAITS D'ACTIVITÉ FINANCIÈRE
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

-- ⚠️ INVESTISSEMENTS (PACKS) : CONSERVÉS — aucune suppression.
-- Les utilisateurs gardent leur pack actif (pas de rachat demandé).

-- Supprimer les réponses de soumission (activité liée aux gains)
do $$
begin
  if to_regclass('public.submission_answers') is not null then
    delete from public.submission_answers;
  end if;
end $$;

-- Supprimer les soumissions de tâches
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

-- Réinitialiser referred_by (UNIQUEMENT si la colonne existe)
do $$
begin
  if to_regclass('public.profiles') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name = 'referred_by'
     ) then
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
-- 💪 ROBUSTE : chaque colonne est vérifiée via information_schema.
-- Les anciennes bases n'ont pas invested_capital / total_earnings /
-- locked_amount → on met à jour UNIQUEMENT les colonnes présentes
-- (balance + updated_at existent dans toutes les versions).

do $$
declare
  v_has_invested boolean;
  v_has_total_earnings boolean;
  v_has_locked boolean;
begin
  if to_regclass('public.wallets') is null then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets'
      and column_name = 'invested_capital'
  ) into v_has_invested;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets'
      and column_name = 'total_earnings'
  ) into v_has_total_earnings;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets'
      and column_name = 'locked_amount'
  ) into v_has_locked;

  -- Toujours présent dans toutes les versions :
  update public.wallets set balance = 0, updated_at = now();

  if v_has_invested then
    update public.wallets set invested_capital = 0;
  end if;
  if v_has_total_earnings then
    update public.wallets set total_earnings = 0;
  end if;
  if v_has_locked then
    update public.wallets set locked_amount = 0;
  end if;
end $$;

-- ============================================================
-- 3. VÉRIFICATION (compteurs à zéro + tables conservées)
-- ============================================================
-- 💪 100 % ROBUSTE : chaque table est vérifiée via to_regclass AVANT
-- d'être interrogée (FORMAT/EXECUTE dynamique). Une table absente est
-- simplement signalée, JAMAIS une erreur — le script n'échoue plus.

do $$
declare
  v_tables text[] := array[
    'wallets', 'wallet_transactions', 'deposits', 'withdrawals',
    'task_submissions', 'submission_answers', 'referrals',
    'service_orders', 'notifications'
  ];
  v_conserved text[] := array[
    'plans', 'tasks', 'task_categories', 'profiles', 'investments'
  ];
  v_t text;
  v_count bigint;
begin
  raise notice '=== ACTIVITÉ (doit être 0 / VIDE) ===';
  foreach v_t in array v_tables
  loop
    if to_regclass('public.' || v_t) is not null then
      execute format('select count(*) from public.%I', v_t) into v_count;
      raise notice '   % : %', v_t, v_count;
    else
      raise notice '   % : TABLE ABSENTE (ignorée)', v_t;
    end if;
  end loop;

  -- Solde total des wallets (si la colonne balance existe)
  if to_regclass('public.wallets') is not null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets'
      and column_name = 'balance'
  ) then
    execute 'select coalesce(sum(balance), 0) from public.wallets' into v_count;
    raise notice '   wallets.balance (total) : %', v_count;
  end if;

  raise notice '=== CONSERVÉS (ne doivent pas être 0) ===';
  foreach v_t in array v_conserved
  loop
    if to_regclass('public.' || v_t) is not null then
      execute format('select count(*) from public.%I', v_t) into v_count;
      raise notice '   % : %', v_t, v_count;
    else
      raise notice '   % : TABLE ABSENTE (à créer via consolidated_schema)', v_t;
    end if;
  end loop;
end $$;

-- ============================================================
-- 4. DIAGNOSTIC : TABLES ATTENDUES MANQUANTES
-- ============================================================
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