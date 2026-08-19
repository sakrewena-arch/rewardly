import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // 🔒 Authentification requise
    const user = await requireApiUser(request);
    if (!user) return unauthorizedResponse();

    // Rate limit : max 5 demandes de retrait / minute / utilisateur
    const ip = getClientIp(request);
    const rl = checkRateLimit(`withdrawal:${user.id}:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Trop de demandes. Réessayez dans ${rl.retryAfter}s.` },
        { status: 429 }
      );
    }

    const { network, phoneNumber, amount, motif } = await request.json();

    if (!network || !phoneNumber || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: "Paramètres manquants ou invalides" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
    }

    // Client service role (appelé uniquement par ce serveur)
    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);
    const fullPhone = String(phoneNumber).replace(/\D/g, "");

    // ✅ Délégation à la RPC SQL ATOMIQUE (request_withdrawal_feeexpay) :
    //    - vérifie que le montant ne dépasse PAS les GAINS retirables
    //    - vérifie le solde du wallet
    //    - débite le wallet, crée la demande de retrait et la transaction
    //      de débit en UNE seule transaction (aucun rollback manuel bugué).
    const { data, error } = await adminClient.rpc("request_withdrawal_feeexpay", {
      p_user_id: user.id,
      p_amount: Number(amount),
      p_method: network,
      p_account_info: fullPhone,
      p_description: motif ? `Retrait ${network} - ${motif}` : `Retrait ${network}`,
    });

    if (error) {
      console.error("request_withdrawal_feeexpay RPC error:", error);
      return NextResponse.json({ error: "Erreur lors de la création du retrait" }, { status: 500 });
    }

    if (data?.success !== true) {
      return NextResponse.json({ error: data?.error || "Retrait refusé" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      reference: data.withdrawal_id,
      status: "PENDING",
      message: "Demande de retrait créée, en attente de validation admin.",
    });
  } catch (error: any) {
    console.error("FeeXPay payout error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors du retrait" }, { status: 500 });
  }
}