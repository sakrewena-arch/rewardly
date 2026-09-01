-- ============================================================
-- REWARDLY - S'assurer que wallets possède les colonnes financières
-- ============================================================
-- Certaines bases de production ont été créées avec un schéma `wallets`
-- incomplet (balance uniquement). Les RPC et le code supposent :
--   balance, invested_capital, total_earnings, locked_amount
-- Cette migration ajoute les colonnes manquantes SANS toucher aux données.
-- IDEMPOTENT : ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS invested_capital DECIMAL(12,0) NOT NULL DEFAULT 0;

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,0) NOT NULL DEFAULT 0;

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS locked_amount DECIMAL(12,0) NOT NULL DEFAULT 0;

-- Vérification
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'wallets'
order by ordinal_position;