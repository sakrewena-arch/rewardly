import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkPayinStatus } from "@/lib/paygate";

export async function GET(request: Request) {
  // 🔒 Authentification requise
  const user = await requireApiUser(request);
  if (!user) return unauthorizedResponse();

  // Rate limit : max 30 vérifications / minute / utilisateur
  const ip = getClientIp(request);
  const rl = checkRateLimit(`deposit-status:${user.id}:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Trop de requêtes", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get("reference");

  if (!reference) {
    return NextResponse.json({ error: "Référence manquante" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

  try {
    // 🔒 Le dépôt interrogé doit appartenir à l'utilisateur connecté
    const { data: deposit } = await adminClient
      .from("deposits")
      .select("id, user_id, amount, status, paygate_tx_reference")
      .eq("reference", reference)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!deposit || deposit.user_id !== user.id) {
      return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });
    }

    // Dépôt déjà traité par l'administration → réponse idempotente
    if (deposit.status === "approved") {
      return NextResponse.json({
        status: "SUCCESSFUL",
        credited: true,
        alreadyCredited: true,
        message: "Dépôt déjà crédité",
      });
    }
    if (deposit.status === "rejected") {
      return NextResponse.json({
        status: "FAILED",
        credited: false,
        reason: "Dépôt refusé par l'administration",
      });
    }

    const status = await checkPayinStatus(reference);

    // Mémoriser la référence PayGateGlobal dès qu'elle est connue
    if (status.txReference && !deposit.paygate_tx_reference) {
      await adminClient
        .from("deposits")
        .update({ paygate_tx_reference: status.txReference })
        .eq("id", deposit.id);
    }

    // Si le paiement est confirmé, créditer automatiquement le wallet
    if (status.status === "SUCCESSFUL") {
      // ✅ Crédit ATOMIQUE via la RPC SQL credit_paygate_deposit :
      //    - verrouille le wallet (SELECT ... FOR UPDATE)
      //    - met à jour le dépôt → approved
      //    - crédite le wallet, insère la transaction ET la notification
      //      en UNE seule transaction (anti double-crédit garanti).
      const { data: rpcData, error: rpcError } = await adminClient.rpc("credit_paygate_deposit", {
        p_reference: reference,
      });

      if (rpcError) {
        console.error("credit_paygate_deposit RPC error:", rpcError);
        return NextResponse.json({ ...status, credited: false }, { status: 200 });
      }

      // Solde réellement crédité → renvoyé au client pour affichage immédiat
      // (l'utilisateur voit son nouveau solde sans recharger la page).
      const { data: walletRow } = await adminClient
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      return NextResponse.json({
        ...status,
        credited: Boolean(rpcData?.creditable),
        balance: walletRow ? Number(walletRow.balance) : null,
      });
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("PayGate status error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la vérification" }, { status: 500 });
  }
}