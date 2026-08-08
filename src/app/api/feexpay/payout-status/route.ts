import { checkPayoutStatus } from "@/lib/feexpay";
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
    const status = await checkPayoutStatus(reference);
    return NextResponse.json(status);
  } catch (error: any) {
    console.error("FeeXPay payout status error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la vérification" }, { status: 500 });
  }
}