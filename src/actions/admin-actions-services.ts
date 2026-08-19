"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


// ============ SERVICE ORDERS ============

export async function getServiceOrders() {
  const admin = await requireAdmin();
  if (!admin) return [];
  // Utiliser le client admin (service role) pour contourner les RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("service_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error("getServiceOrders error:", error);
    return [];
  }
  return data || [];
}

export async function updateServiceOrderStatus(orderId: string, status: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  // Utiliser le client admin (service role) pour contourner les RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { error } = await supabase
    .from("service_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) {
    console.error("updateServiceOrderStatus error:", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/services");
  return { success: true };
}
