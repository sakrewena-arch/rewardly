import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Route API pour le login admin.
 * Utilise @supabase/supabase-js directement (pas createServerClient)
 * car ce dernier ne fonctionne pas correctement dans les Route Handlers.
 * Évite aussi le logging des credentials par les Server Actions.
 *
 * Le cookie admin_session est une valeur simple "true" avec httpOnly.
 * httpOnly empêche JavaScript de le lire/modifier (protection XSS).
 * La réelle vérification du rôle admin se fait à l'authentification
 * et via la session Supabase.
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === "https://placeholder.supabase.co") {
      return NextResponse.json(
        { error: "Supabase non configuré" },
        { status: 500 }
      );
    }

    // Client direct (fiable dans les Route Handlers)
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);

    // Se connecter via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    const user = data.user;

    // Vérifier le rôle admin dans profiles (service role)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { error: "Service role non configuré" },
        { status: 500 }
      );
    }
    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin =
      profile?.role === "admin" || profile?.role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Ce compte n'est pas autorisé à accéder à l'administration." },
        { status: 403 }
      );
    }

    // Poser le cookie admin dans la réponse (httpOnly → non modifiable par JS)
    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 heures
    });

    // Déconnecter le client anon pour ne pas laisser de session
    await supabase.auth.signOut();

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}