-- ============================================================
-- REWARDLY - RETRAITS DANS TRANSACTIONS (sokoumakaffessima@gmail.com)
-- ============================================================
-- Complète le compte de test pour que les retraits payés apparaissent
-- AUSSI dans :
--   · Transactions récentes (dashboard)  → table wallet_transactions
--   · Page Historique                    → table wallet_transactions
--
-- Ce script :
--   1. Re-crée les 5 retraits 'paid' avec des dates ÉTALÉES SUR 4-5 MOIS
--      (jours IRRÉGULIERS, jamais aujourd'hui).
--   2. Ajoute les transactions wallet correspondantes (type 'withdrawal',
--      statut 'completed', montant NÉGATIF) liées aux retraits.
--   3. Met à jour les notifications aux mêmes dates.
--
-- ⚠️ Conséquence sur le montant retirable :
--   La RPC get_withdrawable_amount déduit les retraits 'completed' du
--   total_earnings. Avec ces 5 retraits visibles, le retirable sera calculé
--   comme suite : total_earnings(à ajuster) − 485 000 FCFA − ...
--   → Ajustez total_earnings en conséquence si vous voulez un retirable positif.
--
-- 💡 Ré-exécutable : les anciens retraits/transactions/notifications du
--   compte sont supprimés puis recréés (références 'load_test_*').
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
  v_retrait_100 uuid;
  v_retrait_80 uuid;
  v_retrait_250 uuid;
  v_retrait_20 uuid;
  v_retrait_35 uuid;
  v_date_1 timestamptz;
  v_date_2 timestamptz;
  v_date_3 timestamptz;
  v_date_4 timestamptz;
  v_date_5 timestamptz;
begin
  -- ==========================================================
  -- 1. TROUVER L'UTILISATEUR + WALLET
  -- ==========================================================
  select id into v_user_id
  from auth.users
  where email = 'sokoumakaffessima@gmail.com'
  limit 1;

  if v_user_id is null then
    raise exception 'Utilisateur introuvable : sokoumakaffessima@gmail.com';
  end if;

  select id into v_wallet_id
  from public.wallets
  where user_id = v_user_id
  limit 1;

  if v_wallet_id is null then
    insert into public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
    values (v_user_id, 150000, 0, 130000, 0)
    returning id into v_wallet_id;
  end if;

  -- ==========================================================
  -- 2. DATES ÉTALÉES SUR 4-5 MOIS À JOURS IRRÉGULIERS
  -- ==========================================================
  v_date_1 := timestamp '2026-04-11 14:32:00+00';   -- ~4,5 mois
  v_date_2 := timestamp '2026-05-03 09:15:00+00';   -- ~4 mois
  v_date_3 := timestamp '2026-06-27 18:45:00+00';   -- ~2 mois
  v_date_4 := timestamp '2026-07-14 11:05:00+00';   -- ~1,5 mois
  v_date_5 := timestamp '2026-08-22 16:40:00+00';   -- ~1 semaine

  -- ==========================================================
  -- 3. NETTOYAGE (ré-exécoutable sans doublons)
  -- ==========================================================
  delete from public.wallet_transactions
  where user_id = v_user_id and reference like 'load_test_wd_%';

  delete from public.withdrawals
  where user_id = v_user_id and account_info like 'load_test_phone_%';

  delete from public.notifications
  where user_id = v_user_id and reference like 'load_test_paid_%';

  -- ==========================================================
  -- 4. CRÉER LES 5 RETRAITS 'PAID'
  -- ==========================================================
  insert into public.withdrawals (user_id, amount, method, account_info, status, created_at, updated_at)
  values
    (v_user_id, 100000, 'MTN',    'load_test_phone_1', 'paid', v_date_1, v_date_1),
    (v_user_id, 80000,  'ORANGE', 'load_test_phone_2', 'paid', v_date_2, v_date_2),
    (v_user_id, 250000, 'WAVE',   'load_test_phone_3', 'paid', v_date_3, v_date_3),
    (v_user_id, 20000,  'MTN',    'load_test_phone_4', 'paid', v_date_4, v_date_4),
    (v_user_id, 35000,  'ORANGE', 'load_test_phone_5', 'paid', v_date_5, v_date_5);

  select id into v_retrait_100 from public.withdrawals where user_id = v_user_id and account_info = 'load_test_phone_1';
  select id into v_retrait_80  from public.withdrawals where user_id = v_user_id and account_info = 'load_test_phone_2';
  select id into v_retrait_250 from public.withdrawals where user_id = v_user_id and account_info = 'load_test_phone_3';
  select id into v_retrait_20  from public.withdrawals where user_id = v_user_id and account_info = 'load_test_phone_4';
  select id into v_retrait_35  from public.withdrawals where user_id = v_user_id and account_info = 'load_test_phone_5';
-- ==========================================================
  -- 5. TRANSACTIONS WALLET (montants NÉGATIFS, statut completed)
  --    → apparaissent dans Transactions récentes + Historique
  -- ==========================================================
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, description, status, reference, created_at)
  values
    (v_user_id, v_wallet_id, -100000, 'withdrawal', 'Retrait MTN (100 000 FCFA)',          'completed', 'load_test_wd_1', v_date_1),
    (v_user_id, v_wallet_id, -80000,  'withdrawal', 'Retrait Orange Money (80 000 FCFA)',   'completed', 'load_test_wd_2', v_date_2),
    (v_user_id, v_wallet_id, -250000, 'withdrawal', 'Retrait Wave (250 000 FCFA)',         'completed', 'load_test_wd_3', v_date_3),
    (v_user_id, v_wallet_id, -20000,  'withdrawal', 'Retrait MTN (20 000 FCFA)',           'completed', 'load_test_wd_4', v_date_4),
    (v_user_id, v_wallet_id, -35000,  'withdrawal', 'Retrait Orange Money (35 000 FCFA)',  'completed', 'load_test_wd_5', v_date_5);

  -- ==========================================================
  -- 6. NOTIFICATIONS "RETRAIT PAYÉ" aux MÊMES DATES
  -- ==========================================================
  insert into public.notifications (user_id, title, message, type, reference, is_read, created_at)
  values
    (v_user_id, 'Retrait payé', 'Votre retrait de 100 000 FCFA a été payé.', 'withdrawal', 'load_test_paid_100000', false, v_date_1),
    (v_user_id, 'Retrait payé', 'Votre retrait de 80 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_80000',  false, v_date_2),
    (v_user_id, 'Retrait payé', 'Votre retrait de 250 000 FCFA a été payé.', 'withdrawal', 'load_test_paid_250000', false, v_date_3),
    (v_user_id, 'Retrait payé', 'Votre retrait de 20 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_20000',  false, v_date_4),
    (v_user_id, 'Retrait payé', 'Votre retrait de 35 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_35000',  false, v_date_5);

  raise notice '✅ Retraits injectés dans les transactions : 5 retraits payés (dates étalées 4-5 mois).';
  raise notice '   wallet_transactions : 5 | withdrawals : 5 | notifications : 5';
end $$;