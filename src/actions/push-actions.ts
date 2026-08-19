"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Enregistre (ou met à jour) le token de notification push de l'utilisateur
 * (FCM sur Android, APNs sur iOS). L'app web les récupère via le plugin
 * Capacitor @capacitor/push-notifications et les envoie ici.
 */
export async function registerPushTokenAction(platform: "android" | "ios" | "web", token: string) {
  if (!platform || !token || token.length < 10) {
    return { success: false, error: "Paramètres invalides" };
  }

  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      platform,
      token,
    },
    { onConflict: "user_id, token" }
  );

  if (error) {
    console.error("registerPushTokenAction error:", error.message);
    return { success: false, error: "Erreur lors de l'enregistrement du token" };
  }

  return { success: true };
}