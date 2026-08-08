"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAdmin) return null;

  return { id: user.id };
}

/**
 * Récupère tous les paramètres système depuis la base
 */
export async function getSystemSettingsFromDB() {
  const supabase = await createClient();
  if (!supabase) return {};

  const { data } = await supabase.from("system_settings").select("key, value");
  const settings: Record<string, any> = {};
  data?.forEach((s) => {
    settings[s.key] = s.value;
  });
  return settings;
}

/**
 * Sauvegarde les paramètres système en base (admin uniquement)
 */
export async function saveSystemSettingsAction(settings: Record<string, string>) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const entries = Object.entries(settings);
  for (const [key, value] of entries) {
    // Upsert each setting
    const { error } = await supabase
      .from("system_settings")
      .upsert(
        { key, value: JSON.parse(value), description: `Paramètre ${key}` },
        { onConflict: "key" }
      );
    if (error) {
      console.error(`Failed to save setting ${key}:`, error);
    }
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

/**
 * Récupère les notifications non lues pour l'utilisateur connecté
 */
export async function getUnreadNotificationsCount() {
  const supabase = await createClient();
  if (!supabase) return 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .eq("is_read", false);

  return count || 0;
}