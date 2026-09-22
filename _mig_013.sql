-- ============================================================
-- Ajouter le type 'service' à la contrainte wallet_transactions
-- ============================================================
alter table public.wallet_transactions
  drop constraint if exists wallet_transactions_type_check;

alter table public.wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in ('deposit', 'withdrawal', 'reward', 'investment', 'bonus', 'referral', 'admin_adjustment', 'service'));