import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { initiatePayout } from "@/lib/feexpay";
import { NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    // 🔒 Authentification requise
    const user = await requireApiUser(request);
    if (!user) return unauthorizedResponse();

    const { network, phoneNumber, amount, motif } = await request.json();

    if (!network || !phoneNumber || !amount) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    // 🔒 Le userId est dérivé de la session, pas du body
    const userId = user.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase non configuré" }, { status: 500 });
    }

    // ✅ Client direct (fiable dans les Route Handlers)
    const adminClient = createSupabaseClient(supabaseUrl, serviceKey);

    // Vérifier le solde de l'utilisateur
    const { data: wallet } = await adminClient
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!wallet || (wallet.balance || 0) < amount) {
      return NextResponse.json({ error: "Solde insuffisant" }, { status: 400 });
    }

    // ⚠️ NE PAS envoyer l'argent ici !
    // Le payout FeeXPay est déclenché UNIQUEMENT quand l'admin valide le retrait
    // (statut "paid" dans /admin/withdrawals). Cela évite d'envoyer l'argent
    // sans validation admin.

    // ✅ Débiter le wallet IMMÉDIATEMENT (le montant est réservé)
    const { error: walletError } = await adminClient
      .from("wallets")
      .update({
        balance: (wallet.balance || 0) - amount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (walletError) {
      console.error("Wallet debit error:", walletError);
      return NextResponse.json({ error: "Erreur lors du débit du wallet" }, { status: 500 });
    }

    // Créer la transaction de débit
    const { data: insertedTx } = await adminClient
      .from("wallet_transactions")
      .insert({
        user_id: userId,
        wallet_id: wallet.id,
        amount: -amount,
        type: "withdrawal",
        description: `Retrait ${network} - ${motif || "Demande de retrait"}`,
        status: "pending",
      })
      .select("id")
      .single();

    // Créer la demande de retrait en base (en attente - confirmation admin requise)
    // ⚠️ La table withdrawals n'a PAS de colonne description → ne pas l'inclure
    const { data: inserted, error: insertError } = await adminClient.from("withdrawals").insert({
      user_id: userId,
      amount,
      method: network,
      account_info: phoneNumber,
      status: "pending",
    }).select("id").single();

    if (insertError) {
      console.error("Withdrawal insert error:", insertError);
      // Si l'insertion échoue, rembourser le wallet
      await adminClient
        .from("wallets")
        .update({
          balance: (wallet.balance || 0),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return NextResponse.json({ error: "Erreur lors de la création du retrait" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reference: inserted?.id || null,
      status: "PENDING",
      message: "Demande de retrait créée, en attente de validation admin.",
    });
  } catch (error: any) {
    console.error("FeeXPay payout error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors du retrait" }, { status: 500 });
  }
}