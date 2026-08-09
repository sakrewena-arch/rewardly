-- ============================================================
-- INJECTION D'UN DÉPÔT DE 20 000 FCFA
-- Pour l'utilisateur : angelusazazel81@gmail.com
-- ============================================================

do $$
declare
  v_user_id uuid;
  v_wallet_id uuid;
  v_balance numeric;
begin
  -- 1. Trouver l'utilisateur par email
  select id into v_user_id
  from auth.users
  where email = 'angelusazazel81@gmail.com'
  limit 1;

  if v_user_id is null then
    raise exception 'Utilisateur introuvable avec cet email';
  end if;

  -- 2. Récupérer le wallet de l'utilisateur
  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  limit 1;

  -- 3. Créer le wallet s'il n'existe pas
  if v_wallet_id is null then
    insert into public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
    values (v_user_id, 0, 0, 0, 0)
    returning id into v_wallet_id;
    v_balance := 0;
  end if;

  -- 4. Créer le dépôt approuvé
  insert into public.deposits (user_id, amount, method, reference, status)
  values (v_user_id, 20000, 'ADMIN', 'admin-injection-' || gen_random_uuid(), 'approved');

  -- 5. Créditer le wallet
  update public.wallets
  set balance = v_balance + 20000,
      updated_at = now()
  where id = v_wallet_id;

  -- 6. Créer la transaction
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
  values (v_user_id, v_wallet_id, 20000, 'deposit', 'Dépôt administrateur (injection 20 000 FCFA)', 'completed');

  -- 7. Notifier l'utilisateur
  insert into public.notifications (user_id, title, message, type, is_read)
  values (v_user_id, 'Dépôt crédité ✅', 'Votre compte a été crédité de 20 000 FCFA.', 'deposit', false);

  raise notice 'Dépôt de 20 000 FCFA injecté avec succès pour %', 'angelusazazel81@gmail.com';
end $$;