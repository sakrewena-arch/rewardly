"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


// ============ USERS ============

export async function getUsers(planSlug?: string) {
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

  // 3. Récupérer les investissements actifs
  const { data: investments, error: investmentsError } = await supabase
    .from("investments")
    .select("*, plans(name, slug)")
    .eq("status", "active");
  if (investmentsError) {
    console.error("getUsers investments error:", investmentsError);
    return [];
  }

  // 4. Récupérer les compteurs (dépôts, retraits, tâches)
  const { data: deposits, error: depositsError } = await supabase
    .from("deposits")
    .select("user_id, amount, status");
  const { data: withdrawals, error: withdrawalsError } = await supabase
    .from("withdrawals")
    .select("user_id, amount, status");
  const { data: submissions, error: submissionsError } = await supabase
    .from("task_submissions")
    .select("user_id, status");

  // 5. Fusionner côté JavaScript
  const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, w]));
  const investmentMap = new Map((investments || []).map((i: any) => [i.user_id, i]));

  const depositCounts = new Map<string, { count: number; total: number }>();
  (deposits || []).forEach((d: any) => {
    if (d.status === "approved") {
      const current = depositCounts.get(d.user_id) || { count: 0, total: 0 };
      current.count += 1;
      current.total += d.amount || 0;
      depositCounts.set(d.user_id, current);
    }
  });

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

  const users = (profiles || []).map((p: any) => {
    const wallet = walletMap.get(p.user_id);
    const investment = investmentMap.get(p.user_id);
    const deposits = depositCounts.get(p.user_id) || { count: 0, total: 0 };
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
      invested_capital: wallet?.invested_capital || 0,
      locked_amount: wallet?.locked_amount || 0,
      plan: investment?.plans ? {
        id: investment.plan_id,
        name: investment.plans.name,
        slug: investment.plans.slug,
        amount: investment.amount || 0,
        start_date: investment.start_date || "",
        end_date: investment.end_date || "",
      } : null,
      deposit_count: deposits.count,
      total_deposits: deposits.total,
      withdrawal_count: withdrawals.count,
      total_withdrawals: withdrawals.total,
      tasks_completed: taskCounts.get(p.user_id) || 0,
    };
  });

  // Filtrer par plan si demandé
  if (planSlug) {
    return users.filter((u: any) => u.plan?.slug === planSlug);
  }

  return users;
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
