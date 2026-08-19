"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


// ============ DEPOSITS ============

export async function getDeposits() {
  const admin = await requireAdmin();
  if (!admin) return [];
  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];

  // 1. Récupérer les dépôts SANS jointure (deposits.user_id → auth.users, pas profiles)
  const { data: deposits, error } = await supabase
    .from("deposits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("getDeposits error:", error);
    return [];
  }

  // 2. Récupérer les profils séparément
  const userIds = (deposits || []).map((d: any) => d.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, username")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    return (deposits || []).map((d: any) => ({
      ...d,
      profiles: profileMap.get(d.user_id) || { full_name: null, username: null },
    }));
  }

  return deposits || [];
}

export async function validateDepositAction(depositId: string, approve: boolean, comment?: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("validate_deposit", {
    p_deposit_id: depositId,
    p_admin_id: admin.id,
    p_approve: approve,
    p_comment: comment || null,
  });
  revalidatePath("/admin/deposits");
  return data;
}

// ============ WITHDRAWALS ============

export async function getWithdrawals() {
  const admin = await requireAdmin();
  if (!admin) return [];
  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];

  // 1. Récupérer les retraits SANS jointure (withdrawals.user_id → auth.users, pas profiles)
  const { data: withdrawals, error } = await supabase
    .from("withdrawals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("getWithdrawals error:", error);
    return [];
  }

  // 2. Récupérer les profils séparément
  const userIds = (withdrawals || []).map((w: any) => w.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, username")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    return (withdrawals || []).map((w: any) => ({
      ...w,
      profiles: profileMap.get(w.user_id) || { full_name: null, username: null },
    }));
  }

  return withdrawals || [];
}

export async function validateWithdrawalAction(withdrawalId: string, status: string, comment?: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  // 1. Récupérer le retrait en base
  const { data: withdrawal } = await supabase
    .from("withdrawals")
    .select("*")
    .eq("id", withdrawalId)
    .single();

  if (!withdrawal) {
    return { success: false, error: "Retrait introuvable" };
  }

  // 2. Si passage à "paid" → déclencher le payout FeeXPay
  if (status === "paid") {
    try {
      // Initier le payout FeeXPay
      const { initiatePayout } = await import("@/lib/feexpay");
      const accountInfo = withdrawal.account_info || "";
      // Extraire le réseau et le téléphone
      const network = withdrawal.method || "MTN";
      const fullPhone = accountInfo.replace(/\D/g, "");

      await initiatePayout({
        network,
        phoneNumber: fullPhone,
        amount: withdrawal.amount,
        motif: "Retrait Rewardly",
        callbackInfo: `withdrawal_${withdrawal.id}`,
      });

      // Mettre à jour la référence FeeXPay
      await supabase
        .from("withdrawals")
        .update({ feexpay_reference: withdrawal.id, updated_at: new Date().toISOString() })
        .eq("id", withdrawalId);
    } catch (e: any) {
      console.error("Payout error:", e);
      // Si le payout échoue (solde insuffisant, etc.) → approuver le retrait
      // et informer l'admin qu'il doit payer manuellement
      const { data: approvedData } = await supabase.rpc("validate_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_admin_id: admin.id,
        p_status: "approved",
        p_comment: comment || "Payout FeeXPay échoué - à payer manuellement",
      });
      revalidatePath("/admin/withdrawals");
      return {
        success: false,
        error: `Paiement FeeXPay échoué : ${e.message || "Erreur inconnue"}. Le retrait a été approuvé - veuillez payer l'utilisateur manuellement.`,
        approved: true,
      };
    }
  }

  // 3. Si rejet → rembourser la BALANCE TOTALE (pas seulement le retirable)
  if (status === "rejected") {
    // Récupérer le wallet de l'utilisateur
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (wallet) {
      // Rembourser le montant sur la balance totale
      await supabase
        .from("wallets")
        .update({
          balance: (wallet.balance || 0) + withdrawal.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", withdrawal.user_id);

      // Créer la transaction de remboursement
      await supabase
        .from("wallet_transactions")
        .insert({
          user_id: withdrawal.user_id,
          wallet_id: wallet.id,
          amount: withdrawal.amount,
          type: "admin_adjustment",
          description: "Remboursement retrait rejeté",
          status: "completed",
        });
    }
  }

  // 4. Mettre à jour le statut en base via la RPC
  const { data } = await supabase.rpc("validate_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_admin_id: admin.id,
    p_status: status,
    p_comment: comment || null,
  });

  revalidatePath("/admin/withdrawals");
  return data;
}
