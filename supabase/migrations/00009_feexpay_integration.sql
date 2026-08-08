-- ============================================================
-- MIGRATION : Intégration FeeXPay
-- Ajoute les colonnes nécessaires pour les dépôts et retraits
-- ============================================================

-- 1. Ajouter les colonnes à la table deposits
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- 2. Ajouter les colonnes à la table withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS feexpay_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_info TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- 3. Index pour les recherches par référence FeeXPay
CREATE INDEX IF NOT EXISTS idx_deposits_feexpay_reference ON public.deposits(feexpay_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_feexpay_reference ON public.withdrawals(feexpay_reference);