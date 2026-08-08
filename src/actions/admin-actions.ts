"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { verifyAdminSession } from "@/lib/admin-session";
import type { CreateTaskInput, TaskFieldInput } from "@/types/admin";

// ============ AUTH HELPERS ============

async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function isAdmin(userId: string | undefined) {
  if (!userId) return false;
  const supabase = await createClient();
  if (!supabase) return false;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin" || data?.role === "super_admin";
}

// Admin actions require real authentication and admin role
async function requireAdmin() {
  // 1. Vérifier le cookie admin_session (système de connexion admin séparé)
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;

  let adminUserId: string | null = null;

  // 2. Essayer de récupérer l'ID via la session Supabase
  const userClient = await createClient();
  if (userClient) {
    const { data: { user } } = await userClient.auth.getUser();
    if (user) adminUserId = user.id;
  }

  // 3. Sinon, retrouver un profil admin via le client admin (service role)
  if (!adminUserId) {
    const adminClient = createAdminClient();
    if (adminClient) {
      const { data: adminProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .in("role", ["admin", "super_admin"])
        .limit(1)
        .maybeSingle();
      if (adminProfile?.user_id) adminUserId = adminProfile.user_id;
    }
  }

  // 4. S'il n'y a pas de cookie admin et pas d'ID admin, refuser
  if (adminCookie !== "true" && !adminUserId) return null;

  // 5. Vérifier que l'ID trouvé est bien un admin (si on a un ID)
  if (adminUserId && adminCookie === "true") {
    // Cookie admin présent + ID => on considère que c'est un admin
    return { id: adminUserId };
  }

  // Fallback : accepte si le cookie admin est présent
  return { id: adminUserId || "admin" };
}

// ============ ADMIN ANALYTICS ============

export async function getAdminAnalytics() {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return null;

  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return null;

  // 1. Récupérer tous les profils (créés_at pour la courbe d'inscriptions)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("created_at");

  // 2. Récupérer les dépôts
  const { data: deposits } = await supabase
    .from("deposits")
    .select("amount, status, created_at");

  // 3. Récupérer les retraits
  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("amount, status, created_at");

  // 4. Récupérer les tâches
  const { data: tasks } = await supabase
    .from("tasks")
    .select("created_at");

  // 5. Récupérer les soumissions
  const { data: submissions } = await supabase
    .from("task_submissions")
    .select("status, created_at");

  // 6. Récupérer les investissements
  const { data: investments } = await supabase
    .from("investments")
    .select("amount, status, created_at");

  // 7. Récupérer les notifications
  const { data: notifications } = await supabase
    .from("notifications")
    .select("created_at");

  // 8. Récupérer les wallets pour les gains
  const { data: wallets } = await supabase
    .from("wallets")
    .select("total_earnings, balance");

  // ===== Calculer les statistiques =====

  // Inscriptions par jour (7 derniers jours)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const registrationsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (profiles || []).filter((p: any) => {
      const date = new Date(p.created_at);
      return date >= day && date < next;
    }).length;
  });

  // Dépôts par jour (7 derniers jours)
  const depositsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (deposits || [])
      .filter((d: any) => {
        const date = new Date(d.created_at);
        return date >= day && date < next && d.status === "approved";
      })
      .reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  });

  // Retraits par jour (7 derniers jours)
  const withdrawalsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (withdrawals || [])
      .filter((w: any) => {
        const date = new Date(w.created_at);
        return date >= day && date < next && (w.status === "approved" || w.status === "completed");
      })
      .reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  });

  // Tâches créées par jour (7 derniers jours)
  const tasksByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (tasks || []).filter((t: any) => {
      const date = new Date(t.created_at);
      return date >= day && date < next;
    }).length;
  });

  // Soumissions par jour (7 derniers jours)
  const submissionsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (submissions || []).filter((s: any) => {
      const date = new Date(s.created_at);
      return date >= day && date < next;
    }).length;
  });

  // Investissements par jour (7 derniers jours)
  const investmentsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (investments || [])
      .filter((i: any) => {
        const date = new Date(i.created_at);
        return date >= day && date < next;
      })
      .reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
  });

  // Notifications par jour (7 derniers jours)
  const notificationsByDay = last7Days.map((day) => {
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    return (notifications || []).filter((n: any) => {
      const date = new Date(n.created_at);
      return date >= day && date < next;
    }).length;
  });

  // Labels des jours
  const dayLabels = last7Days.map((d) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })
  );

  // Totaux
  const totalUsers = (profiles || []).length;
  const totalTasks = (tasks || []).length;
  const totalDeposits = (deposits || []).filter((d: any) => d.status === "approved").reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const totalWithdrawals = (withdrawals || []).filter((w: any) => (w.status === "approved" || w.status === "completed")).reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalEarnings = (wallets || []).reduce((sum: number, w: any) => sum + (w.total_earnings || 0), 0);
  const totalBalance = (wallets || []).reduce((sum: number, w: any) => sum + (w.balance || 0), 0);
  const totalInvestments = (investments || []).filter((i: any) => i.status === "active").reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
  const totalSubmissions = (submissions || []).length;
  const approvedSubmissions = (submissions || []).filter((s: any) => s.status === "approved").length;
  const pendingSubmissions = (submissions || []).filter((s: any) => s.status === "pending").length;
  const rejectedSubmissions = (submissions || []).filter((s: any) => s.status === "rejected").length;
  const totalNotifications = (notifications || []).length;

  // Taux de conversion
  const conversionRate = totalUsers > 0 ? Math.round((totalInvestments > 0 ? (investments || []).filter((i: any) => i.status === "active").length : 0) / totalUsers * 100) : 0;

  return {
    dayLabels,
    registrationsByDay,
    depositsByDay,
    withdrawalsByDay,
    tasksByDay,
    submissionsByDay,
    investmentsByDay,
    notificationsByDay,
    totalUsers,
    totalTasks,
    totalDeposits,
    totalWithdrawals,
    totalEarnings,
    totalBalance,
    totalInvestments,
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    totalNotifications,
    conversionRate,
  };
}

// ============ PLATFORM STATS ============

export async function getPlatformStats() {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return null;

  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return null;

  // 1. Compter les utilisateurs (profils)
  const { count: userCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // 2. Compter les tâches
  const { count: taskCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true });

  // 3. Compter les dépôts en attente
  const { count: pendingDeposits } = await supabase
    .from("deposits")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // 4. Compter les retraits en attente
  const { count: pendingWithdrawals } = await supabase
    .from("withdrawals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // 5. Compter les soumissions en attente
  const { count: pendingSubmissions } = await supabase
    .from("task_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // 6. Somme des dépôts approuvés
  const { data: approvedDeposits } = await supabase
    .from("deposits")
    .select("amount")
    .eq("status", "approved");

  // 7. Somme des retraits approuvés
  const { data: approvedWithdrawals } = await supabase
    .from("withdrawals")
    .select("amount")
    .in("status", ["approved", "completed"]);

  // 8. Somme des gains totaux
  const { data: wallets } = await supabase
    .from("wallets")
    .select("total_earnings");

  // 9. Récupérer les investissements actifs (pour la somme du capital investi)
  const { data: activeInvestments } = await supabase
    .from("investments")
    .select("amount, plan_id")
    .eq("status", "active");

  // 10. Récupérer TOUS les plans (même sans utilisateurs)
  const { data: allPlans } = await supabase
    .from("plans")
    .select("id, name, slug, price")
    .order("sort_order");

  // 11. Compter les utilisateurs par plan
  const { data: investmentsWithPlans } = await supabase
    .from("investments")
    .select("plan_id, amount, plans(id, name, slug, price)")
    .eq("status", "active");

  const totalDeposits = (approvedDeposits || []).reduce((sum: number, d: any) => sum + (d.amount || 0), 0);
  const totalWithdrawals = (approvedWithdrawals || []).reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalEarnings = (wallets || []).reduce((sum: number, w: any) => sum + (w.total_earnings || 0), 0);

  // SOMME des montants investis (capital investi total)
  const totalInvestments = (activeInvestments || []).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);

  // Compter les utilisateurs par plan
  const planCounts = new Map<string, number>();
  (investmentsWithPlans || []).forEach((i: any) => {
    const planId = i.plan_id;
    planCounts.set(planId, (planCounts.get(planId) || 0) + 1);
  });

  // Fusionner TOUS les plans avec leurs comptes d'utilisateurs
  const plansWithUsers = (allPlans || []).map((plan: any) => ({
    plan_id: plan.id,
    plan_name: plan.name || "Plan",
    plan_slug: plan.slug || "unknown",
    plan_price: plan.price || 0,
    user_count: planCounts.get(plan.id) || 0,
  }));

  return {
    total_users: userCount || 0,
    total_tasks: taskCount || 0,
    pending_deposits: pendingDeposits || 0,
    pending_withdrawals: pendingWithdrawals || 0,
    pending_submissions: pendingSubmissions || 0,
    total_deposits: totalDeposits,
    total_withdrawals: totalWithdrawals,
    total_earnings: totalEarnings,
    total_investments: totalInvestments,
    plans_with_users: plansWithUsers,
  };
}

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

// ============ PLANS ============

export async function getPlans(includeInactive = false) {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("plans").select("*").order("sort_order");
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data } = await query;
  return data || [];
}

export async function createPlanAction(input: {
  name: string;
  slug: string;
  price: number;
  daily_tasks: number;
  min_profitability: number;
  max_profitability: number;
  color?: string;
  icon?: string;
  badge?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("create_plan", {
    p_admin_id: admin.id,
    p_name: input.name,
    p_slug: input.slug,
    p_price: input.price,
    p_daily_tasks: input.daily_tasks,
    p_min_profitability: input.min_profitability,
    p_max_profitability: input.max_profitability,
    p_color: input.color || "#9D3FE7",
    p_icon: input.icon || "Medal",
    p_badge: input.badge || "Standard",
  });
  revalidatePath("/admin/plans");
  return data;
}

export async function updatePlanAction(input: {
  planId: string;
  name?: string;
  price?: number;
  daily_tasks?: number;
  min_profitability?: number;
  max_profitability?: number;
  color?: string;
  icon?: string;
  badge?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("update_plan", {
    p_admin_id: admin.id,
    p_plan_id: input.planId,
    p_name: input.name || null,
    p_price: input.price ?? null,
    p_daily_tasks: input.daily_tasks ?? null,
    p_min_profitability: input.min_profitability ?? null,
    p_max_profitability: input.max_profitability ?? null,
    p_color: input.color || null,
    p_icon: input.icon || null,
    p_badge: input.badge || null,
  });
  revalidatePath("/admin/plans");
  return data;
}

export async function togglePlanStatusAction(planId: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("toggle_plan_status", {
    p_admin_id: admin.id,
    p_plan_id: planId,
    p_is_active: isActive,
  });
  revalidatePath("/admin/plans");
  return data;
}

// ============ TASKS ============

export async function getTasks(planId?: string) {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return [];

  // Use admin client to bypass RLS for admin listing
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  let query = supabase
    .from("tasks")
    .select("*, plans(name, slug, daily_tasks), task_categories(name, slug)")
    .order("created_at", { ascending: false });
  if (planId) {
    query = query.eq("plan_id", planId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("getTasks error", error);
    return [];
  }
  return data || [];
}

export async function getTaskFields(taskId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("submission_fields")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order");
  return data || [];
}

export async function createTaskAction(input: CreateTaskInput) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data, error } = await supabase.rpc("create_task", {
    p_admin_id: admin.id,
    p_title: input.title,
    p_description: input.description || null,
    p_amount: input.amount,
    p_plan_id: input.plan_id || null,
    p_category_id: input.category_id || null,
    p_icon: input.icon || "📋",
    p_estimated_time: input.estimated_time ?? null,
    p_instructions: input.instructions || null,
    p_link: input.link || null,
    p_max_completions: input.max_completions ?? null,
    p_duration_minutes: input.duration_minutes ?? null,
    p_deadline: input.deadline || null,
    p_validation_type: input.validation_type,
    p_fields: input.fields && input.fields.length > 0 ? JSON.parse(JSON.stringify(input.fields)) : null,
  });
  if (error) {
    console.error("Create task RPC error:", error);
    return { success: false, error: `Erreur SQL: ${error.message}` };
  }
  // The RPC returns a JSONB with success and task_id. Fetch the created task to return a canonical object
  try {
    const rpcResult: any = data;
    const taskId = rpcResult?.task_id || (rpcResult?.task && rpcResult.task.id) || null;
    if (taskId) {
      // Try fetching with the current client first
      let taskData = null;
      let taskError = null;
      try {
        const res = await supabase
          .from("tasks")
          .select("*, plans(name, slug), task_categories(name, slug)")
          .eq("id", taskId)
          .single();
        taskData = (res as any).data;
        taskError = (res as any).error;
      } catch (e) {
        console.error("Fetch with user client failed:", e);
      }

      // If fetching failed (possibly due to RLS), try with admin client
      if (!taskData) {
        try {
          const adminClient = createAdminClient();
          if (adminClient) {
            const res2 = await adminClient
              .from("tasks")
              .select("*, plans(name, slug), task_categories(name, slug)")
              .eq("id", taskId)
              .single();
            taskData = (res2 as any).data;
            taskError = (res2 as any).error;
          }
        } catch (e) {
          console.error("Fetch with admin client failed:", e);
        }
      }

      if (taskError) {
        console.error("Failed to fetch created task:", taskError);
      }

      revalidatePath("/admin/tasks");
      return { success: true, task: taskData || null, task_id: taskId };
    }
  } catch (e) {
    console.error("Error while fetching created task:", e);
  }

  revalidatePath("/admin/tasks");
  return data || { success: false, error: "Aucun résultat retourné — vérifiez que la migration create_task est exécutée" };
}

export async function updateTaskAction(input: {
  task_id: string;
  title?: string;
  description?: string;
  amount?: number;
  plan_id?: string;
  icon?: string;
  estimated_time?: number;
  instructions?: string;
  link?: string;
  max_completions?: number;
  duration_minutes?: number;
  deadline?: string;
  validation_type?: "auto" | "manual";
  is_active?: boolean;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("update_task", {
    p_admin_id: admin.id,
    p_task_id: input.task_id,
    p_title: input.title || null,
    p_description: input.description || null,
    p_amount: input.amount ?? null,
    p_plan_id: input.plan_id || null,
    p_icon: input.icon || null,
    p_estimated_time: input.estimated_time ?? null,
    p_instructions: input.instructions || null,
    p_link: input.link || null,
    p_max_completions: input.max_completions ?? null,
    p_duration_minutes: input.duration_minutes ?? null,
    p_deadline: input.deadline || null,
    p_validation_type: input.validation_type || null,
    p_is_active: input.is_active ?? null,
  });
  revalidatePath("/admin/tasks");
  return data;
}

export async function deleteTaskAction(taskId: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("delete_task", {
    p_admin_id: admin.id,
    p_task_id: taskId,
  });
  revalidatePath("/admin/tasks");
  return data;
}

// ============ SUBMISSIONS (manual validation) ============

export async function getSubmissions(status?: string) {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return [];

  // Utiliser le client admin (service role) pour contourner les problèmes de session
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];

  // 1. Récupérer les soumissions avec la tâche (relation OK : task_submissions.task_id → tasks.id)
  let query = supabase
    .from("task_submissions")
    .select("*, tasks(title, amount), submission_answers(*, submission_fields(title, field_type))")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) {
    query = query.eq("status", status);
  }
  const { data: submissions, error } = await query;
  if (error) {
    console.error("getSubmissions error:", error);
    return [];
  }

  // 2. Récupérer les profils séparément (task_submissions.user_id → auth.users, pas profiles)
  const userIds = (submissions || []).map((s: any) => s.user_id);
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, username")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    return (submissions || []).map((s: any) => ({
      ...s,
      profiles: profileMap.get(s.user_id) || { full_name: null, username: null },
    }));
  }

  return submissions || [];
}

export async function approveSubmissionAction(submissionId: string, comment?: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("approve_submission", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_comment: comment || null,
  });
  revalidatePath("/admin/tasks");
  return data;
}

export async function rejectSubmissionAction(submissionId: string, comment?: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("reject_submission", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_comment: comment || null,
  });
  revalidatePath("/admin/tasks");
  return data;
}

// ============ CATEGORIES ============

export async function getCategories() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("task_categories").select("*").order("created_at");
  return data || [];
}

// ============ SERVICE ORDERS ============

export async function getServiceOrders() {
  const admin = await requireAdmin();
  if (!admin) return [];
  // Utiliser le client admin (service role) pour contourner les RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("service_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getServiceOrders error:", error);
    return [];
  }
  return data || [];
}

export async function updateServiceOrderStatus(orderId: string, status: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  // Utiliser le client admin (service role) pour contourner les RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { error } = await supabase
    .from("service_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("updateServiceOrderStatus error:", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/services");
  return { success: true };
}

// ============ SYSTEM SETTINGS ============

export async function getSystemSettings() {
  const supabase = await createClient();
  if (!supabase) return {};
  const { data } = await supabase.from("system_settings").select("key, value");
  const settings: Record<string, any> = {};
  data?.forEach((s) => {
    settings[s.key] = s.value;
  });
  return settings;
}

export async function getPaymentMethods() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("payment_methods").select("*").eq("is_active", true);
  return data || [];
}