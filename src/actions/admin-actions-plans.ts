"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";


// ============ PLANS ============

export async function getPlans(includeInactive = false) {
  // Utiliser le client admin (service role) pour contourner les problèmes de session/RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  let query = supabase.from("plans").select("*").order("sort_order");
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query;
  if (error) {
    console.error("getPlans error:", error);
    return [];
  }
  return data || [];
}

export async function createPlanAction(input: {
  name: string;
  slug: string;
  price: number;
  daily_tasks: number;
  min_profitability: number;
  max_profitability: number;
  color?: string;
  icon?: string;
  badge?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("create_plan", {
    p_admin_id: admin.id,
    p_name: input.name,
    p_slug: input.slug,
    p_price: input.price,
    p_daily_tasks: input.daily_tasks,
    p_min_profitability: input.min_profitability,
    p_max_profitability: input.max_profitability,
    p_color: input.color || "#9D3FE7",
    p_icon: input.icon || "Medal",
    p_badge: input.badge || "Standard",
  });
  revalidatePath("/admin/plans");
  return data;
}

export async function updatePlanAction(input: {
  planId: string;
  name?: string;
  price?: number;
  daily_tasks?: number;
  min_profitability?: number;
  max_profitability?: number;
  color?: string;
  icon?: string;
  badge?: string;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("update_plan", {
    p_admin_id: admin.id,
    p_plan_id: input.planId,
    p_name: input.name || null,
    p_price: input.price ?? null,
    p_daily_tasks: input.daily_tasks ?? null,
    p_min_profitability: input.min_profitability ?? null,
    p_max_profitability: input.max_profitability ?? null,
    p_color: input.color || null,
    p_icon: input.icon || null,
    p_badge: input.badge || null,
  });
  revalidatePath("/admin/plans");
  return data;
}

export async function togglePlanStatusAction(planId: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("toggle_plan_status", {
    p_admin_id: admin.id,
    p_plan_id: planId,
    p_is_active: isActive,
  });
  revalidatePath("/admin/plans");
  return data;
}
