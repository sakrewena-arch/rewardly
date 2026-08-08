import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Route de DIAGNOSTIC : vérifie si le compte admin existe dans Supabase Auth.
 * URL : /api/debug-admin
 */
export async function GET() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({
      error: "Client admin non initialisé. Vérifiez SUPABASE_SERVICE_ROLE_KEY",
    });
  }

  const email = "wlagbema@gmail.com";

  // 1. Lister les utilisateurs via l'API admin
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 100 });

  if (error) {
    return NextResponse.json({
      error: `Erreur listUsers: ${error.message}`,
      code: error.status,
    });
  }

  // 2. Chercher l'utilisateur par email
  const user = data.users.find((u) => u.email === email);

  return NextResponse.json({
    service_role_key_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    total_users_in_auth: data.users.length,
    admin_account_exists: !!user,
    admin_account: user
      ? {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          banned_until: user.banned_until,
        }
      : null,
  });
}