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

  // 2. Transition invalide : un retrait déjà payé/refusé ne peut plus changer
  if (withdrawal.status === "paid" || withdrawal.status === "rejected") {
    return { success: false, error: `Ce retrait est déjà ${withdrawal.status === "paid" ? "payé" : "refusé"}` };
  }

  // 3. Passage à "paid" → initier d'ABORD le payout FeeXPay, puis valider via RPC.
  //    Ordre sûr : le payout est lancé UNE seule fois et la RPC ne change le statut
  //    que si la transition est autorisée (pending/approved → paid).
  if (status === "paid") {
    try {
      const { initiatePayout } = await import("@/lib/feexpay");
      const accountInfo = withdrawal.account_info || "";
      const network = withdrawal.method || "MTN";
      const fullPhone = accountInfo.replace(/\D/g, "");

      await initiatePayout({
        network,
        phoneNumber: fullPhone,
        amount: withdrawal.amount,
        motif: "Retrait Rewardly",
        callbackInfo: `withdrawal_${withdrawal.id}`,
      });

      // Payout lancé → valider la transition (crédite locked_amount, clôture la txn)
      const { data, error } = await supabase.rpc("validate_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_admin_id: admin.id,
        p_status: "paid",
        p_comment: comment || null,
      });

      if (error) {
        console.error("validate_withdrawal (paid) error:", error.message);
        return { success: false, error: `Le paiement FeeXPay est parti mais la validation a échoué : ${error.message}` };
      }

      // Mettre à jour la référence FeeXPay
      await supabase
        .from("withdrawals")
        .update({ feexpay_reference: withdrawal.id, updated_at: new Date().toISOString() })
        .eq("id", withdrawalId);

      revalidatePath("/admin/withdrawals");
      return data;
    } catch (e: any) {
      console.error("Payout error:", e);
      // Si le payout échoue (solde insuffisant, etc.) → approuver le retrait
      // (pas "paid") pour que l'admin puisse réessayer sans risquer un double paiement.
      const { data: approvedData, error: approvedError } = await supabase.rpc("validate_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_admin_id: admin.id,
        p_status: "approved",
        p_comment: comment || "Payout FeeXPay échoué - à payer manuellement",
      });

      if (approvedError) {
        console.error("validate_withdrawal (approved fallback) error:", approvedError.message);
        return { success: false, error: "Le retrait n'a ni pu être payé ni approuvé. Contactez le support." };
      }

      revalidatePath("/admin/withdrawals");
      return {
        success: true,
        approved: true,
        message: `Paiement FeeXPay échoué : ${e.message || "Erreur inconnue"}. Le retrait a été approuvé - veuillez payer l'utilisateur manuellement.`,
      };
    }
  }

  // 4. Rejet : valider d'ABORD la transition via la RPC (elle refuse
  //    approved→rejected et marque la transaction de débit comme `failed`),
  //    puis SEULEMENT rembourser la balance si la transition a réussi.
  if (status === "rejected") {
    const { data: rpcData, error: rpcError } = await supabase.rpc("validate_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_admin_id: admin.id,
      p_status: "rejected",
      p_comment: comment || null,
    });

    if (rpcError) {
      console.error("validate_withdrawal (rejected) error:", rpcError.message);
      return { success: false, error: rpcError.message };
    }

    // La RPC a réussi → rembourser la balance (le montant avait été débité à la demande)
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (wallet) {
      await supabase
        .from("wallets")
        .update({
          balance: (wallet.balance || 0) + withdrawal.amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", withdrawal.user_id);

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

    revalidatePath("/admin/withdrawals");
    return rpcData;
  }

  // 5. Autres statuts (ex: "approved" direct) → simple RPC
  const { data } = await supabase.rpc("validate_withdrawal", {
    p_withdrawal_id: withdrawalId,
    p_admin_id: admin.id,
    p_status: status,
    p_comment: comment || null,
  });

  revalidatePath("/admin/withdrawals");
  return data;
}
