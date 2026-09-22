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

  // 2. Récupérer les retraits
  const { data: withdrawals } = await supabase
    .from("withdrawals")
    .select("amount, status, created_at");

  // 3. Récupérer les tâches
  const { data: tasks } = await supabase
    .from("tasks")
    .select("created_at");

  // 4. Récupérer les soumissions
  const { data: submissions } = await supabase
    .from("task_submissions")
    .select("status, created_at");

  // 5. Récupérer les notifications
  const { data: notifications } = await supabase
    .from("notifications")
    .select("created_at");

  // 6. Récupérer les wallets pour les gains
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
  const totalWithdrawals = (withdrawals || []).filter((w: any) => (w.status === "approved" || w.status === "completed")).reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalEarnings = (wallets || []).reduce((sum: number, w: any) => sum + (w.total_earnings || 0), 0);
  const totalBalance = (wallets || []).reduce((sum: number, w: any) => sum + (w.balance || 0), 0);
  const totalSubmissions = (submissions || []).length;
  const approvedSubmissions = (submissions || []).filter((s: any) => s.status === "approved").length;
  const pendingSubmissions = (submissions || []).filter((s: any) => s.status === "pending").length;
  const rejectedSubmissions = (submissions || []).filter((s: any) => s.status === "rejected").length;
  const totalNotifications = (notifications || []).length;

  return {
    dayLabels,
    registrationsByDay,
    withdrawalsByDay,
    tasksByDay,
    submissionsByDay,
    notificationsByDay,
    totalUsers,
    totalTasks,
    totalWithdrawals,
    totalEarnings,
    totalBalance,
    totalSubmissions,
    approvedSubmissions,
    pendingSubmissions,
    rejectedSubmissions,
    totalNotifications,
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

  // 3. Compter les retraits en attente
  const { count: pendingWithdrawals } = await supabase
    .from("withdrawals")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // 4. Compter les soumissions en attente
  const { count: pendingSubmissions } = await supabase
    .from("task_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // 5. Somme des retraits approuvés
  const { data: approvedWithdrawals } = await supabase
    .from("withdrawals")
    .select("amount")
    .in("status", ["approved", "completed"]);

  // 6. Somme des gains totaux
  const { data: wallets } = await supabase
    .from("wallets")
    .select("total_earnings");

  const totalWithdrawals = (approvedWithdrawals || []).reduce((sum: number, w: any) => sum + (w.amount || 0), 0);
  const totalEarnings = (wallets || []).reduce((sum: number, w: any) => sum + (w.total_earnings || 0), 0);

  return {
    total_users: userCount || 0,
    total_tasks: taskCount || 0,
    pending_withdrawals: pendingWithdrawals || 0,
    pending_submissions: pendingSubmissions || 0,
    total_withdrawals: totalWithdrawals,
    total_earnings: totalEarnings,
  };
}
