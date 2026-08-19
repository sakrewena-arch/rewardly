"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "./admin-actions-helpers";
import { revalidatePath } from "next/cache";

import type { CreateTaskInput } from "@/types/admin";


// ============ TASKS ============

export async function getTasks(planId?: string) {
  // 🔒 Vérification : admin uniquement
  const admin = await requireAdmin();
  if (!admin) return [];

  // Use admin client to bypass RLS for admin listing
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  let query = supabase
    .from("tasks")
    .select("*, plans(name, slug, daily_tasks), task_categories(name, slug)")
    .order("created_at", { ascending: false });
  if (planId) {
    query = query.eq("plan_id", planId);
  }
  const { data, error } = await query;
  if (error) {
    console.error("getTasks error", error);
    return [];
  }
  return data || [];
}

export async function getTaskFields(taskId: string) {
  // Utiliser le client admin (service role) pour contourner les problèmes de session/RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return [];
  const { data } = await supabase
    .from("submission_fields")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order");
  return data || [];
}

export async function createTaskAction(input: CreateTaskInput) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  // Utiliser le client admin (service role) pour contourner les problèmes de session/RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data, error } = await supabase.rpc("create_task", {
    p_admin_id: admin.id,
    p_title: input.title,
    p_description: input.description || null,
    p_amount: input.amount,
    p_plan_id: input.plan_id || null,
    p_category_id: input.category_id || null,
    p_icon: input.icon || "📋",
    p_estimated_time: input.estimated_time ?? null,
    p_instructions: input.instructions || null,
    p_link: input.link || null,
    p_max_completions: input.max_completions ?? null,
    p_duration_minutes: input.duration_minutes ?? null,
    p_deadline: input.deadline || null,
    p_validation_type: input.validation_type,
    p_fields: input.fields && input.fields.length > 0 ? JSON.parse(JSON.stringify(input.fields)) : null,
  });
  if (error) {
    console.error("Create task RPC error:", error);
    return { success: false, error: `Erreur SQL: ${error.message}` };
  }
  // The RPC returns a JSONB with success and task_id. Fetch the created task to return a canonical object
  try {
    const rpcResult: any = data;
    const taskId = rpcResult?.task_id || (rpcResult?.task && rpcResult.task.id) || null;
    if (taskId) {
      // Try fetching with the current client first
      let taskData = null;
      let taskError = null;
      try {
        const res = await supabase
          .from("tasks")
          .select("*, plans(name, slug), task_categories(name, slug)")
          .eq("id", taskId)
          .single();
        taskData = (res as any).data;
        taskError = (res as any).error;
      } catch (e) {
        console.error("Fetch with user client failed:", e);
      }

      // If fetching failed (possibly due to RLS), try with admin client
      if (!taskData) {
        try {
          const adminClient = createAdminClient();
          if (adminClient) {
            const res2 = await adminClient
              .from("tasks")
              .select("*, plans(name, slug), task_categories(name, slug)")
              .eq("id", taskId)
              .single();
            taskData = (res2 as any).data;
            taskError = (res2 as any).error;
          }
        } catch (e) {
          console.error("Fetch with admin client failed:", e);
        }
      }

      if (taskError) {
        console.error("Failed to fetch created task:", taskError);
      }

      revalidatePath("/admin/tasks");
      return { success: true, task: taskData || null, task_id: taskId };
    }
  } catch (e) {
    console.error("Error while fetching created task:", e);
  }

  revalidatePath("/admin/tasks");
  return data || { success: false, error: "Aucun résultat retourné — vérifiez que la migration create_task est exécutée" };
}

export async function updateTaskAction(input: {
  task_id: string;
  title?: string;
  description?: string;
  amount?: number;
  plan_id?: string;
  icon?: string;
  estimated_time?: number;
  instructions?: string;
  link?: string;
  max_completions?: number;
  duration_minutes?: number;
  deadline?: string;
  validation_type?: "auto" | "manual";
  is_active?: boolean;
}) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  const supabase = await createClient();
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data } = await supabase.rpc("update_task", {
    p_admin_id: admin.id,
    p_task_id: input.task_id,
    p_title: input.title || null,
    p_description: input.description || null,
    p_amount: input.amount ?? null,
    p_plan_id: input.plan_id || null,
    p_icon: input.icon || null,
    p_estimated_time: input.estimated_time ?? null,
    p_instructions: input.instructions || null,
    p_link: input.link || null,
    p_max_completions: input.max_completions ?? null,
    p_duration_minutes: input.duration_minutes ?? null,
    p_deadline: input.deadline || null,
    p_validation_type: input.validation_type || null,
    p_is_active: input.is_active ?? null,
  });
  revalidatePath("/admin/tasks");
  return data;
}

export async function deleteTaskAction(taskId: string) {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Non autorisé" };
  // Utiliser le client admin (service role) pour contourner les problèmes de session/RLS
  const adminClient = createAdminClient();
  const supabase = adminClient || (await createClient());
  if (!supabase) return { success: false, error: "Supabase non configuré" };
  const { data, error } = await supabase.rpc("delete_task", {
    p_admin_id: admin.id,
    p_task_id: taskId,
  });
  if (error) {
    console.error("deleteTaskAction error:", error);
    return { success: false, error: error.message };
  }
  revalidatePath("/admin/tasks");
  return data;
}
