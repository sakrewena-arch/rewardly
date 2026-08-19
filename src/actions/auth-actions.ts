"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Détermine l'URL réelle de l'hébergement depuis les headers de la requête.
 * En production le domaine consulté est toujours utilisé (jamais localhost).
 */
async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const protocol = h.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  if (host) return `${protocol}://${host}`;
  // Dernier recours : l'URL publique configurée, sinon le domaine de prod
  // (jamais un fallback localhost dans un email envoyé en production).
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !/^https?:\/\/localhost(:\d+)?$/.test(configured)) {
    return configured;
  }
  return "https://rewardly.vercel.app";
}

/**
 * Envoie un email de réinitialisation de mot de passe via Supabase Auth
 */
export async function resetPasswordAction(email: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase non configuré" };

  const baseUrl = await getRequestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${baseUrl.replace(/\/$/, "")}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Met à jour le mot de passe de l'utilisateur connecté
 */
export async function updatePasswordAction(newPassword: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase non configuré" };

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}