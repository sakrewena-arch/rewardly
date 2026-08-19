// ============================================================
// Vérification d'authentification ADMIN pour les Edge Functions
// ============================================================
// Les Edge Functions sont exposées publiquement (https) : ACCES CONTROLE.
// L'appelant doit envoyer un JWT valide d'un utilisateur dont le profil
// a le rôle 'admin' ou 'super_admin'.
// Toute l'opération (validation de dépôt/retrait, soumission) est ensuite
// exécutée avec la clé service_role, mais UNIQUEMENT après cette vérification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AdminUser {
  id: string;
}

/**
 * Vérifie que l'appelant est un admin authentifié.
 * Retourne l'id de l'admin, ou null si non autorisé.
 */
export async function verifyAdminUser(req: Request): Promise<AdminUser | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== "admin" && role !== "super_admin") return null;

  return { id: data.user.id };
}

/** Réponse 401 standardisée pour les Edge Functions. */
export function unauthorizedResponse(headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: "Non autorisé" }), {
    status: 401,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}