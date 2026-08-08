import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { checkPayinStatus } from "@/lib/feexpay";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  // 🔒 Authentification requise
  const user = await requireApiUser(request);
  if (!user) return unauthorizedResponse();

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

      // ✅ Client direct (fiable dans les Route Handlers)
      const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

      // 1. Récupérer le dépôt (la colonne est "reference", pas "feexpay_reference")
      const { data: deposit } = await adminClient
        .from("deposits")
        .select("user_id, amount, status")
        .eq("reference", reference)
        .single();

      if (deposit) {
        // ✅ Anti double-crédit : seulement si le dépôt est encore "pending"
        if (deposit.status === "pending") {
          // 2. Mettre à jour le statut du dépôt
          await adminClient
            .from("deposits")
            .update({ status: "approved", updated_at: new Date().toISOString() })
            .eq("reference", reference);

          // 3. Créditer le wallet automatiquement
          const { data: wallet } = await adminClient
            .from("wallets")
            .select("*")
            .eq("user_id", deposit.user_id)
            .single();

          if (wallet) {
            await adminClient
              .from("wallets")
              .update({
                balance: (wallet.balance || 0) + deposit.amount,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", deposit.user_id);

            // 4. Créer la transaction
            await adminClient.from("wallet_transactions").insert({
              user_id: deposit.user_id,
              wallet_id: wallet.id,
              amount: deposit.amount,
              type: "deposit",
              description: `Dépôt via FeeXPay (${reference})`,
              status: "completed",
            });

            // 5. Notifier l'utilisateur
            await adminClient.from("notifications").insert({
              user_id: deposit.user_id,
              title: "Dépôt confirmé ✅",
              message: `Votre dépôt de ${deposit.amount} FCFA a été crédité automatiquement.`,
              type: "deposit",
              is_read: false,
            });
          }
        }

        return NextResponse.json({ ...status, credited: true });
      }
    }

    return NextResponse.json(status);
  } catch (error: any) {
    console.error("FeeXPay status error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la vérification" }, { status: 500 });
  }
}