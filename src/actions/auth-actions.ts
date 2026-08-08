"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Envoie un email de réinitialisation de mot de passe via Supabase Auth
 */
export async function resetPasswordAction(email: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase non configuré" };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password`,
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