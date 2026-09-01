"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  amount: number;
  estimated_time: number | null;
  duration_minutes: number | null;
  instructions: string | null;
  link: string | null;
  max_completions: number | null;
  deadline: string | null;
  category_id: string | null;
  plan_id: string | null;
  validation_type: "auto" | "manual";
  is_active: boolean;
  created_at: string;
  plan_slug?: string;
  plans?: { name: string; slug: string; daily_tasks?: number | null } | null;
}

interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  status: "active" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  plan?: { slug: string; name: string; daily_tasks: number };
}

interface Submission {
  id: string;
  task_id: string;
  status: string;
  created_at: string;
  task?: { title: string; amount: number } | null;
  submission_answers?: Array<{
    id: string;
    value: string;
    submission_fields?: { title: string; field_type: string } | null;
  }>;
}

export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [todayCompletedTaskIds, setTodayCompletedTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPack, setHasPack] = useState(false);
  const [packExpired, setPackExpired] = useState(false);
  const [userPlanSlug, setUserPlanSlug] = useState<string | null>(null);
  const [investment, setInvestment] = useState<Investment | null>(null);
  // Submissions state (in-memory + DB submissions)
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Register a submission
  const addSubmission = useCallback((
    taskId: string,
    taskTitle: string,
    amount: number,
    answers: Record<string, string>
  ) => {
    const newSubmission: Submission = {
      id: "sub-" + Date.now(),
      task_id: taskId,
      task: { title: taskTitle, amount },
      status: "pending",
      created_at: new Date().toISOString(),
      submission_answers: Object.entries(answers).map(([fieldId, value]) => ({
        id: "ans-" + Math.random().toString(36).slice(2),
        value,
        submission_fields: { title: "Preuve fournie", field_type: "text" },
      })),
    };
    setSubmissions((prev) => [newSubmission, ...prev]);
    return newSubmission;
  }, []);

  // Update a submission status (called after admin approves/rejects)
  const updateSubmissionStatus = useCallback((submissionId: string, status: string, comment?: string) => {
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId ? { ...s, status, admin_comment: comment || (s as any).admin_comment || null } : s
      )
    );
  }, []);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    if (!supabase || !user) {
      setTasks([]);
      setHasPack(false);
      setPackExpired(false);
      setInvestment(null);
      setUserPlanSlug(null);
      setCompletedTaskIds([]);
      setTodayCompletedTaskIds([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch active investment
      const { data: invData, error: invError } = await supabase
        .from("investments")
        .select("*, plan:plans(slug, name, daily_tasks)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!invError && invData) {
        const inv = invData as Investment;
        setInvestment(inv);
        setHasPack(true);

        // Check if pack has expired
        const endDate = new Date(inv.end_date);
        const now = new Date();
        const isExpired = endDate < now;
        setPackExpired(isExpired);

        if (isExpired) {
          // Pack expired - mark investment as completed
          await supabase
            .from("investments")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", inv.id);
          setHasPack(false);
          setUserPlanSlug(null);
        } else {
          setUserPlanSlug(inv.plan?.slug || null);
        }
      } else {
        setHasPack(false);
        setPackExpired(false);
        setInvestment(null);
        setUserPlanSlug(null);
      }

      // Fetch ALL completed submissions for this user (approved or pending)
      // Une tâche accomplie est DÉFINITIVE - on ne peut plus la refaire même après plusieurs jours
      const { data: completedData, error: completedError } = await supabase
        .from("task_submissions")
        .select("task_id, status, created_at")
        .eq("user_id", user.id)
        .in("status", ["approved", "pending"]);

      if (!completedError) {
        // Don't add pending submissions for tasks with auto-validation to the completed set
        // (they get approved immediately). For manual tasks, block them during pending review.
        const dbCompleted = (completedData || []).map((s: any) => s.task_id);
        setCompletedTaskIds(dbCompleted);

        // ✅ Ne compter que les tâches complétées AUJOURD'HUI
        const today = new Date().toDateString();
        const todayCompleted = (completedData || [])
          .filter((s: any) => new Date(s.created_at).toDateString() === today)
          .map((s: any) => s.task_id);
        setTodayCompletedTaskIds(todayCompleted);
      }

      // Fetch ALL user submissions for history (500 max - pour voir tout l'historique)
      const { data: allSubmissions } = await supabase
        .from("task_submissions")
        .select("*, tasks(title, amount)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);

      if (allSubmissions && allSubmissions.length > 0) {
        setSubmissions(allSubmissions as Submission[]);
      } else {
        setSubmissions([]);
      }

      // Fetch tasks from database
      // 📌 Ordre chronologique : la tâche postée EN PREMIER s'affiche en
      // PREMIER (created_at ASC), puis la suivante, etc.
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*, plans(name, slug, daily_tasks)")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!tasksError && tasksData) {
        const normalizedTasks = (tasksData as Array<any>).map((task) => ({
          ...task,
          plan_slug: task.plans?.slug || task.plan_slug || null,
        })) as Task[];
        setTasks(normalizedTasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute daily limit
  const dailyLimit = investment?.plan?.daily_tasks || 0;
  const isUnlimited = dailyLimit === -1;

  // Filter tasks based on user's plan
  const planTasks = useMemo(() => {
    if (!userPlanSlug || packExpired) return [];
    return tasks.filter((task) => {
      if (task.plan_slug === "all" || !task.plan_slug) return true;
      return task.plan_slug === userPlanSlug;
    });
  }, [tasks, userPlanSlug, packExpired]);

  // Available tasks = plan tasks not yet completed (ever)
  const availableTasks = useMemo(
    () => planTasks.filter((task) => !completedTaskIds.includes(task.id)),
    [planTasks, completedTaskIds]
  );

  // ✅ Completed TODAY (only counting tasks completed TODAY from this plan)
  const completedToday = useMemo(
    () => todayCompletedTaskIds.filter((id) => planTasks.some((t) => t.id === id)).length,
    [todayCompletedTaskIds, planTasks]
  );

  // Toutes les tâches du plan ont-elles été complétées ?
  // Une tâche accomplie est DÉFINITIVE - on ne peut plus la refaire
  const allTasksCompleted = useMemo(
    () => planTasks.length > 0 && availableTasks.length === 0,
    [planTasks, availableTasks]
  );

  // Daily limit logic
  let limitedTasks: Task[];
  if (isUnlimited) {
    limitedTasks = availableTasks;
  } else if (dailyLimit > 0 && completedToday >= dailyLimit) {
    limitedTasks = [];
  } else {
    const remaining = Math.max(0, dailyLimit - completedToday);
    limitedTasks = availableTasks.slice(0, remaining);
  }
  const totalPlanTasks = planTasks.length;

  const completeTask = useCallback(async (taskId: string) => {
    setCompletedTaskIds((prev) => {
      if (prev.includes(taskId)) return prev;
      return [...prev, taskId];
    });
    // ✅ Ajouter aussi à la liste "aujourd'hui"
    setTodayCompletedTaskIds((prev) => {
      if (prev.includes(taskId)) return prev;
      return [...prev, taskId];
    });
  }, []);

  // Refresh wallet-related data
  const refreshTasks = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    tasks: limitedTasks,
    allTasks: tasks,
    planTasks,
    availableTasks,
    investment,
    isLoading,
    hasPack,
    packExpired,
    userPlanSlug,
    dailyLimit,
    isUnlimited,
    completedToday,
    totalPlanTasks,
    allTasksCompleted,
    completeTask,
    refreshTasks,
    submissions,
    addSubmission,
    updateSubmissionStatus,
  };
}