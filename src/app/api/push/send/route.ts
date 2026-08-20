import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSign } from "node:crypto";

// ============================================================
// API /api/push/send
// Envoie une notification PUSH NATIVE (FCM HTTP v1) aux appareils
// (Android/iOS) depuis le panneau admin.
//
// ⚠️ L'ancienne API FCM legacy (clé serveur FIREBASE_SERVER_KEY) est
// désactivée par Google. On utilise désormais FCM HTTP v1 authentifié
// par un COMPTE DE SERVICE (OAuth2 + JWT).
//
// Requiert en variable d'environnement Vercel :
//   FIREBASE_SERVICE_ACCOUNT = contenu JSON du compte de service
//   (Console Firebase → Paramètres du projet → Comptes de service →
//    Générer une nouvelle clé privée)
//
// Sécurité : la route est protégée par le cookie admin httpOnly.
// ============================================================

const ADMIN_SESSION_COOKIE = "admin_session";

export const dynamic = "force-dynamic";

// ---- Helpers FCM HTTP v1 ----

function base64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Génère un JWT RS256 signé avec la clé privée du compte de service. */
function signJwt(clientEmail: string, privateKey: string, tokenUri: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(privateKey));
  return `${signingInput}.${signature}`;
}

/** Échange le JWT contre un access token OAuth2, puis le retourne. */
async function getAccessToken(sa: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const jwt = signJwt(sa.client_email, sa.private_key, sa.token_uri);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });

  const resp = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth2 failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  return data.access_token as string;
}

/** Envoie un message FCM v1 vers un token. */
async function sendFcmV1(projectId: string, accessToken: string, token: string, title: string, body: string) {
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  const payload = {
    message: {
      token,
      notification: {
        title: String(title).slice(0, 100),
        body: String(body).slice(0, 240),
      },
      android: { notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
      data: { title: String(title), message: String(body), type: "admin" },
    },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`FCM v1 (${resp.status}): ${text.slice(0, 300)}`);
  }
  return resp.json();
}

// ---- Route ----

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

    // Compte de service Firebase (JSON) — FCM HTTP v1
    const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saRaw) {
      return NextResponse.json(
        {
          sent: 0,
          error:
            "FIREBASE_SERVICE_ACCOUNT non configurée sur Vercel — les appareils n'ont pas reçu de push. " +
            "(Console Firebase → Comptes de service → Générer une nouvelle clé privée, coller le JSON complet.)",
        },
        { status: 500 }
      );
    }
    let sa: { project_id: string; client_email: string; private_key: string; token_uri: string };
    try {
      sa = JSON.parse(saRaw);
      if (!sa.project_id || !sa.client_email || !sa.private_key || !sa.token_uri) {
        throw new Error("JSON incomplet");
      }
    } catch (e: any) {
      return NextResponse.json(
        { sent: 0, error: "FIREBASE_SERVICE_ACCOUNT invalide (JSON mal formé)" },
        { status: 500 }
      );
    }

    // Client service role Supabase (jamais exposé au client)
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

    // Access token OAuth2 (une seule fois pour tous les envois)
    let accessToken: string;
    try {
      accessToken = await getAccessToken(sa);
    } catch (e: any) {
      console.error("FCM getAccessToken error:", e.message);
      return NextResponse.json({ sent: 0, error: `Échec d'authentification FCM : ${e.message}` }, { status: 500 });
    }

    // Envoyer à chaque token
    let sent = 0;
    for (const t of tokens) {
      try {
        await sendFcmV1(sa.project_id, accessToken, t.token, title, message);
        sent++;
      } catch (e: any) {
        console.warn(`FCM token ${t.token.slice(0, 12)}… échec: ${e.message}`);
      }
    }

    return NextResponse.json({ sent, total: tokens.length });
  } catch (error: any) {
    console.error("push/send error:", error);
    return NextResponse.json({ error: error.message || "Erreur push" }, { status: 500 });
  }
}