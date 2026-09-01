import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Route API pour le login admin.
 * Utilise @supabase/ssr pour PERSISTER la session Supabase dans les cookies :
 * les Server Actions admin (requireAdmin) peuvent ainsi vérifier l'identité
 * du compte via auth.getUser() — le cookie admin_session seul ne suffit plus.
 *
 * Le cookie admin_session (httpOnly) est posé UNIQUEMENT si le compte
 * connecté possède le rôle admin/super_admin.
 */
export async function POST(request: Request) {
  try {
    // Rate limit : max 10 tentatives de connexion admin / minute / IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`admin-login:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives. Réessayez dans ${rl.retryAfter}s.` },
        { status: 429 }
      );
    }

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

    // Réponse créée AVANT pour pouvoir poser les cookies de session dans setAll
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          const cookieHeader = request.headers.get("cookie") || "";
          return cookieHeader.split(";").map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name: name || "", value: decodeURIComponent(rest.join("=") || "") };
          }).filter((c) => c.name);
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Se connecter via Supabase Auth → la session est persistée dans les cookies
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

    // Vérifier le rôle admin (lecture via la session de l'utilisateur)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Ce compte n'est pas autorisé à accéder à l'administration." },
        { status: 403 }
      );
    }

    // Poser le cookie admin (httpOnly → non modifiable par JS)
    response.cookies.set(ADMIN_SESSION_COOKIE, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 heures
    });

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la connexion" },
      { status: 500 }
    );
  }
}