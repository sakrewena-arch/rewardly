import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Route de DIAGNOSTIC : vérifie que les utilisateurs sont bien récupérables
 * depuis la base via le client admin.
 * URL : /api/debug-users
 */
export async function GET() {
  // 🔒 Authentification admin requise
  const user = await requireApiAdmin();
  if (!user) return unauthorizedResponse();

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({
      error: "Client admin non initialisé. Vérifiez SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  // 1. Tester le RPC get_users_with_details
  const { data: rpcData, error: rpcError } = await adminClient.rpc("get_users_with_details", {
    p_plan_slug: null,
  });

  // 2. Compter les profils directement
  const { count: profileCount, error: profileError } = await adminClient
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // 3. Compter les utilisateurs auth
  const { count: authCount, error: authError } = await adminClient
    .from("auth.users")
    .select("*", { count: "exact", head: true });

  // 4. Compter les wallets
  const { count: walletCount, error: walletError } = await adminClient
    .from("wallets")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({
    service_role_key_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    rpc_result: {
      data: rpcData,
      error: rpcError ? { message: rpcError.message, code: rpcError.code, details: rpcError.details, hint: rpcError.hint } : null,
    },
    profiles_count: profileCount,
    profiles_error: profileError ? profileError.message : null,
    auth_users_count: authCount,
    auth_users_error: authError ? authError.message : null,
    wallets_count: walletCount,
    wallets_error: walletError ? walletError.message : null,
  });
}