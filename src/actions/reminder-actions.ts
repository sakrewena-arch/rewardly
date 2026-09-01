"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Génère les notifications de RAPPEL automatiques pour l'utilisateur connecté
 * (appelée une fois par jour depuis le dashboard) :
 *  1. "Tâches du jour" : si l'utilisateur a un pack actif et n'a encore
 *     fait AUCUNE tâche aujourd'hui.
 *  2. "Passer au plan supérieur" : si son pack actif n'est pas Gold.
 *  3. "Dépôt en attente" : s'il a un dépôt pending depuis plus d'1h.
 *
 * Anti-spam : on n'envoie JAMAIS deux fois le même rappel le même jour
 * (vérification d'une notification similaire déjà créée aujourd'hui).
 */
export async function generateDailyRemindersAction() {
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const adminClient = createAdminClient();
  if (!adminClient) return { success: false, error: "Supabase non configuré" };

  const today = new Date().toISOString().slice(0, 10);
  const results = { tasks: 0, upgrade: 0, deposits: 0 };
  const userId = user.id;

  // ============================================================
  // 1. RAPPEL TÂCHES DU JOUR
  // ============================================================
  const { data: activeInvestments } = await adminClient
    .from("investments")
    .select("user_id, plans(name, slug)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (activeInvestments && activeInvestments.length > 0) {
    // Aucune soumission (approved/pending) créée aujourd'hui ?
    const { data: todaySubmissions } = await adminClient
      .from("task_submissions")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", `${today}T00:00:00`)
      .in("status", ["approved", "pending"]);

    // Anti-spam : notification "tâche" déjà envoyée aujourd'hui ?
    const { data: existingTaskNotifs } = await adminClient
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "task")
      .gte("created_at", `${today}T00:00:00`);

    if ((!todaySubmissions || todaySubmissions.length === 0) && (!existingTaskNotifs || existingTaskNotifs.length === 0)) {
      const planName = (activeInvestments[0] as any)?.plans?.[0]?.name || "votre pack";
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "📋 Vos tâches vous attendent !",
        message: `Effectuez vos tâches aujourd'hui pour gagner de l'argent avec votre pack ${planName}. Plus vous en faites, plus vous gagnez !`,
        type: "task",
        is_read: false,
      });
      results.tasks++;
    }
  }

  // ============================================================
  // 2. RAPPEL PASSER AU PLAN SUPÉRIEUR (pack non-Gold)
  // ============================================================
  const nonGold = activeInvestments?.find(
    (i: any) => (i.plans as any)?.[0]?.slug !== "gold"
  );

  if (nonGold) {
    const { data: existingUpgradeNotifs } = await adminClient
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "promotion")
      .gte("created_at", `${today}T00:00:00`);

    if (!existingUpgradeNotifs || existingUpgradeNotifs.length === 0) {
      const planName = (nonGold.plans as any)?.[0]?.name || "votre pack";
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "🚀 Passez au niveau supérieur !",
        message: `Vous avez marre d'attendre ? Passez au plan supérieur pour gagner PLUS avec plus de tâches et de meilleures récompenses. Votre pack ${planName} peut être upgradé en 1 clic !`,
        type: "promotion",
        is_read: false,
      });
      results.upgrade++;
    }
  }

  // ============================================================
  // 3. RAPPEL DÉPÔT EN ATTENTE (pending depuis plus d'1h)
  // ============================================================
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: pendingDeposits } = await adminClient
    .from("deposits")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lt("created_at", oneHourAgo);

  if (pendingDeposits && pendingDeposits.length > 0) {
    const { data: existingDepositNotifs } = await adminClient
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "deposit")
      .gte("created_at", `${today}T00:00:00`);

    if (!existingDepositNotifs || existingDepositNotifs.length === 0) {
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "⏳ Dépôt en attente de confirmation",
        message: `Votre dépôt de ${pendingDeposits[0]?.amount || ""} FCFA est en attente de validation. Il sera crédité dès confirmation par notre équipe.`,
        type: "deposit",
        is_read: false,
      });
      results.deposits++;
    }
  }

  return { success: true, ...results };
}

/**
 * Envoie des notifications de RAPPEL automatiques à TOUS les utilisateurs.
 * Appelé par la route API /api/notifications/reminders (cron Vercel/GitHub).
 *
 * Types de rappels :
 *  1. "Tâches du jour" : utilisateurs avec un pack actif qui n'ont pas encore
 *     effectué de tâche aujourd'hui.
 *  2. "Passer au plan supérieur" : utilisateurs avec un pack actif non-Gold
 *     (relance pour upgrade).
 *  3. "Dépôt en attente" : utilisateurs avec un dépôt pending depuis > 1h.
 *
 * Anti-spam : on n'envoie JAMAIS deux fois le même rappel le même jour
 * (vérification d'une notification similaire créée aujourd'hui).
 */
export async function sendReminderNotificationsAction() {
  const adminClient = createAdminClient();
  if (!adminClient) return { success: false, error: "Supabase non configuré" };

  const today = new Date().toISOString().slice(0, 10);
  const results = { tasks: 0, upgrade: 0, deposits: 0 };

  // ============================================================
  // 1. RAPPEL TÂCHES DU JOUR
  // ============================================================
  // Utilisateurs avec un investissement actif qui n'ont AUCUNE soumission
  // (approved ou pending) créée aujourd'hui.
  const { data: activeUsers } = await adminClient
    .from("investments")
    .select("user_id, plans(name, slug)")
    .eq("status", "active");

  if (activeUsers) {
    const userIds = [...new Set(activeUsers.map((i: any) => i.user_id))];

    // Récupérer les soumissions d'aujourd'hui pour ces utilisateurs
    const { data: todaySubmissions } = await adminClient
      .from("task_submissions")
      .select("user_id")
      .in("user_id", userIds)
      .gte("created_at", `${today}T00:00:00`)
      .in("status", ["approved", "pending"]);

    const doneToday = new Set((todaySubmissions || []).map((s: any) => s.user_id));

    // Vérifier anti-spam : notification "tâches" déjà envoyée aujourd'hui
    const { data: existingTaskNotifs } = await adminClient
      .from("notifications")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "task")
      .gte("created_at", `${today}T00:00:00`);

    const alreadyNotified = new Set((existingTaskNotifs || []).map((n: any) => n.user_id));

    for (const userId of userIds) {
      if (doneToday.has(userId) || alreadyNotified.has(userId)) continue;

      const investment = activeUsers.find((i: any) => i.user_id === userId);
      const planName = (investment?.plans as any)?.[0]?.name || "votre pack";

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "📋 Vos tâches vous attendent !",
        message: `Effectuez vos tâches aujourd'hui pour gagner de l'argent avec votre pack ${planName}. Plus vous en faites, plus vous gagnez !`,
        type: "task",
        is_read: false,
      });
      results.tasks++;
    }
  }

  // ============================================================
  // 2. RAPPEL PASSER AU PLAN SUPÉRIEUR
  // ============================================================
  // Utilisateurs avec un pack actif non-Gold (Bronze/Silver) → relance upgrade.
  const { data: nonGoldInvestments } = await adminClient
    .from("investments")
    .select("user_id, plans(name, slug)")
    .eq("status", "active")
    .neq("plans.slug", "gold");

  if (nonGoldInvestments) {
    const userIds = [...new Set(nonGoldInvestments.map((i: any) => i.user_id))];

    const { data: existingUpgradeNotifs } = await adminClient
      .from("notifications")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "promotion")
      .gte("created_at", `${today}T00:00:00`);

    const alreadyNotified = new Set((existingUpgradeNotifs || []).map((n: any) => n.user_id));

    for (const userId of userIds) {
      if (alreadyNotified.has(userId)) continue;

      const investment = nonGoldInvestments.find((i: any) => i.user_id === userId);
      const planName = (investment?.plans as any)?.[0]?.name || "votre pack";

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "🚀 Passez au niveau supérieur !",
        message: `Vous avez marre d'attendre ? Passez au plan supérieur pour gagner PLUS avec plus de tâches et de meilleures récompenses. Votre pack ${planName} peut être upgradé en 1 clic !`,
        type: "promotion",
        is_read: false,
      });
      results.upgrade++;
    }
  }

  // ============================================================
  // 3. RAPPEL DÉPÔT EN ATTENTE
  // ============================================================
  // Dépôts pending créés il y a plus d'1 heure → rappel de validation.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: pendingDeposits } = await adminClient
    .from("deposits")
    .select("user_id, amount")
    .eq("status", "pending")
    .lt("created_at", oneHourAgo);

  if (pendingDeposits) {
    const userIds = [...new Set(pendingDeposits.map((d: any) => d.user_id))];

    const { data: existingDepositNotifs } = await adminClient
      .from("notifications")
      .select("user_id")
      .in("user_id", userIds)
      .eq("type", "deposit")
      .gte("created_at", `${today}T00:00:00`);

    const alreadyNotified = new Set((existingDepositNotifs || []).map((n: any) => n.user_id));

    for (const userId of userIds) {
      if (alreadyNotified.has(userId)) continue;

      const deposit = pendingDeposits.find((d: any) => d.user_id === userId);

      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "⏳ Dépôt en attente de confirmation",
        message: `Votre dépôt de ${deposit?.amount || ""} FCFA est en attente de validation. Il sera crédité dès confirmation par notre équipe.`,
        type: "deposit",
        is_read: false,
      });
      results.deposits++;
    }
  }

  return { success: true, ...results };
}