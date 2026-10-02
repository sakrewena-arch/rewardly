import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { initiatePayin, normalizeNetwork } from "@/lib/paygate";

/** Montant minimum de dépôt (FCFA). */
const MIN_DEPOSIT = 5000;

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

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < MIN_DEPOSIT) {
      return NextResponse.json(
        { error: `Le montant minimum de dépôt est de ${MIN_DEPOSIT} FCFA.` },
        { status: 400 }
      );
    }

    // PayGateGlobal n'accepte que FLOOZ (Moov) et TMONEY (Togocom)
    const payGateNetwork = normalizeNetwork(network);
    if (!payGateNetwork) {
      return NextResponse.json(
        { error: `Moyen de paiement non supporté : ${network}` },
        { status: 400 }
      );
    }

    // 🔒 Le userId est dérivé de la session, pas du body
    const userId = user.id;

    // Identifiant interne UNIQUE : sert de `deposits.reference` ET d'`identifier`
    // PayGate (interrogation de l'état via /api/v2/status).
    const identifier = `DEP-${randomUUID()}`;

    // 1. Enregistrer la demande de paiement chez PayGateGlobal (push USSD)
    const payin = await initiatePayin({
      network: payGateNetwork,
      phoneNumber,
      amount: numAmount,
      identifier,
      description: description || `Depot Rewardly ${numAmount}`,
    });

    if (!payin.success) {
      return NextResponse.json({ error: payin.message }, { status: 400 });
    }

    // 2. Créer la demande de dépôt en base (en attente)
    // ✅ Client direct (fiable dans les Route Handlers)
    // ⚠️ La table deposits n'a PAS de colonne `description`
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
    const { error: insertError } = await adminClient.from("deposits").insert({
      user_id: userId,
      amount: numAmount,
      method: payGateNetwork,
      reference: identifier,
      paygate_tx_reference: payin.txReference,
      network: payGateNetwork,
      status: "pending",
    });

    if (insertError) {
      console.error("PayGate deposit insert error:", insertError);
      return NextResponse.json(
        {
          error:
            "Paiement enregistré chez l'opérateur mais non sauvegardé en base. " +
            "Notez votre référence et contactez le support.",
          reference: identifier,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reference: identifier,
      txReference: payin.txReference,
      status: payin.status,
      message: "Demande de paiement envoyée. Confirmez le paiement sur votre téléphone.",
    });
  } catch (error: any) {
    console.error("PayGate deposit error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors du dépôt" }, { status: 500 });
  }
}