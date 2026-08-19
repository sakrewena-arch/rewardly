// Edge Function: send-notification
// Envoie une notification à un utilisateur ou à tous les utilisateurs — ADMIN UNIQUEMENT

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminUser, unauthorizedResponse } from "../_shared/admin-auth.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // CORS headers
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
    const { user_id, title, message, type } = await req.json();

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title et message sont requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notification = {
      user_id: user_id || null, // null = notification globale
      title,
      message,
      type: type || "admin",
      is_read: false,
    };

    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, notification: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});