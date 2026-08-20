import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

// ============================================================
// API /api/push/send
// Envoie une notification PUSH NATIVE (FCM) aux appareils (Android/iOS)
// depuis le panneau admin.
// - protégée par le cookie admin_session (httpOnly)
// - récupère les push_tokens de l'utilisateur (ou tous si global)
// - envoie à Firebase Cloud Messaging (HTTP v1)
// Requiert : env FIREBASE_SERVER_KEY (clé serveur FCM legacy) ou
// FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (v1).
// ============================================================

const ADMIN_SESSION_COOKIE = "admin_session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 🔒 Admin uniquement (cookie admin httpOnly)
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (adminCookie !== "true") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
  }

  try {
    const { user_id, title, message } = await request.json();
    if (!title || !message) {
      return NextResponse.json({ error: "title et message requis" }, { status: 400 });
    }

    // Puisqu'on est derrière le cookie admin, le service_role n'est PAS exposé ici
    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

    // Récupérer les tokens : ciblé OU global
    let query = adminClient.from("push_tokens").select("user_id, token, platform");
    if (user_id) {
      query = query.eq("user_id", user_id);
    }
    const { data: tokens } = await query;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ sent: 0, message: "Aucun appareil enregistré" });
    }

    // Clé FCM : préfère la clé legacy (simplifiée) ou env
    const serverKey = process.env.FIREBASE_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json(
        { sent: 0, error: "FIREBASE_SERVER_KEY non configurée — les appareils n'ont pas reçu de push" },
        { status: 500 }
      );
    }

    // Envoyer à chaque token (FCM HTTP legacy : /fcm/send)
    let sent = 0;
    for (const t of tokens) {
      try {
        const payload = {
          to: t.token,
          notification: {
            title: String(title).slice(0, 100),
            body: String(message).slice(0, 240),
            sound: "default",
          },
          data: { title, message, type: "admin" },
          priority: "high",
        };
        const resp = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${serverKey}`,
          },
          body: JSON.stringify(payload),
        });
        if (resp.ok) sent++;
      } catch {
        /* token invalide : on continue */
      }
    }

    return NextResponse.json({ sent, total: tokens.length });
  } catch (error: any) {
    console.error("push/send error:", error);
    return NextResponse.json({ error: error.message || "Erreur push" }, { status: 500 });
  }
}