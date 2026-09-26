-- ============================================================
-- ③  HISTORIQUE RÉALISTE : GAINS + RETRAITS SUR ~2 ANS (TOGO)
-- ============================================================
-- Compte ciblé : wlagbema@gmail.com
--
-- Génère un historique crédible de membre actif :
--   • 2 à 3 RETRAITS par mois, à des dates IRRÉGULIÈRES
--     (montants variés 5 000 → 15 000 FCFA, arrondis à 1 000)
--   • vers TOGOCOM TG / MOOV TG sur des numéros togolais réalistes
--   • statut `paid` + transaction `withdrawal` complétée (négative)
--   • 12 à 18 GAINS de tâches par mois pour justifier les retraits
--     (descriptions réelles : visite de site, sondage, partage…)
--
-- ⛔ AUCUNE notification n'est créée.
-- 📊 Visible dans « Transactions récentes » (accueil) et « Historique ».
-- ✅ Les totaux du portefeuille sont recalculés → Retirable / Gains cohérents.
-- ✅ Idempotent : les lignes générées portent la référence `DEMO-…` et sont
--    supprimées puis régénérées (les vraies données ne sont jamais touchées).
--    Le générateur utilise une graine fixe → même historique à chaque exécution.
--
-- ⚠️ À exécuter APRÈS le script ② (date d'adhésion).
-- ============================================================

DO $$
DECLARE
  v_email     text        := 'wlagbema@gmail.com';
  v_mois_max  int         := 0;          -- 0 = jusqu'au mois courant
  v_user_id   uuid;
  v_wallet_id uuid;
  v_admin_id  uuid;
  v_join      timestamptz;
  v_month     timestamptz;
  v_n         int;
  v_i         int;
  v_day       int;
  v_date      timestamptz;
  v_amount    numeric;
  v_method    text;
  v_phone     text;
  v_wd_id     uuid;
  v_desc      text;
  v_total_e   numeric := 0;
  v_total_w   numeric := 0;
  v_nb_wd     int := 0;
  v_nb_rw     int := 0;
BEGIN
  -- Historique reproductible : la même graine donne toujours le même résultat
  PERFORM setseed(0.4242);

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Compte introuvable : %', v_email;
  END IF;
  SELECT id INTO v_admin_id FROM auth.users WHERE email = v_email;

  -- Sécurité : profil + wallet
  INSERT INTO public.profiles (user_id, full_name, username, role, referral_code, is_active, is_banned)
  SELECT v_user_id, 'Wlagbema', NULL, 'user',
         UPPER(SUBSTRING(MD5(v_user_id::TEXT || 'rewardly') FROM 1 FOR 8)), true, false
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_user_id);

  INSERT INTO public.wallets (user_id, balance, invested_capital, total_earnings, locked_amount)
  SELECT v_user_id, 0, 0, 0, 0
  WHERE NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.user_id = v_user_id);

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_user_id;
  SELECT created_at INTO v_join FROM public.profiles WHERE user_id = v_user_id;

  -- ------------------------------------------------------------
  -- 0. Nettoyage des données de démonstration précédentes (les nôtres uniquement)
  -- ------------------------------------------------------------
  DELETE FROM public.withdrawals w
  WHERE w.user_id = v_user_id
    AND EXISTS (
      SELECT 1 FROM public.wallet_transactions t
      WHERE t.user_id = v_user_id
        AND t.reference = 'DEMO-WD-' || w.id::TEXT
    );

  DELETE FROM public.wallet_transactions
  WHERE user_id = v_user_id
    AND reference LIKE 'DEMO-%';

  -- ------------------------------------------------------------
  -- 1. RETRAITS : 2 à 3 par mois, dates et montants irréguliers
  -- ------------------------------------------------------------
  FOR v_month IN
    SELECT generate_series(
             date_trunc('month', v_join) + INTERVAL '1 month',
             date_trunc('month', now()) - (v_mois_max * INTERVAL '1 month'),
             INTERVAL '1 month')
  LOOP
    v_n := 2 + floor(random() * 2)::int;          -- 2 ou 3 retraits ce mois-ci

    FOR v_i IN 1..v_n LOOP
      v_day  := 2 + floor(random() * 26)::int;    -- jour irrégulier (2 → 28)
      v_date := date_trunc('month', v_month)
                + make_interval(days  => v_day - 1,
                                hours => 8 + floor(random() * 12)::int,
                                mins  => floor(random() * 60)::int);

      CONTINUE WHEN v_date > now();                -- jamais dans le futur

      v_amount := 5000 + floor(random() * 17)::int * 500;   -- 5 000 → 13 000
      v_method := CASE WHEN random() < 0.6 THEN 'TOGOCOM TG' ELSE 'MOOV TG' END;

      -- numéro togolais réaliste (indicatif 228 + 8 chiffres : 90/91/79/70…)
      v_phone := '228'
                 || (ARRAY['90','91','92','93','98','99','70','71','79'])[1 + floor(random() * 9)::int]
                 || lpad(floor(random() * 1000000)::TEXT, 6, '0');

      -- La demande de retrait, payée
      INSERT INTO public.withdrawals
        (user_id, amount, method, account_info, status, admin_comment,
         reviewed_by, created_at, updated_at)
      VALUES
        (v_user_id, v_amount, v_method, v_phone, 'paid',
         CASE WHEN random() < 0.5 THEN 'Paiement Mobile Money effectué' ELSE NULL END,
         v_admin_id, v_date, v_date + INTERVAL '3 hours')
      RETURNING id INTO v_wd_id;

      -- La transaction correspondante (négative, comme le fait l'application)
      INSERT INTO public.wallet_transactions
        (user_id, wallet_id, amount, type, description, reference, status, created_at)
      VALUES
        (v_user_id, v_wallet_id, -v_amount, 'withdrawal',
         'Retrait via ' || v_method,
         'DEMO-WD-' || v_wd_id::TEXT, 'completed', v_date + INTERVAL '3 hours');

      v_nb_wd := v_nb_wd + 1;
    END LOOP;

    -- ----------------------------------------------------------
    -- 2. GAINS : 18 à 26 tâches rémunérées ce mois-ci
    --    (doivent rester SUPÉRIEURS aux retraits : on ne retire que ses gains)
    -- ----------------------------------------------------------
    v_n := 18 + floor(random() * 9)::int;

    FOR v_i IN 1..v_n LOOP
      v_day  := 1 + floor(random() * 28)::int;
      v_date := date_trunc('month', v_month)
                + make_interval(days  => v_day - 1,
                                hours => 7 + floor(random() * 14)::int,
                                mins  => floor(random() * 60)::int);

      CONTINUE WHEN v_date > now();

      v_amount := 800 + floor(random() * 18)::int * 100;    -- 800 → 2 500 FCFA

      v_desc := (ARRAY[
        'Visite de site rémunérée',
        'Sondage rapide',
        'Test d''application',
        'Partage réseaux sociaux',
        'Abonnement Telegram',
        'Regarder une vidéo',
        'Questionnaire client',
        'Installation d''application',
        'Mission quotidienne'
      ])[1 + floor(random() * 9)::int];

      INSERT INTO public.wallet_transactions
        (user_id, wallet_id, amount, type, description, reference, status, created_at)
      VALUES
        (v_user_id, v_wallet_id, v_amount, 'reward', v_desc,
         'DEMO-TK-' || v_nb_rw::TEXT, 'completed', v_date);

      -- Statistiques journalières (uniquement si le jour n'existe pas déjà)
      INSERT INTO public.daily_statistics (user_id, date, tasks_completed, earnings)
      VALUES (v_user_id, v_date::date, 1, v_amount)
      ON CONFLICT (user_id, date) DO NOTHING;

      v_nb_rw := v_nb_rw + 1;
    END LOOP;
  END LOOP;   -- fin de la boucle mensuelle

  -- ------------------------------------------------------------
  -- 3. Recalcul du portefeuille → chiffres cohérents dans l'app
  --    solde = dépôts + gains − investi − retiré
  -- ------------------------------------------------------------
  SELECT COALESCE(SUM(amount), 0) INTO v_total_e
  FROM public.wallet_transactions
  WHERE user_id = v_user_id
    AND type IN ('reward', 'referral', 'bonus')
    AND status = 'completed';

  SELECT COALESCE(ABS(SUM(amount)), 0) INTO v_total_w
  FROM public.wallet_transactions
  WHERE user_id = v_user_id
    AND type = 'withdrawal'
    AND status = 'completed';

  UPDATE public.wallets
  SET total_earnings   = v_total_e,
      invested_capital = COALESCE((SELECT SUM(i.amount) FROM public.investments i
                                    WHERE i.user_id = v_user_id AND i.status = 'active'), 0),
      balance          = GREATEST(0,
                           COALESCE((SELECT SUM(d.amount) FROM public.deposits d
                                      WHERE d.user_id = v_user_id AND d.status = 'approved'), 0)
                           + v_total_e
                           - COALESCE((SELECT SUM(i.amount) FROM public.investments i
                                        WHERE i.user_id = v_user_id AND i.status = 'active'), 0)
                           - v_total_w),
      updated_at       = NOW()
  WHERE user_id = v_user_id;

  RAISE NOTICE '✅ Historique généré : % retraits (% FCFA) et % gains (% FCFA) pour %',
               v_nb_wd, v_total_w, v_nb_rw, v_total_e, v_email;
END $$;

-- ============================================================
-- CONTRÔLES (à lire dans le SQL Editor)
-- ============================================================

-- 1) Volume total des retraits payés
SELECT 'Retraits payés' AS info,
       COUNT(*)         AS nombre,
       SUM(w.amount)    AS total_fcfa,
       MIN(w.created_at)::date AS premier,
       MAX(w.created_at)::date AS dernier
FROM public.withdrawals w
JOIN auth.users u ON u.id = w.user_id
WHERE u.email = 'wlagbema@gmail.com' AND w.status = 'paid';

-- 2) Rythme mensuel (2-3 retraits/mois attendus)
SELECT to_char(date_trunc('month', w.created_at), 'YYYY-MM') AS mois,
       COUNT(*) AS retraits,
       SUM(w.amount) AS total_fcfa
FROM public.withdrawals w
JOIN auth.users u ON u.id = w.user_id
WHERE u.email = 'wlagbema@gmail.com'
GROUP BY 1
ORDER BY 1 DESC
LIMIT 14;

-- 3) Portefeuille (solde / gains / retirable)
SELECT wl.balance           AS solde,
       wl.total_earnings     AS gains_cumules,
       wl.invested_capital   AS investi,
       GREATEST(0,
         wl.total_earnings
         - COALESCE((SELECT SUM(ABS(t.amount)) FROM public.wallet_transactions t
                      WHERE t.user_id = wl.user_id AND t.type = 'withdrawal' AND t.status = 'completed'), 0)
       )                     AS retirable
FROM public.wallets wl
JOIN auth.users u ON u.id = wl.user_id
WHERE u.email = 'wlagbema@gmail.com';

-- 4) Les 10 dernières lignes visibles dans « Transactions récentes »
SELECT t.created_at::date AS date, t.type, t.amount, t.description, t.status
FROM public.wallet_transactions t
JOIN auth.users u ON u.id = t.user_id
WHERE u.email = 'wlagbema@gmail.com'
ORDER BY t.created_at DESC
LIMIT 10;

-- 5) Cohérence : part des gains déjà retirée (doit rester nettement < 100 %)
SELECT g.gains_cumules,
       r.total_retire,
       ROUND(100.0 * r.total_retire / NULLIF(g.gains_cumules, 0), 1) AS pourcentage_retire,
       g.gains_cumules - r.total_retire                             AS reste_disponible
FROM (
  SELECT COALESCE(SUM(amount), 0) AS gains_cumules
  FROM public.wallet_transactions t
  JOIN auth.users u ON u.id = t.user_id
  WHERE u.email = 'wlagbema@gmail.com'
    AND t.type IN ('reward', 'referral', 'bonus') AND t.status = 'completed'
) g,
(
  SELECT COALESCE(ABS(SUM(amount)), 0) AS total_retire
  FROM public.wallet_transactions t
  JOIN auth.users u ON u.id = t.user_id
  WHERE u.email = 'wlagbema@gmail.com'
    AND t.type = 'withdrawal' AND t.status = 'completed'
) r;

