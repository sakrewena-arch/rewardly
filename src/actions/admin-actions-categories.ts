"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";


// ============ CATEGORIES ============

export async function getCategories() {
  // Utiliser le client admin (service role) pour contourner les problèmes de session/RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  const { data } = await supabase.from("task_categories").select("*").order("created_at");
  return data || [];
}
