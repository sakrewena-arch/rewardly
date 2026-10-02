-- ============================================================
-- MIGRATION 00009 : Intégration PayGateGlobal
-- Ajoute les colonnes nécessaires pour les dépôts et retraits
--
-- ℹ️ PayGateGlobal (FLOOZ / TMONEY — Togo) ne fournit AUCUN endpoint de
--    payout : seule la référence de transaction du dépôt est stockée
--    (`paygate_tx_reference`). Pour les retraits, la colonne sert à
--    consigner la référence de virement saisie par l'administrateur.
--
-- ⚠️ Les colonnes historiques `feexpay_reference` (ancien prestataire)
--    ne sont PAS supprimées : elles restent en base, inutilisées, afin de
--    préserver l'historique des transactions. Aucune donnée n'est perdue.
-- ============================================================

-- 1. Ajouter les colonnes à la table deposits
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS paygate_tx_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- 2. Ajouter les colonnes à la table withdrawals
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS paygate_tx_reference TEXT,
  ADD COLUMN IF NOT EXISTS account_info TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT;

-- 3. Index pour les recherches par référence PayGateGlobal
CREATE INDEX IF NOT EXISTS idx_deposits_paygate_tx_reference ON public.deposits(paygate_tx_reference);
CREATE INDEX IF NOT EXISTS idx_withdrawals_paygate_tx_reference ON public.withdrawals(paygate_tx_reference);

-- 4. Reprise de l'historique de l'ancien prestataire, UNIQUEMENT si les
--    colonnes historiques existent (sinon la base est déjà neuve → no-op).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'deposits'
               AND column_name = 'feexpay_reference') THEN
    EXECUTE 'UPDATE public.deposits SET paygate_tx_reference = feexpay_reference '
         || 'WHERE feexpay_reference IS NOT NULL AND paygate_tx_reference IS NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'withdrawals'
               AND column_name = 'feexpay_reference') THEN
    EXECUTE 'UPDATE public.withdrawals SET paygate_tx_reference = feexpay_reference '
         || 'WHERE feexpay_reference IS NOT NULL AND paygate_tx_reference IS NULL';
  END IF;
END $$;