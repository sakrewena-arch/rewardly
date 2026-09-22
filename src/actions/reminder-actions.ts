"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Génère les notifications de RAPPEL automatiques pour l'utilisateur connecté
 * (appelée une fois par jour depuis le dashboard) :
 *  1. "Tâche du jour" : si l'utilisateur n'a encore fait AUCUNE tâche aujourd'hui.
 *
 * Anti-spam : on n'envoie JAMAIS deux fois le même rappel le même jour.
 */
export async function generateDailyRemindersAction() {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const adminClient = createAdminClient();
  if (!adminClient) return { success: false, error: "Supabase non configuré" };

  const today = new Date().toISOString().slice(0, 10);
  const results = { tasks: 0 };
  const userId = user.id;

  // 1. RAPPEL TÂCHE DU JOUR (plateforme gratuite : pour TOUS les utilisateurs)
  // Aucune soumission (approved/pending) créée aujourd'hui ? → rappel.
  const { data: todaySubmissions } = await adminClient
    .from("task_submissions")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00`)
    .in("status", ["approved", "pending"]);

  if (!todaySubmissions || todaySubmissions.length === 0) {
    // Anti-spam : notification "tâche" déjà envoyée aujourd'hui ?
    const { data: existingTaskNotifs } = await adminClient
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "task")
      .gte("created_at", `${today}T00:00:00`);

    if (!existingTaskNotifs || existingTaskNotifs.length === 0) {
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "📋 Votre tâche du jour vous attend !",
        message: "Accomplissez votre tâche du jour et gagnez de l'argent gratuitement sur Rewardly !",
        type: "task",
        is_read: false,
      });
      results.tasks++;
    }
  }

  return { success: true, ...results };
}

/**
 * Envoie des notifications de RAPPEL automatiques à TOUS les utilisateurs.
 * Appelé par la route API /api/notifications/reminders (cron Vercel/GitHub Actions).
 *
 * Rappel : "Tâche du jour" — tous les utilisateurs qui n'ont pas encore
 * effectué leur tâche aujourd'hui (plateforme gratuite, aucun pack requis).
 *
 * Anti-spam : on n'envoie JAMAIS deux fois le même rappel le même jour.
 */
export async function sendReminderNotificationsAction() {
  const adminClient = createAdminClient();
  if (!adminClient) return { success: false, error: "Supabase non configuré" };

  const today = new Date().toISOString().slice(0, 10);
  const results = { tasks: 0 };

  // ============================================================
  // 1. RAPPEL TÂCHE DU JOUR (TOUS les utilisateurs)
  // ============================================================
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("user_id");

  if (profiles && profiles.length > 0) {
    const userIds = [...new Set(profiles.map((p: any) => p.user_id))];

    // Qui a déjà soumis une tâche aujourd'hui (approved/pending) ?
    const { data: todaySubmissions } = await adminClient
      .from("task_submissions")
      .select("user_id")
      .in("user_id", userIds)
      .gte("created_at", `${today}T00:00:00`)
      .in("status", ["approved", "pending"]);

    const doneToday = new Set((todaySubmissions || []).map((s: any) => s.user_id));

    // Anti-spam : notification "tâche" déjà envoyée aujourd'hui ?
    const { data: existingTaskNotifs } = await adminClient
      .from("notifications")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "task")
      .gte("created_at", `${today}T00:00:00`);

    const alreadyNotified = new Set((existingTaskNotifs || []).map((n: any) => n.user_id));

    for (const userId of userIds) {
      if (doneToday.has(userId) || alreadyNotified.has(userId)) continue;

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "📋 Votre tâche du jour vous attend !",
        message: "Accomplissez votre tâche du jour et gagnez de l'argent gratuitement sur Rewardly !",
        type: "task",
        is_read: false,
      });
      results.tasks++;
    }
  }

  return { success: true, ...results };
}