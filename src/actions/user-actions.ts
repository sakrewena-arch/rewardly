"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// User actions require authentication for financial operations

async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ============ TASK SUBMISSION ============

export async function submitTaskAction(taskId: string, answers: Record<string, string>) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("submit_task", {
    p_user_id: user.id,
    p_task_id: taskId,
    p_answers: JSON.parse(JSON.stringify(answers)),
  });

  if (error) {
    console.error("submit_task RPC error:", error.message);
    return { success: false, error: `Erreur serveur: ${error.message}` };
  }

  revalidatePath("/tasks");
  return data;
}

// ============ DEPOSIT ============

export async function submitDepositAction(input: {
  amount: number;
  method: string;
  reference?: string;
  proofUrl?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("submit_deposit", {
    p_user_id: user.id,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference || null,
    p_proof_url: input.proofUrl || null,
  });

  if (error) {
    console.error("submit_deposit RPC error:", error.message);
    return { success: false, error: `Erreur serveur: ${error.message}` };
  }

  revalidatePath("/deposit");
  return data;
}

// ============ WITHDRAWAL ============

export async function submitWithdrawalAction(input: {
  amount: number;
  method: string;
  accountInfo: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("submit_withdrawal", {
    p_user_id: user.id,
    p_amount: input.amount,
    p_method: input.method,
    p_account_info: input.accountInfo,
  });

  if (error) {
    console.error("submit_withdrawal RPC error:", error.message);
    return { success: false, error: `Erreur serveur: ${error.message}` };
  }

  revalidatePath("/withdraw");
  return data;
}

// ============ ACTIVATE PLAN ============

export async function activatePlanAction(planId: string, amount: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("activate_plan", {
    p_user_id: user.id,
    p_plan_id: planId,
    p_amount: amount,
  });

  if (error) {
    console.error("activate_plan RPC error:", error.message);
    return { success: false, error: `Erreur serveur: ${error.message}` };
  }

  revalidatePath("/invest");
  revalidatePath("/dashboard");
  return data;
}

// ============ NOTIFICATIONS ============

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}

export async function markNotificationRead(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) return;
  const supabase = await createClient();
  if (!supabase) return;
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id);
}

// ============ REFERRAL CODE (apply after registration) ============

export async function applyReferralCodeAction(code: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode) return { success: false, error: "Veuillez entrer un code de parrainage" };

  // 1. Vérifier si l'utilisateur a déjà un parrain
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_id", user.id)
    .maybeSingle();
  if (existing) return { success: false, error: "Vous avez déjà un parrain" };

  // 2. Trouver le parrain par son code (service role)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return { success: false, error: "Configuration Supabase manquante" };

  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

  const { data: referrer } = await adminClient
    .from("profiles")
    .select("user_id, referral_code")
    .eq("referral_code", trimmedCode)
    .maybeSingle();

  if (!referrer) return { success: false, error: "Code de parrainage invalide" };
  if (referrer.user_id === user.id) return { success: false, error: "Vous ne pouvez pas vous parrainer vous-même" };

  // 3. Lire la commission fixe depuis system_settings
  const { data: settings } = await adminClient
    .from("system_settings")
    .select("value")
    .eq("key", "referral_commission_fixed")
    .maybeSingle();
  const commission = Number(settings?.value || 500);

  // 4. Créer la relation de parrainage
  const { error: refError } = await adminClient.from("referrals").insert({
    referrer_id: referrer.user_id,
    referred_id: user.id,
    commission,
    status: "paid",
  });
  if (refError) return { success: false, error: refError.message };

  // 5. Créditer la commission au parrain (wallet + transaction)
  const { data: wallet } = await adminClient
    .from("wallets")
    .select("*")
    .eq("user_id", referrer.user_id)
    .maybeSingle();
  if (wallet) {
    await adminClient
      .from("wallets")
      .update({
        balance: (wallet.balance || 0) + commission,
        total_earnings: (wallet.total_earnings || 0) + commission,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", referrer.user_id);
    await adminClient.from("wallet_transactions").insert({
      user_id: referrer.user_id,
      wallet_id: wallet.id,
      amount: commission,
      type: "reward",
      description: `Commission de parrainage (${trimmedCode})`,
      status: "completed",
    });
  }

  revalidatePath("/profile");
  revalidatePath("/referral");
  return { success: true, commission };
}
