"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";


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
