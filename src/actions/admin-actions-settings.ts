"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";


// ============ SYSTEM SETTINGS ============

export async function getSystemSettings() {
  const supabase = await createClient();
  if (!supabase) return {};
  const { data } = await supabase.from("system_settings").select("key, value");
  const settings: Record<string, any> = {};
  data?.forEach((s) => {
    settings[s.key] = s.value;
  });
  return settings;
}

export async function getPaymentMethods() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase.from("payment_methods").select("*").eq("is_active", true);
  return data || [];
}
