-- LOT 1 — fonctions : handle_updated_at, upsert_user_preferences, create_service_order, update_push_tokens_updated_at, generate_unique_referral_code
-- Exécutez les lots dans l'ordre. Le PREMIER lot qui affiche une erreur contient la fonction fautive.

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.upsert_user_preferences(
  p_language TEXT,
  p_currency TEXT,
  p_push_notifications BOOLEAN,
  p_email_notifications BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id, language, currency, push_notifications, email_notifications)
  VALUES (auth.uid(), p_language, p_currency, p_push_notifications, p_email_notifications)
  ON CONFLICT (user_id)
  DO UPDATE SET
    language = EXCLUDED.language,
    currency = EXCLUDED.currency,
    push_notifications = EXCLUDED.push_notifications,
    email_notifications = EXCLUDED.email_notifications,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_service_order(
  p_company_name TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_service_type TEXT,
  p_description TEXT,
  p_pack TEXT,
  p_pack_amount NUMERIC,
  p_duration TEXT,
  p_target_users INTEGER,
  p_url TEXT DEFAULT NULL,
  p_download_url TEXT DEFAULT NULL,
  p_questions TEXT DEFAULT NULL,
  p_ia_url TEXT DEFAULT NULL,
  p_app_name TEXT DEFAULT NULL,
  p_game_name TEXT DEFAULT NULL,
  p_site_name TEXT DEFAULT NULL,
  p_instructions TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet_id UUID;
  v_balance NUMERIC;
  v_order_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Wallet introuvable');
  END IF;

  IF v_balance < p_pack_amount THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant. Rechargez votre wallet.');
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_pack_amount,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (user_id, wallet_id, amount, type, description, status)
  VALUES (v_user_id, v_wallet_id, -p_pack_amount, 'service', 'Paiement pack ' || p_pack || ' - ' || p_service_type, 'completed');

  INSERT INTO public.service_orders (
    user_id, company_name, contact_email, contact_phone,
    service_type, description, pack, pack_amount, duration, target_users,
    url, download_url, questions, ia_url, app_name, game_name, site_name, instructions,
    status, payment_status
  ) VALUES (
    v_user_id, p_company_name, p_contact_email, p_contact_phone,
    p_service_type, p_description, p_pack, p_pack_amount, p_duration, p_target_users,
    p_url, p_download_url, p_questions, p_ia_url, p_app_name, p_game_name, p_site_name, p_instructions,
    'pending', 'paid'
  )
  RETURNING id INTO v_order_id;

  RETURN json_build_object('success', true, 'order_id', v_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := UPPER(SUBSTRING(MD5(gen_random_uuid()::text || clock_timestamp()::text) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;
