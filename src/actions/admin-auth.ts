"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Admin login: authenticates via Supabase, checks the admin role,
 * and sets a separate admin session cookie.
 * A normal user login does NOT set this cookie, so normal users
 * cannot access admin pages.
 */
export async function adminLogin(email: string, password: string) {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase non configuré" };
  }

  // Sign in via Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Email ou mot de passe incorrect" };
  }

  const user = data.user;
  if (!user) {
    return { error: "Utilisateur introuvable" };
  }

  // Check admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  if (!isAdmin) {
    // Not an admin — sign out the auth session so this account isn't
    // treated as an admin-accessible session
    await supabase.auth.signOut();
    return { error: "Ce compte n'est pas autorisé à accéder à l'administration." };
  }

  // Set the admin session cookie (separate from the normal user session)
  // httpOnly empêche JavaScript de le modifier (protection XSS)
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });

  redirect("/admin");
}

/**
 * Admin logout: removes the admin session cookie.
 * (The Supabase auth session stays intact if the visitor had one —
 * admin logout only clears the separate admin cookie.)
 */
export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}

/**
 * Check if the current request has a valid admin session cookie.
 * Use in server components/layouts that guard admin pages.
 */
export async function hasAdminSession() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value === "true";
}
