"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";


// ============ AUTH HELPERS ============

// Admin actions require real authentication and admin role
export async function requireAdmin() {
  // 1. Le cookie admin_session est obligatoire (httpOnly, posé uniquement par
  //    POST /api/admin/login APRÈS vérification du rôle admin).
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("admin_session")?.value;
  if (adminCookie !== "true") return null;

  // 2. Seule la session Supabase authentifiée fait foi pour IDENTIFIER l'admin.
  //    Un simple cookie "true" ne prouve rien — on vérifie toujours l'identité.
  const userClient = await createClient();
  if (!userClient) return null;

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;

  // 3. Vérifier que CET utilisateur possède réellement le rôle admin/super_admin.
  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return null;
  }

  return { id: user.id };
}
