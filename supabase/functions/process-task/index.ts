// Edge Function: process-task
// Traite une tâche soumise (validation auto ou manuelle)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const { submission_id, action, admin_id, comment } = await req.json();

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "submission_id est requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;

    if (action === "approve") {
      const { data, error } = await supabase.rpc("approve_submission", {
        p_submission_id: submission_id,
        p_admin_id: admin_id,
        p_comment: comment || null,
      });
      if (error) throw error;
      result = data;
    } else if (action === "reject") {
      const { data, error } = await supabase.rpc("reject_submission", {
        p_submission_id: submission_id,
        p_admin_id: admin_id,
        p_comment: comment || null,
      });
      if (error) throw error;
      result = data;
    } else {
      return new Response(
        JSON.stringify({ error: "action doit être 'approve' ou 'reject'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});