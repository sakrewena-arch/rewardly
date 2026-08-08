-- ============================================================
-- Table des préférences utilisateur (langue, devise, notifications)
-- ============================================================
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'fr',
  currency text not null default 'XOF',
  push_notifications boolean not null default true,
  email_notifications boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger pour mettre à jour updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.user_preferences enable row level security;

-- Un utilisateur ne peut lire/écrire que ses propres préférences
drop policy if exists "Users read own preferences" on public.user_preferences;
create policy "Users read own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert own preferences" on public.user_preferences;
create policy "Users insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own preferences" on public.user_preferences;
create policy "Users update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

-- ============================================================
-- Fonction RPC pour upsert les préférences (évite les conflits)
-- ============================================================
create or replace function public.upsert_user_preferences(
  p_language text,
  p_currency text,
  p_push_notifications boolean,
  p_email_notifications boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id, language, currency, push_notifications, email_notifications)
  values (auth.uid(), p_language, p_currency, p_push_notifications, p_email_notifications)
  on conflict (user_id)
  do update set
    language = excluded.language,
    currency = excluded.currency,
    push_notifications = excluded.push_notifications,
    email_notifications = excluded.email_notifications,
    updated_at = now();
end;
$$;