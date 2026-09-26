-- ============================================================
-- Table des commandes de services publicitaires
-- ============================================================
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  company_name text not null,
  contact_email text not null,
  contact_phone text not null,
  service_type text not null, -- sondage, visite, test_jeu, test_app, test_site, test_ia, autre
  description text,
  pack text not null, -- 500k, 1m, 2m
  pack_amount numeric not null,
  duration text not null, -- 30j, 60j, 90j, illimite
  target_users integer, -- nombre d'utilisateurs visés
  url text, -- URL du site à visiter/tester
  download_url text, -- URL de téléchargement (jeu, app)
  questions text, -- questions du sondage
  ia_url text, -- URL de l'IA à tester
  app_name text, -- nom de l'application/IA
  game_name text, -- nom du jeu
  site_name text, -- nom du site web
  instructions text, -- instructions pour les utilisateurs
  status text not null default 'pending', -- pending, approved, rejected, completed
  payment_status text not null default 'paid', -- paid, refunded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger pour updated_at
drop trigger if exists set_service_orders_updated_at on public.service_orders;
create trigger set_service_orders_updated_at
  before update on public.service_orders
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.service_orders enable row level security;

-- Un utilisateur peut lire ses propres commandes
drop policy if exists "Users read own service orders" on public.service_orders;
create policy "Users read own service orders"
  on public.service_orders for select
  using (auth.uid() = user_id);

-- Un utilisateur peut créer une commande
drop policy if exists "Users insert service orders" on public.service_orders;
create policy "Users insert service orders"
  on public.service_orders for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- Fonction RPC pour créer une commande + débiter le wallet
-- ============================================================
create or replace function public.create_service_order(
  p_company_name text,
  p_contact_email text,
  p_contact_phone text,
  p_service_type text,
  p_description text,
  p_pack text,
  p_pack_amount numeric,
  p_duration text,
  p_target_users integer,
  p_url text default null,
  p_download_url text default null,
  p_questions text default null,
  p_ia_url text default null,
  p_app_name text default null,
  p_game_name text default null,
  p_site_name text default null,
  p_instructions text default null
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_id uuid;
  v_balance numeric;
  v_order_id uuid;
begin
  if v_user_id is null then
    return json_build_object('success', false, 'error', 'Non authentifié');
  end if;

  -- Vérifier le solde du wallet
  select id, balance into v_wallet_id, v_balance
  from public.wallets
  where user_id = v_user_id
  limit 1;

  if v_wallet_id is null then
    return json_build_object('success', false, 'error', 'Wallet introuvable');
  end if;

  if v_balance < p_pack_amount then
    return json_build_object('success', false, 'error', 'Solde insuffisant. Rechargez votre wallet.');
  end if;

  -- Débiter le wallet
  update public.wallets
  set balance = balance - p_pack_amount,
      updated_at = now()
  where id = v_wallet_id;

  -- Créer la transaction
  insert into public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
  values (v_user_id, v_wallet_id, -p_pack_amount, 'service', 'Paiement pack ' || p_pack || ' - ' || p_service_type, 'completed');

  -- Créer la commande
  insert into public.service_orders (
    user_id, company_name, contact_email, contact_phone,
    service_type, description, pack, pack_amount, duration, target_users,
    url, download_url, questions, ia_url, app_name, game_name, site_name, instructions,
    status, payment_status
  ) values (
    v_user_id, p_company_name, p_contact_email, p_contact_phone,
    p_service_type, p_description, p_pack, p_pack_amount, p_duration, p_target_users,
    p_url, p_download_url, p_questions, p_ia_url, p_app_name, p_game_name, p_site_name, p_instructions,
    'pending', 'paid'
  ) returning id into v_order_id;

  return json_build_object('success', true, 'order_id', v_order_id);
end;
$$;