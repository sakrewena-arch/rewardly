-- ============================================================
-- ①  DÉPÔT RÉALISTE DE 20 000 FCFA — OPÉRATEUR TOGOCOM (TOGO)
-- ============================================================
-- Compte ciblé : wlagbema@gmail.com
--
-- Crée exactement ce que l'application crée pour un vrai dépôt :
--   • `deposits`            → dépôt approuvé (opérateur TOGOCOM TG)
--   • `wallet_transactions` → type `deposit`, +20 000, status `completed`
--   • crédit du solde du wallet (+20 000)
--
-- ⛔ AUCUNE notification n'est créée (contrairement au flux automatique).
-- ✅ Idempotent : si la référence du dépôt existe déjà, rien n'est refait.
-- ============================================================

DO $$
DECLARE
  -- ⚙️ Paramètres -------------------------------------------------
  v_email     text        := 'wlagbema@gmail.com';
  v_amount    numeric     := 20000;                       -- montant du dépôt
  v_method    text        := 'TOGOCOM TG';                -- opérateur Mobile Money du Togo
  v_phone     text        := '22890421876';               -- numéro Togo (indicatif +228)
  v_date      timestamptz := (CURRENT_DATE - INTERVAL '12 days')
                             + INTERVAL '18 hours 47 minutes';   -- date/heure réaliste
  v_ref       text        := 'FXP-DEP-'
                             || to_char(CURRENT_DATE - INTERVAL '12 days', 'YYYYMMDD')
                             || '-8HK4M2';                      -- référence type FeeXPay
  -- ---------------------------------------------------------------
  v_user_id   uuid;
  v_wallet_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable : %', v_email;
  END IF;

  -- Sécurité : garantir profil + wallet (si le compte vient d'être recréé)
  INSERT INTO public.profiles (user_id, full_name, username, role, referral_code, is_active, is_banned)
  SELECT v_user_id, 'Wlagbema', NULL, 'user',
         UPPER(SUBSTRING(MD5(v_user_id::TEXT || 'rewardly') FROM 1 FOR 8)), true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_user_id);

  INSERT INTO public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
  SELECT v_user_id, 0, 0, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = v_user_id);

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;

  -- Déjà appliqué ?
  IF EXISTS (SELECT 1 FROM public.wallet_transactions t WHERE t.reference = v_ref) THEN
    RAISE NOTICE 'Dépôt déjà enregistré (référence %) — rien à faire.', v_ref;
    RETURN;
  END IF;

  -- 1) Le dépôt (comme un vrai dépôt Mobile Money validé)
  INSERT INTO public.deposits
    (user_id, amount, method, reference, status, admin_comment, created_at, updated_at)
  VALUES
    (v_user_id, v_amount, v_method, v_ref, 'approved',
     'Dépôt Mobile Money confirmé — ' || v_method || ' (' || v_phone || ')',
     v_date, v_date);

  -- 2) La transaction du portefeuille (+ montant)
  INSERT INTO public.wallet_transactions
    (user_id, wallet_id, amount, type, description, reference, status, created_at)
  VALUES
    (v_user_id, v_wallet_id, v_amount, 'deposit',
     'Dépôt via ' || v_method, v_ref, 'completed', v_date);

  -- 3) Crédit du solde
  UPDATE public.wallets
  SET balance = balance + v_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  RAISE NOTICE '✅ Dépôt de % FCFA via % enregistré pour %', v_amount, v_method, v_email;
END $$;

-- ------------------------------------------------------------
-- Contrôle : le dépôt et la transaction correspondante
-- ------------------------------------------------------------
SELECT d.created_at AS date_depot, d.amount, d.method, d.status, d.reference
FROM public.deposits d
JOIN auth.users u ON u.id = d.user_id
WHERE u.email = 'wlagbema@gmail.com'
ORDER BY d.created_at DESC
LIMIT 5;

SELECT w.balance AS solde_actuel, w.total_earnings AS gains_cumules
FROM public.wallets w
JOIN auth.users u ON u.id = w.user_id
WHERE u.email = 'wlagbema@gmail.com';
