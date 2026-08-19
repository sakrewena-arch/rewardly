// Edge Function: process-deposit
// Traite un dépôt (approbation ou rejet) — ADMIN UNIQUEMENT (JWT vérifié)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminUser, unauthorizedResponse } from "../_shared/admin-auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 🔒 Authentification admin obligatoire (sinon 401)
  const admin = await verifyAdminUser(req);
  if (!admin) {
    return unauthorizedResponse(corsHeaders);
  }

  try {
    const { deposit_id, approve, comment } = await req.json();

    if (typeof approve !== "boolean") {
      return new Response(
        JSON.stringify({ error: "approve doit être un booléen" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deposit_id) {
      return new Response(
        JSON.stringify({ error: "deposit_id est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Jeu du admin_id depuis la session vérifiée (jamais depuis le body)
    const { data, error } = await supabase.rpc("validate_deposit", {
      p_deposit_id: deposit_id,
      p_admin_id: admin.id,
      p_approve: approve,
      p_comment: comment || null,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, result: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});