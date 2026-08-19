"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


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

  // Client admin (service role) : garantit l'exécution de la RPC même sans
  // session utilisateur active côté admin (session admin = cookie séparé).
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("approve_submission", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_comment: comment || null,
  });

  if (error) {
    console.error("approve_submission RPC error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/tasks");
  return data;
}

export async function rejectSubmissionAction(submissionId: string, comment?: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };

  // Client admin (service role) : fiable pour les RPC admin
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const { data, error } = await supabase.rpc("reject_submission", {
    p_submission_id: submissionId,
    p_admin_id: admin.id,
    p_comment: comment || null,
  });

  if (error) {
    console.error("reject_submission RPC error:", error.message);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin/tasks");
  return data;
}
