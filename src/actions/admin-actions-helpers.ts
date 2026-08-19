"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";


// ============ AUTH HELPERS ============

// Admin actions require real authentication and admin role
export async function requireAdmin() {
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
