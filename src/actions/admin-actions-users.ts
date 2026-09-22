"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


// ============ USERS ============

export async function getUsers() {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return [];

  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];

  // 1. Récupérer les profils
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (profilesError) {
    console.error("getUsers profiles error:", profilesError);
    return [];
  }

  // 2. Récupérer les wallets
  const { data: wallets, error: walletsError } = await supabase
    .from("wallets")
    .select("*");
  if (walletsError) {
    console.error("getUsers wallets error:", walletsError);
    return [];
  }

  // 3. Récupérer les retraits (compteurs)
  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from("withdrawals")
    .select("user_id, amount, status");
  if (withdrawalsError) {
    console.error("getUsers withdrawals error:", withdrawalsError);
    return [];
  }

  // 4. Récupérer les soumissions validées (compteur de tâches)
  const { data: submissions, error: submissionsError } = await supabase
    .from("task_submissions")
    .select("user_id, status");
  if (submissionsError) {
    console.error("getUsers submissions error:", submissionsError);
    return [];
  }

  // 5. Fusionner côté JavaScript
  const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w]));

  const withdrawalCounts = new Map<string, { count: number; total: number }>();
  (withdrawals || []).forEach((w: any) => {
    if (w.status === "approved" || w.status === "completed") {
      const current = withdrawalCounts.get(w.user_id) || { count: 0, total: 0 };
      current.count += 1;
      current.total += w.amount || 0;
      withdrawalCounts.set(w.user_id, current);
    }
  });

  const taskCounts = new Map<string, number>();
  (submissions || []).forEach((s: any) => {
    if (s.status === "approved") {
      taskCounts.set(s.user_id, (taskCounts.get(s.user_id) || 0) + 1);
    }
  });

  return (profiles || []).map((p: any) => {
    const wallet = walletMap.get(p.user_id);
    const withdrawals = withdrawalCounts.get(p.user_id) || { count: 0, total: 0 };

    return {
      user_id: p.user_id,
      email: p.email || "",
      full_name: p.full_name || null,
      username: p.username || null,
      phone: p.phone || null,
      role: p.role || "user",
      is_active: p.is_active ?? true,
      is_banned: p.is_banned ?? false,
      created_at: p.created_at,
      profile_id: p.id,
      balance: wallet?.balance || 0,
      total_earnings: wallet?.total_earnings || 0,
      withdrawal_count: withdrawals.count,
      total_withdrawals: withdrawals.total,
      tasks_completed: taskCounts.get(p.user_id) || 0,
    };
  });
}

export async function banUserAction(userId: string, ban: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("ban_user", {
    p_user_id: userId,
    p_admin_id: admin.id,
    p_ban: ban,
  });
  revalidatePath("/admin/users");
  return data;
}

export async function deleteUserAction(userId: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("delete_user", {
    p_user_id: userId,
    p_admin_id: admin.id,
  });
  revalidatePath("/admin/users");
  return data;
}
