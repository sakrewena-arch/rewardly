"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  icon: string | null;
  amount: number;
  amount_label?: string | null;
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
  const [todayCompletedTaskIds, setTodayCompletedTaskIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
      setTodayCompletedTaskIds([]);
      setSubmissions([]);
      setIsLoading(false);
      return;
    }

    try {
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

      // ✅ Tâches du jour (approved/pending) : le quota est de 1 tâche/jour,
      // toutes tâches confondues, pour TOUS les utilisateurs (plateforme gratuite).
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: todayData } = await supabase
        .from("task_submissions")
        .select("task_id")
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString())
        .in("status", ["approved", "pending"]);

      setTodayCompletedTaskIds((todayData || []).map((s: any) => s.task_id));

      // Fetch toutes les tâches actives — GRATUIT : aucune restriction de pack,
      // tous les utilisateurs peuvent accomplir toutes les tâches.
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (!tasksError && tasksData) {
        setTasks(tasksData as Task[]);
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

  // ============================================================
  // MODÈLE GRATUIT : 1 tâche par jour pour TOUS les utilisateurs.
  // Plus de packs ni d'investissements : toutes les tâches actives
  // sont accessibles, le quota quotidien est fixé à 1.
  // ============================================================
  const dailyLimit = 1;
  const isUnlimited = false;

  // Toutes les tâches actives (gratuit, sans restriction de plan)
  const allActiveTasks = tasks;

  // 🔁 PROGRESSION : on exclut les tâches DÉJÀ accomplies (soumissions
  //    approuvées ou en attente) pour proposer TOUJOURS la tâche SUIVANTE.
  //    → après 24h, l'utilisateur ne revoit plus la tâche de la veille.
  const alreadyDoneTaskIds = new Set(
    submissions
      .filter((s) => s.status === "approved" || s.status === "pending")
      .map((s) => s.task_id)
  );
  const remainingTasks = allActiveTasks.filter((t) => !alreadyDoneTaskIds.has(t.id));
  const availableTasks = remainingTasks;

  // ✅ Quota quotidien atteint ? (1 tâche complétée ou en attente aujourd'hui)
  const completedToday = todayCompletedTaskIds.length > 0 ? 1 : 0;

  // 🔒 Côté AFFICHAGE : UNE SEULE tâche par jour, et c'est la PROCHAINE
  //    non accomplie (0 tâche si le quota est atteint OU s'il ne reste
  //    aucune tâche à accomplir).
  const limitedTasks: Task[] =
    completedToday >= dailyLimit ? [] : remainingTasks.slice(0, dailyLimit);

  // Plus aucune tâche actives non accomplie → on affiche « patientez »
  const allTasksCompleted = remainingTasks.length === 0;

  const completeTask = useCallback(async (taskId: string) => {
    // ✅ Ajouter la tâche à la liste "aujourd'hui" (quota 1/jour)
    setTodayCompletedTaskIds((prev) => {
      if (prev.includes(taskId)) return prev;
      return [...prev, taskId];
    });
  }, []);

  // Refresh data
  const refreshTasks = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    tasks: limitedTasks,
    // allTasks = toutes les tâches actives (recherche / modales)
    allTasks: allActiveTasks,
    planTasks: limitedTasks,
    availableTasks,
    isLoading,
    dailyLimit,
    isUnlimited,
    completedToday,
    // Nombre de tâches encore disponibles AUJOURD'HUI (0 ou 1)
    totalPlanTasks: completedToday >= dailyLimit ? 0 : remainingTasks.length > 0 ? 1 : 0,
    allTasksCompleted,
    completeTask,
    refreshTasks,
    submissions,
    addSubmission,
    updateSubmissionStatus,
    // Champs de compatibilité (plus de packs) — conservés pour ne pas casser les pages
    hasPack: true,
    packExpired: false,
    userPlanSlug: null,
    investment: null,
  };
}