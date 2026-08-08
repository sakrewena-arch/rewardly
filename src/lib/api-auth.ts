import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Extrait le token d'accès depuis le header Authorization ou les cookies.
 * Le cookie Supabase est au format JSON encodé: {"access_token":"...","refresh_token":"..."}
 */
function extractAccessToken(request: Request): string | null {
  // 1. Header Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // 2. Cookie de session Supabase (sb-<ref>-auth-token)
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name && name.includes("-auth-token") && value) {
      try {
        // Le cookie est au format JSON encodé: {"access_token":"...","refresh_token":"..."}
        const decoded = decodeURIComponent(value);
        const parsed = JSON.parse(decoded);
        if (parsed.access_token) return parsed.access_token;
      } catch {
        // Si ce n'est pas du JSON, essayer la valeur brute
        return value;
      }
    }
  }

  return null;
}

/**
 * Vérifie que l'utilisateur est authentifié et retourne son ID.
 * Utilise @supabase/supabase-js directement (fiable dans les Route Handlers).
 */
export async function requireApiUser(request?: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "https://placeholder.supabase.co") {
    return null;
  }

  const accessToken = request ? extractAccessToken(request) : null;
  if (!accessToken) return null;

  const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: { user } } = await supabase.auth.getUser(accessToken);
  if (!user) return null;

  return user;
}

/**
 * Vérifie que l'utilisateur est authentifié ET admin.
 */
export async function requireApiAdmin(request?: Request) {
  const user = await requireApiUser(request);
  if (!user) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAdmin) return null;

  return user;
}

/**
 * Retourne une réponse 401 standardisée.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
}

/**
 * Retourne une réponse 403 standardisée.
 */
export function forbiddenResponse() {
  return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
}