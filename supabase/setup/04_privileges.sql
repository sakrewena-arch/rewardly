-- ======================================================================
-- REWARDLY — PRIVILÈGES — GRANT/REVOKE + durcissement   (étape 4/4)
-- GÉNÉRÉ par scripts/build-supabase-setup.mjs — NE PAS ÉDITER À LA MAIN.
-- Modifier supabase/migrations/, puis régénérer.
-- Les RPC d'administration ne sont plus accessibles aux clients anonymes.
-- ======================================================================

-- [supabase/legacy/consolidated_schema.sql:1891]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;

-- [supabase/legacy/consolidated_schema.sql:1892]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM anon;

-- [supabase/legacy/consolidated_schema.sql:1893]
REVOKE ALL ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM authenticated;

-- [supabase/legacy/consolidated_schema.sql:1894]
GRANT EXECUTE ON FUNCTION request_withdrawal_feeexpay(UUID, DECIMAL, TEXT, TEXT, TEXT) TO service_role;

-- [supabase/legacy/consolidated_schema.sql:1956]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM PUBLIC;

-- [supabase/legacy/consolidated_schema.sql:1957]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM anon;

-- [supabase/legacy/consolidated_schema.sql:1958]
REVOKE ALL ON FUNCTION credit_feeexpay_deposit(TEXT) FROM authenticated;

-- [supabase/legacy/consolidated_schema.sql:1959]
GRANT EXECUTE ON FUNCTION credit_feeexpay_deposit(TEXT) TO service_role;

-- [supabase/legacy/consolidated_schema.sql:2572]
-- ============================================================
-- 8. PRIVILÈGES D'EXÉCUTION des fonctions corrigées
-- ============================================================
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/legacy/consolidated_schema.sql:2578]
GRANT EXECUTE ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) TO authenticated;

-- [supabase/legacy/consolidated_schema.sql:2579]
GRANT EXECUTE ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;

-- [supabase/legacy/consolidated_schema.sql:2580]
GRANT EXECUTE ON FUNCTION get_withdrawable_amount(UUID) TO authenticated;

-- [supabase/legacy/consolidated_schema.sql:2580]
-- 🔒 Défense en profondeur : réserver les RPC financières user-facing au rôle
--    authenticated (l'anon ne doit PAS pouvoir les appeler).
REVOKE ALL ON FUNCTION activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;

-- [supabase/legacy/consolidated_schema.sql:2584]
REVOKE ALL ON FUNCTION submit_withdrawal(UUID, DECIMAL, TEXT, TEXT) FROM PUBLIC;

-- [supabase/legacy/consolidated_schema.sql:2585]
REVOKE ALL ON FUNCTION submit_deposit(UUID, DECIMAL, TEXT, TEXT, TEXT) FROM PUBLIC;

-- [supabase/legacy/consolidated_schema.sql:2586]
REVOKE ALL ON FUNCTION get_withdrawable_amount(UUID) FROM PUBLIC;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:214]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM PUBLIC;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:215]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM anon;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:216]
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) FROM authenticated;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:217]
GRANT EXECUTE ON FUNCTION public.request_withdrawal_feeexpay(uuid, numeric, text, text, text) TO service_role;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:290]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM PUBLIC;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:291]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM anon;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:292]
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM authenticated;

-- [supabase/migrations/00015_referral_atomic_wallet.sql:293]
GRANT EXECUTE ON FUNCTION public.credit_feeexpay_deposit(text) TO service_role;

-- [supabase/migrations/00019_task_reward_notifications.sql:1]
-- Privilèges
GRANT EXECUTE ON FUNCTION submit_task(UUID, UUID, JSONB) TO authenticated;

-- [supabase/migrations/00019_task_reward_notifications.sql:247]
GRANT EXECUTE ON FUNCTION approve_submission(UUID, UUID, TEXT) TO authenticated;

-- [supabase/migrations/00021_fix_upgrade_and_referrals.sql:118]
GRANT EXECUTE ON FUNCTION activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/migrations/00022_referral_investment_commission.sql:115]
-- ============================================================
-- 4. PRIVILÈGES
-- ============================================================
-- activate_plan reste appelable par l'utilisateur connecté (il débite SON
-- propre wallet, contrôlé par auth.uid()).
GRANT EXECUTE ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) TO authenticated;

-- [supabase/migrations/00022_referral_investment_commission.sql:361]
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM PUBLIC;

-- [supabase/migrations/00022_referral_investment_commission.sql:362]
REVOKE ALL ON FUNCTION public.activate_plan(UUID, UUID, DECIMAL) FROM anon;

-- [supabase/migrations/00022_referral_investment_commission.sql:362]
-- 🔒 credit_referral_commission ne doit JAMAIS être appelable depuis un
-- client (sinon un utilisateur pourrait se créditer une commission) :
-- réservée aux fonctions serveur (SECURITY DEFINER) et au service_role.
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM PUBLIC;

-- [supabase/migrations/00022_referral_investment_commission.sql:368]
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM anon;

-- [supabase/migrations/00022_referral_investment_commission.sql:369]
REVOKE ALL ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) FROM authenticated;

-- [supabase/migrations/00022_referral_investment_commission.sql:370]
GRANT EXECUTE ON FUNCTION public.credit_referral_commission(UUID, NUMERIC, UUID) TO service_role;

-- ======================================================
-- DURCISSEMENT (généré) : accès ANONYME interdit
-- ======================================================
REVOKE ALL ON FUNCTION public.add_reward(uuid, decimal, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_reward(uuid, decimal, text) FROM anon;
REVOKE ALL ON FUNCTION public.approve_submission(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_submission(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.reject_submission(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_submission(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_deposit(uuid, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_deposit(uuid, uuid, boolean, text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_withdrawal(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_withdrawal(uuid, uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ban_user(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ban_user(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.delete_user(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_task(uuid, text, text, decimal, uuid, uuid, text, integer, text, text, integer, integer, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_task(uuid, text, text, decimal, uuid, uuid, text, integer, text, text, integer, integer, timestamptz, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.update_task(uuid, uuid, text, text, decimal, uuid, text, integer, text, text, integer, integer, timestamptz, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_task(uuid, uuid, text, text, decimal, uuid, text, integer, text, text, integer, integer, timestamptz, text, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.delete_task(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_task(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.create_plan(uuid, text, text, decimal, integer, decimal, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_plan(uuid, text, text, decimal, integer, decimal, decimal, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.update_plan(uuid, uuid, text, decimal, integer, decimal, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_plan(uuid, uuid, text, decimal, integer, decimal, decimal, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.toggle_plan_status(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.toggle_plan_status(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_users_with_details(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_users_with_details(text) FROM anon;
REVOKE ALL ON FUNCTION public.credit_referral_commission(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_referral_commission(uuid, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_feeexpay_deposit(text) FROM anon;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, decimal, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_withdrawal_feeexpay(uuid, decimal, text, text, text) FROM anon;
