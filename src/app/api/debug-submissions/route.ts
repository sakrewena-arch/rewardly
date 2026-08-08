import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Route de DIAGNOSTIC : vérifie que les soumissions sont bien récupérables
 * depuis la base via le client admin.
 * URL : /api/debug-submissions
 */
export async function GET() {
  // 🔒 Authentification admin requise
  const user = await requireApiAdmin();
  if (!user) return unauthorizedResponse();

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({
      error: "Client admin non initialisé. Vérifiez SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  // 1. Récupérer les soumissions en attente (sans jointure profiles - relation impossible)
  const { data: submissions, error } = await adminClient
    .from("task_submissions")
    .select("*, tasks(title, amount), submission_answers(*, submission_fields(title, field_type))")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message });
  }

  // 2. Récupérer les profils séparément
  const userIds = (submissions || []).map((s: any) => s.user_id);
  let profilesMap = new Map();
  if (userIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, full_name, username")
      .in("user_id", userIds);
    profilesMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  }

  // 3. Fusionner
  const merged = (submissions || []).map((s: any) => ({
    ...s,
    profiles: profilesMap.get(s.user_id) || { full_name: null, username: null },
  }));

  // 4. Compter les soumissions par statut
  const { count: totalCount } = await adminClient
    .from("task_submissions")
    .select("*", { count: "exact", head: true });

  const { count: pendingCount } = await adminClient
    .from("task_submissions")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  return NextResponse.json({
    service_role_key_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    total_submissions: totalCount,
    pending_submissions: pendingCount,
    submissions: merged,
  });
}