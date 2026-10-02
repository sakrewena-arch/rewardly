import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkPayinStatus, parseCallbackPayload } from "@/lib/paygate";

/**
 * Webhook de confirmation PayGateGlobal (HTTP POST, JSON).
 *
 * URL à renseigner dans le tableau de bord e-commerce PayGate :
 *   https://rewardly.website/api/paygate/callback
 *
 * ⚠️ PayGateGlobal ne fournit AUCUNE signature : on ne fait jamais confiance
 *    au corps reçu. Le statut est systématiquement REVÉRIFIÉ côté serveur via
 *    /api/v2/status avant tout crédit (protection contre le faux callbacks).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`paygate-callback:${ip}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: "Trop de requêtes" }, { status: 429 });
  }

  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const payload = parseCallbackPayload(body);
    if (!payload) {
      return NextResponse.json({ success: false, error: "Payload invalide" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ success: false, error: "Configuration Supabase manquante" }, { status: 500 });
    }

    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
    const columns = "id, user_id, amount, status, reference, paygate_tx_reference";

    // Retrouver le dépôt par notre identifiant interne, sinon par la réf. PayGate
    let deposit: any = null;
    const identifier = payload.identifier?.trim();
    if (identifier) {
      const { data } = await adminClient
        .from("deposits")
        .select(columns)
        .eq("reference", identifier)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      deposit = data;
    }
    if (!deposit && payload.tx_reference) {
      const { data } = await adminClient
        .from("deposits")
        .select(columns)
        .eq("paygate_tx_reference", payload.tx_reference)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      deposit = data;
    }

    // Dépôt inconnu → 200 pour éviter des relances infinies de PayGate
    if (!deposit) {
      console.warn("PayGate callback : dépôt inconnu", identifier || payload.tx_reference);
      return NextResponse.json({ success: true, ignored: "deposit_not_found" });
    }

    // Déjà traité (credité ou refusé) → rien à faire
    if (deposit.status !== "pending") {
      return NextResponse.json({ success: true, ignored: `status_${deposit.status}` });
    }

    // 🔒 Vérification serveur-à-serveur : on ne crédite que si PayGate confirme
    const status = await checkPayinStatus(deposit.reference);
    if (status.status !== "SUCCESSFUL") {
      return NextResponse.json({ success: true, verified: false, status: status.status });
    }

    // ✅ Crédit ATOMIQUE (verrou + anti double-crédit)
    const { data: rpcData, error: rpcError } = await adminClient.rpc("credit_paygate_deposit", {
      p_reference: deposit.reference,
    });

    if (rpcError) {
      console.error("credit_paygate_deposit RPC error (callback):", rpcError);
      return NextResponse.json({ success: false, error: "Erreur de crédit" }, { status: 500 });
    }

    return NextResponse.json({ success: true, credited: Boolean(rpcData?.creditable) });
  } catch (error: any) {
    console.error("PayGate callback error:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur" }, { status: 500 });
  }
}