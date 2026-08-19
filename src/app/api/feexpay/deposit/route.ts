import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { initiatePayin } from "@/lib/feexpay";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // 🔒 Authentification requise
    const user = await requireApiUser(request);
    if (!user) return unauthorizedResponse();

    // Rate limit : max 10 demandes de dépôt / minute / utilisateur
    const ip = getClientIp(request);
    const rl = checkRateLimit(`deposit:${user.id}:${ip}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Trop de demandes. Réessayez dans ${rl.retryAfter}s.` },
        { status: 429 }
      );
    }

    const { network, phoneNumber, amount, description } = await request.json();

    if (!network || !phoneNumber || !amount) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    // 🔒 Le userId est dérivé de la session, pas du body
    const userId = user.id;

    // Initier le paiement FeeXPay
    const payin = await initiatePayin({
      network,
      phoneNumber,
      amount,
      description: description || `Dépôt Rewardly ${amount}`,
      callbackInfo: `user_${userId}`,
    });

    // Créer la demande de dépôt en base (en attente)
    // ✅ Client direct (fiable dans les Route Handlers)
    // ⚠️ La table deposits n'a PAS de colonnes feexpay_reference/account_number/description
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
      await adminClient.from("deposits").insert({
        user_id: userId,
        amount,
        method: network,
        reference: payin.reference,
        status: "pending",
      });
    }

    return NextResponse.json({
      success: true,
      reference: payin.reference,
      status: payin.status,
      message: payin.message,
    });
  } catch (error: any) {
    console.error("FeeXPay deposit error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors du dépôt" }, { status: 500 });
  }
}