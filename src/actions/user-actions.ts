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
    // Cas "ancienne base" : la RPC submit_task n'a pas encore été remplacée
    // par la migration 00022 (message d'erreur lié aux packs supprimés).
    const m = (error.message || "").toLowerCase();
    if (m.includes("pack") || m.includes("invest") || m.includes("actif")) {
      return {
        success: false,
        error: "La plateforme est désormais gratuite. L'ancienne règle « pack » est encore active en base : exécutez la migration 00022 (voir la console Supabase) pour activer la tâche quotidienne gratuite.",
      };
    }
    return { success: false, error: `Erreur serveur: ${error.message}` };
  }

  revalidatePath("/tasks");

  // Le RPC a répondu avec un JSONB { success:false, error: ... } : on traduit
  // le cas "ancienne base" (règle pack encore active en base) en message clair.
  if (data && typeof data === "object" && (data as any)?.success === false) {
    const msg = String((data as any)?.error || "").toLowerCase();
    if (msg.includes("pack") || msg.includes("actif") || msg.includes("invest")) {
      return {
        success: false,
        error: "La plateforme est désormais gratuite. L'ancienne règle « pack » est encore active en base : exécutez la migration 00022 (SQL Editor de Supabase) pour activer la tâche quotidienne gratuite.",
      };
    }
  }

  return data;
}

// ============ (LE DÉPÔT A ÉTÉ SUPPRIMÉ — plateforme 100% gratuite) ============

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

// ============ (LES PACKS / INVESTISSEMENTS ONT ÉTÉ SUPPRIMÉS — gratuits) ============

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

  // 3. Créer la relation de parrainage UNIQUEMENT
  //    (le parrain n'est PAS crédité : il gagne 10% des gains du filleul,
  //     crédit automatique via la fonction SQL credit_referral_commission).
  const { error: refError } = await adminClient.from("referrals").insert({
    referrer_id: referrer.user_id,
    referred_id: user.id,
    commission: 0,
    status: "paid",
  });
  if (refError) return { success: false, error: refError.message };

  revalidatePath("/profile");
  revalidatePath("/referral");
  return { success: true };
}
