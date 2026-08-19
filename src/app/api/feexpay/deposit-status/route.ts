import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkPayinStatus } from "@/lib/feexpay";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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

  try {
    const status = await checkPayinStatus(reference);

    // Si le paiement est SUCCESSFUL, créditer automatiquement le wallet
    if (status.status === "SUCCESSFUL") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceKey) {
        return NextResponse.json(
          { error: "Configuration Supabase manquante" },
          { status: 500 }
        );
      }

      // Client service role (appelé uniquement par ce serveur)
      const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

      // ✅ Crédit ATOMIQUE via la RPC SQL credit_feeexpay_deposit :
      //    - verrouille le wallet (SELECT ... FOR UPDATE)
      //    - met à jour le dépôt → approved
      //    - crédite le wallet, insère la transaction ET la notification
      //      en UNE seule transaction (anti double-crédit garanti).
      const { data: rpcData, error: rpcError } = await adminClient.rpc("credit_feeexpay_deposit", {
        p_reference: reference,
      });

      if (rpcError) {
        console.error("credit_feeexpay_deposit RPC error:", rpcError);
        return NextResponse.json({ ...status, credited: false }, { status: 200 });
      }

      if (rpcData?.creditable) {
        return NextResponse.json({ ...status, credited: true });
      }
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("FeeXPay status error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la vérification" }, { status: 500 });
  }
}