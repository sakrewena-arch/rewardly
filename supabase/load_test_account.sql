-- ============================================================
-- REWARDLY - COMPTE DE TEST : sokoumakaffessima@gmail.com
-- ============================================================
-- Charge un compte de démonstration avec :
--   · Solde (balance)          : 150 000 FCFA
--   · Gains (total_earnings)     : 130 000 FCFA
--   · Montant retirable          : 130 000 FCFA
--   · Notifications retraits payés : 100 000 / 80 000 / 250 000 / 20 000 / 35 000
--
-- 💡 Logique retirable (RPC get_withdrawable_amount) :
--   retirable = total_earnings
--             - retraits pending/approved (table withdrawals)
--             - transactions de retrait completed (wallet_transactions)
--             - paiements services
--   → On crée les retraits en statut 'paid' + notifications, SANS créer de
--     transaction de retrait completed, pour que le retirable reste 130 000.
--
-- ⚠️ Ré-exécutable : supprime puis recrée les retraits/notifications du compte.
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
  v_now timestamptz := now();
begin
  -- ==========================================================
  -- 1. TROUVER L'UTILISATEUR
  -- ==========================================================
  select id into v_user_id
  from auth.users
  where email = 'sokoumakaffessima@gmail.com'
  limit 1;

  if v_user_id is null then
    raise exception 'Utilisateur introuvable : sokoumakaffessima@gmail.com';
  end if;

  -- ==========================================================
  -- 2. WALLET (balance 150 000 / gains 130 000 / retirable 130 000)
  -- ==========================================================
  select id into v_wallet_id
  from public.wallets
  where user_id = v_user_id
  limit 1;

  if v_wallet_id is null then
    insert into public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
    values (v_user_id, 150000, 0, 130000, 0)
    returning id into v_wallet_id;
  else
    update public.wallets
    set balance = 150000,
        total_earnings = 130000,
        invested_capital = 0,
        locked_amount = 0,
        updated_at = v_now
    where id = v_wallet_id;
  end if;

  -- ==========================================================
  -- 3. NETTOYAGE (ré-exécoutable sans doublé)
  -- ===========================================================
  delete from public.withdrawals where user_id = v_user_id;
  delete from public.notifications where user_id = v_user_id and reference like 'load_test_paid_%';

  -- ==========================================================
  -- 4. RETRAITS 'PAYÉS' (historique visible côté admin)
  -- ==========================================================
  insert into public.withdrawals (user_id, amount, method, account_info, status, reviewed_by, created_at, updated_at)
  values
    (v_user_id, 100000, 'MTN',    '+2250700000001', 'paid', null, v_now - interval '12 days', v_now - interval '12 days'),
    (v_user_id, 80000,  'ORANGE', '+2250700000002', 'paid', null, v_now - interval '10 days', v_now - interval '10 days'),
    (v_user_id, 250000, 'WAVE',   '+2250700000003', 'paid', null, v_now - interval '7 days',  v_now - interval '7 days'),
    (v_user_id, 20000,  'MTN',    '+2250700000004', 'paid', null, v_now - interval '4 days',  v_now - interval '4 days'),
    (v_user_id, 35000,  'ORANGE', '+2250700000005', 'paid', null, v_now - interval '1 day',   v_now - interval '1 day');

  -- ==========================================================
  -- 5. NOTIFICATIONS "RETRAIT PAYÉ"
  -- ==========================================================
  insert into public.notifications (user_id, title, message, type, reference, is_read)
  values
    (v_user_id, 'Retrait payé', 'Votre retrait de 100 000 FCFA a été payé.', 'withdrawal', 'load_test_paid_100000', false),
    (v_user_id, 'Retrait payé', 'Votre retrait de 80 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_80000',  false),
    (v_user_id, 'Retrait payé', 'Votre retrait de 250 000 FCFA a été payé.', 'withdrawal', 'load_test_paid_250000', false),
    (v_user_id, 'Retrait payé', 'Votre retrait de 20 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_20000',  false),
    (v_user_id, 'Retrait payé', 'Votre retrait de 35 000 FCFA a été payé.',  'withdrawal', 'load_test_paid_35000',  false);

  raise notice '✅ Compte test chargé : % (wallet %)', 'sokoumakaffessima@gmail.com', v_wallet_id;
  raise notice '   balance=150000 | gains=130000 | retirable≈130000 | 5 notifications';
end $$;