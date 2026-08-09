"use client";

import { motion } from "framer-motion";
import { Clock, Search, Lock, CheckCircle, Info, Sparkles, Check, ArrowRight, Crown, Star, Zap, Upload, Link2, Type, Hash, Image, Video, MessageCircle, Send, ExternalLink, X, Share2, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { submitTaskAction } from "@/actions/user-actions";
import { getTaskFields } from "@/actions/admin-actions";
import { createClient } from "@/lib/supabase/client";
import { useNav } from "@/context/NavContext";

const availablePlans = [
  { name: "Bronze", slug: "bronze", price: 5000, tasks: "1 tâche/jour", profitability: "10% - 20%", badge: "Bronze", color: "from-amber-700 to-amber-600", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/20" },
  { name: "Silver", slug: "silver", price: 10000, tasks: "3 tâches/jour", profitability: "20% - 30%", badge: "Silver", color: "from-gray-400 to-gray-300", badgeColor: "bg-gray-100 text-gray-600 dark:bg-gray-500/20" },
  { name: "Gold", slug: "gold", price: 20000, tasks: "Toutes les tâches", profitability: "40% - 50%", badge: "Premium", color: "from-yellow-500 to-yellow-400", badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20" },
];

interface TaskField {
  id: string;
  title: string;
  description: string | null;
  field_type: string;
  is_required: boolean;
  placeholder: string | null;
}

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { tasks, allTasks, investment, isLoading, hasPack, userPlanSlug, dailyLimit, isUnlimited, completedToday, totalPlanTasks, completeTask, addSubmission, allTasksCompleted } = useTasks();
  const { addReward } = useWallet();
  const [search, setSearch] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [showPending, setShowPending] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState<string | null>(null);
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Also check localStorage directly for plan slug
  const localPlanSlug = typeof window !== "undefined" ? localStorage.getItem("rewardly_plan_slug") : null;
  const effectivePlanSlug = userPlanSlug || localPlanSlug;

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  const openTaskModal = async (taskId: string) => {
    setShowTaskModal(taskId);
    setAnswers({});
    setSubmitError(null);
    try {
      const fields = await getTaskFields(taskId);
      setTaskFields(fields || []);
    } catch (e) {
      setTaskFields([]);
    }
  };

  // State to track which task's link has been opened (needs confirmation)
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Share task state (single object for the share modal)
  const [shareModal, setShareModal] = useState<{
    open: boolean;
    taskId: string;
    title: string;
    amount: number;
    link: string;
    mediaType: "" | "image" | "video";
    mediaData: string;
    app: string;
    target: string;
    targetCount: number;
    shareCount: number;
    instructions: string;
    step: "share" | "watch" | "complete";
    videoWatched: boolean;
    imageViewed: boolean;
  } | null>(null);

  // Parse [MEDIA] info from task instructions (image/video)
  const parseMediaInfo = (task: any) => {
    const instructions = task.instructions || "";
    const match = instructions.match(/\[MEDIA\] type=(\w+) data=(data:[^\s]+)/);
    if (!match) return null;
    return {
      type: match[1] as "image" | "video",
      data: match[2],
      cleanInstructions: instructions.replace(/\[MEDIA\] type=\w+ data=data:[^\s]+\n?/, ""),
    };
  };

  // Video completion state
  const [videoWatched, setVideoWatched] = useState<Record<string, boolean>>({});
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);

  // 🧭 Masquer la barre de navigation pendant qu'un popup plein écran est ouvert
  // (validation manuelle, partage) pour que rien ne soit masqué.
  const shareModalOpen = Boolean(shareModal?.open);
  const { hideNav, showNav } = useNav();

  useEffect(() => {
    if (showTaskModal || shareModalOpen) {
      hideNav(true);
    } else {
      showNav();
    }
  }, [showTaskModal, shareModalOpen, hideNav, showNav]);

  // Parse [SHARE] info from task instructions
  const parseShareInfo = (task: any) => {
    const instructions = task.instructions || "";
    const match = instructions.match(/\[SHARE\] app=(\w+) target=(\w+) count=(\d+)/);
    if (!match) return null;
    return {
      app: match[1],
      target: match[2],
      count: parseInt(match[3], 10) || 1,
      cleanInstructions: instructions.replace(/\[SHARE\] app=\w+ target=\w+ count=\d+\n?/, ""),
    };
  };

  // Open share modal for a task (also for media tasks with [SHARE] info)
  const openShareModal = (task: any) => {
    const info = parseShareInfo(task);
    if (!info) return;
    const media = parseMediaInfo(task);
    // Nettoyer les instructions : retirer [SHARE] ET [MEDIA]
    const cleanInstructions = (task.instructions || "")
      .replace(/\[SHARE\] app=\w+ target=\w+ count=\d+\n?/g, "")
      .replace(/\[MEDIA\] type=\w+ data=data:[^\s]+\n?/g, "")
      .trim();
    setShareModal({
      open: true,
      taskId: task.id,
      title: task.title,
      amount: task.amount,
      link: task.link || "",
      mediaType: media?.type || "",
      mediaData: media?.data || "",
      app: info.app,
      target: info.target,
      targetCount: info.count,
      shareCount: 0,
      instructions: cleanInstructions,
      step: "share",
      videoWatched: false,
      imageViewed: false,
    });
  };

  // Copy the link to share to clipboard
  const copyShareLink = () => {
    if (!shareModal) return;
    const link = shareModal.link ? normalizeUrl(shareModal.link) : window.location.href;
    navigator.clipboard.writeText(link);
    alert("Lien copié dans le presse-papiers !");
  };

  // Increment share count (user clicked "J'ai partagé")
  const incrementShare = () => {
    if (!shareModal) return;
    const newCount = shareModal.shareCount + 1;
    setShareModal({ ...shareModal, shareCount: newCount });
    // If target reached, move to "watch" step (must watch media before validating)
    if (newCount >= shareModal.targetCount) {
      setShareModal({ ...shareModal, shareCount: newCount, step: "watch" });
    }
  };

  // Convert a base64 data URL to a File for sharing (image/video)
  const base64ToFile = (dataUrl: string): File | null => {
    try {
      const [meta, base64] = dataUrl.split(",");
      const mime = meta.match(/data:(.*?);/)?.[1] || "image/png";
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const ext = mime.includes("video") ? "mp4" : "jpg";
      return new File([byteArray], `partage.${ext}`, { type: mime });
    } catch (e) {
      return null;
    }
  };

  // Share the task element (link + image/video) via native share sheet
  // or deep links to the chosen app (WhatsApp, Telegram, Facebook...)
  // NOTE: Le partage n'incrémente PAS la progression automatiquement.
  // L'utilisateur doit cliquer sur "J'ai partagé" pour valider chaque partage.
  const shareViaApp = async () => {
    if (!shareModal) return;
    const text = `${shareModal.title} — Rejoignez-nous !`;
    const link = shareModal.link ? normalizeUrl(shareModal.link) : window.location.href;

    // Build files array (media) + link, share BOTH simultaneously
    const mediaFile = shareModal.mediaData ? base64ToFile(shareModal.mediaData) : null;
    const files = mediaFile ? [mediaFile] : [];

    // Try native Web Share API first (shares media + link together on mobile)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const shareData: any = { title: shareModal.title, text, url: link };
        if (files.length > 0 && navigator.canShare && navigator.canShare({ files })) {
          shareData.files = files;
        }
        await navigator.share(shareData);
        // NE PAS incrémenter ici — l'utilisateur doit cliquer "J'ai partagé"
        return;
      } catch (e) {
        // User cancelled — do nothing
        return;
      }
    }

    // Fallback: deep links to specific apps (link is shared; media shared manually)
    const encodedText = encodeURIComponent(`${text} ${link}`);
    const appLinks: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      instagram: `https://www.instagram.com/`,
      tiktok: `https://www.tiktok.com/`,
    };
    const url = appLinks[shareModal.app] || appLinks.whatsapp;
    window.open(url, "_blank");
    // NE PAS incrémenter ici — l'utilisateur doit cliquer "J'ai partagé"
  };

  // Normalize URL: add https:// if no protocol is present
  // (e.g. "26kado.com" → "https://26kado.com")
  const normalizeUrl = (link: string | null): string => {
    if (!link) return "";
    let url = link.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    return url;
  };

  // Step 1: open the task link (site, Telegram, WhatsApp...)
  const openTaskLink = (task: { id: string; link: string | null }) => {
    if (task.link) {
      window.open(normalizeUrl(task.link), "_blank");
    }
    // Show the confirm button to credit after completing the mission
    setConfirmingId(task.id);
  };

  // Step 2: user confirms the mission is done → credit
  const handleComplete = async (taskId: string, amount: number, title: string) => {
    setCompletingId(taskId);
    await new Promise((r) => setTimeout(r, 1000));
    
    // Use the RPC to create a submission + credit the wallet atomically
    const result = await submitTaskAction(taskId, {});
    if (result?.success || result?.auto_approved) {
      // RPC succeeded - submission + wallet credited
      addSubmission(taskId, title, amount, {});
      await completeTask(taskId);
      setCompletingId(null);
      setConfirmingId(null);
      setShowSuccess(taskId);
      setTimeout(() => setShowSuccess(null), 3000);
    } else {
      // Fallback: create submission + transaction + credit wallet directly via API
      console.error("submitTaskAction failed:", result?.error);
      try {
        const supabase = createClient();
        if (supabase && user) {
          // 1. Create submission (approved for auto tasks)
          const { data: subData } = await supabase
            .from("task_submissions")
            .insert({ user_id: user.id, task_id: taskId, status: "approved" })
            .select()
            .single();

          // 2. Get wallet
          const { data: walletData } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (walletData) {
            // 3. Update wallet balance + earnings
            await supabase
              .from("wallets")
              .update({
                balance: (walletData.balance || 0) + amount,
                total_earnings: (walletData.total_earnings || 0) + amount,
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", user.id);

            // 4. Create transaction
            await supabase.from("wallet_transactions").insert({
              user_id: user.id,
              wallet_id: walletData.id,
              amount,
              type: "reward",
              description: `Récompense : ${title}`,
              status: "completed",
            });
          }
        }
      } catch (e) {
        console.error("Fallback credit failed:", e);
      }
      // Also try addReward as last resort
      await addReward(amount, `Récompense : ${title}`);
      await completeTask(taskId);
      setCompletingId(null);
      setConfirmingId(null);
      setShowSuccess(taskId);
      setTimeout(() => setShowSuccess(null), 3000);
    }
  };

  const handleSubmitManual = async (taskId: string) => {
    // Validate required fields before submitting
    const missingRequired = taskFields.filter((f) => f.is_required && !answers[f.id]?.trim());
    if (missingRequired.length > 0) {
      setSubmitError("Veuillez remplir tous les champs obligatoires avant de soumettre.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitTaskAction(taskId, answers);
      if (result?.success) {
        // Register local submission (visible in admin validations + history with status)
        const taskInfo = allTasks.find((t) => t.id === taskId);
        addSubmission(taskId, taskInfo?.title || "Tâche", taskInfo?.amount || 0, answers);
        // Mark as completed locally so the task cannot be redone
        await completeTask(taskId);
        setShowTaskModal(null);
        setShowPending(taskId);
        setTimeout(() => setShowPending(null), 4000);
      } else {
        setSubmitError(result?.error || "Erreur lors de la soumission");
      }
    } catch (e) {
      setSubmitError("Erreur lors de la soumission");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Require authentication to view tasks
  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Tâches</h1>
          <p className="text-[#8A8A8A] text-sm mt-1">Accomplissez des tâches et gagnez de l'argent</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-8 text-center border border-amber-200 dark:border-amber-500/20"
        >
          <Lock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg mb-1">Connexion requise</h2>
          <p className="text-sm text-[#8A8A8A] mb-6">
            Créez un compte ou connectez-vous avant de continuer pour accomplir des tâches et gagner de l'argent.
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
              <Lock className="w-4 h-4 mr-2" /> Se connecter
            </Button>
            <Button size="lg" variant="outline" className="w-full" onClick={() => router.push("/register")}>
              Créer un compte
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!hasPack) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Tâches</h1>
          <p className="text-[#8A8A8A] text-sm mt-1">Choisissez un pack pour commencer</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 dark:bg-amber-500/10 rounded-2xl p-4 text-center border border-amber-200 dark:border-amber-500/20">
          <Lock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h2 className="font-semibold text-sm mb-1">Aucun pack actif</h2>
          <p className="text-xs text-[#8A8A8A]">Sélectionnez un pack ci-dessous pour accéder aux tâches</p>
        </motion.div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Packs disponibles</h2>
          {availablePlans.map((plan, index) => (
            <motion.div key={plan.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="overflow-hidden">
                <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div><h3 className="font-semibold text-lg">{plan.name}</h3><p className="text-2xl font-bold mt-1">{formatCurrency(plan.price)}</p></div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${plan.badgeColor}`}>{plan.badge}</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm"><span className="text-[#8A8A8A]">Tâches</span><span className="font-medium">{plan.tasks}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-[#8A8A8A]">Rentabilité</span><span className="font-medium text-green-500">{plan.profitability}</span></div>
                  </div>
                  <Button className="w-full" variant={plan.name === "Gold" ? "purple" : "outline"} onClick={() => router.push(`/invest?plan=${plan.slug}`)}>
                    <ArrowRight className="w-4 h-4 mr-2" /> Choisir ce pack
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Tâches</h1>
        <p className="text-[#8A8A8A] text-sm mt-1">
          {completedToday}/{isUnlimited ? "∞" : dailyLimit} tâche{isUnlimited ? "s" : dailyLimit > 1 ? "s" : ""} aujourd'hui
          {!isUnlimited && dailyLimit > 0 && ` • ${totalPlanTasks} tâche${totalPlanTasks > 1 ? "s" : ""} disponible${totalPlanTasks > 1 ? "s" : ""}`}
        </p>
      </motion.div>

      {investment && (
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3 flex items-center gap-3">
          <Info className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <div className="text-sm text-purple-700 dark:text-purple-300">
            Pack <strong>{investment.plan?.name || effectivePlanSlug}</strong> • 
            {isUnlimited ? "Tâches illimitées" : `${dailyLimit} tâche${dailyLimit > 1 ? "s" : ""}/jour`} • 
            {completedToday} effectuée{completedToday > 1 ? "s" : ""} aujourd'hui
          </div>
        </div>
      )}

      {/* Upgrade Banner - visible for non-Gold users */}
      {effectivePlanSlug && effectivePlanSlug !== "gold" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-2xl p-4 text-white"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold">Améliorez votre plan</span>
            </div>
            <span className="text-xs text-purple-200">Débloquez plus</span>
          </div>
          <div className="flex gap-2">
            {effectivePlanSlug === "bronze" && (
              <>
                <Button size="sm" className="flex-1 bg-white/20 hover:bg-white/30 text-white border border-white/20" onClick={() => router.push("/invest?plan=silver")}>
                  <Star className="w-3 h-3 mr-1" /> Silver
                </Button>
                <Button size="sm" className="flex-1 bg-yellow-400 text-purple-900 hover:bg-yellow-300" onClick={() => router.push("/invest?plan=gold")}>
                  <Crown className="w-3 h-3 mr-1" /> Gold
                </Button>
              </>
            )}
            {effectivePlanSlug === "silver" && (
              <Button size="sm" className="flex-1 bg-yellow-400 text-purple-900 hover:bg-yellow-300" onClick={() => router.push("/invest?plan=gold")}>
                <Crown className="w-3 h-3 mr-1" /> Passer à Gold
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {showSuccess && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 dark:bg-green-500/10 rounded-xl p-3 flex items-center gap-3 border border-green-200 dark:border-green-500/20">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div className="text-sm text-green-700 dark:text-green-300">
            <strong>Récompense créditée !</strong> Le montant a été ajouté à votre wallet.
          </div>
        </motion.div>
      )}
      {showPending && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 flex items-center gap-3 border border-amber-200 dark:border-amber-500/20">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Preuve soumise !</strong> En attente de validation par un administrateur. Vous serez crédité après approbation.
          </div>
        </motion.div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
        <Input placeholder="Rechercher une tâche..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            {allTasksCompleted ? (
              <>
                <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="font-semibold text-[#111111] dark:text-white">
                  Pas de nouvelles tâches pour le moment
                </p>
                <p className="text-sm text-[#8A8A8A] mt-1">
                  Veuillez patienter ou repassez dans quelques heures le temps que les tâches soient ajoutées.
                </p>
              </>
            ) : completedToday >= dailyLimit && !isUnlimited ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-[#8A8A8A] text-sm">
                  Limite quotidienne atteinte ! Revenez demain pour de nouvelles tâches.
                </p>
                <p className="text-xs text-[#8A8A8A] mt-2">
                  Vous avez accompli {completedToday}/{dailyLimit} tâche{completedToday > 1 ? "s" : ""} aujourd'hui
                </p>
              </>
            ) : (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-[#8A8A8A] text-sm">Aucune tâche trouvée</p>
              </>
            )}
          </div>
        ) : (
          filteredTasks.map((task, index) => (
            <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-xl flex-shrink-0">{task.icon || "📋"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm">{task.title}</h3>
                          <p className="text-xs text-[#8A8A8A] mt-0.5">{task.description}</p>
                        </div>
                        <span className="text-sm font-bold text-green-500 whitespace-nowrap">+{formatCurrency(task.amount)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        {task.estimated_time && <span className="flex items-center gap-1 text-xs text-[#8A8A8A]"><Clock className="w-3 h-3" /> {task.estimated_time} min</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${task.validation_type === "auto" ? "bg-green-100 text-green-700 dark:bg-green-500/20" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20"}`}>
                          {task.validation_type === "auto" ? "Auto" : "Manuel"}
                        </span>
                      </div>
                      {parseMediaInfo(task) ? (() => {
                        const media = parseMediaInfo(task);
                        // Si la tâche a AUSSI un partage [SHARE], on affiche SEULEMENT "Partager"
                        // L'utilisateur doit passer par la modal (partage → regarder → valider)
                        const hasShare = parseShareInfo(task);
                        if (hasShare) {
                          return (
                            <div className="mt-3 space-y-2">
                              {media?.type === "image" ? (
                                <img src={media.data} alt={task.title} className="w-full rounded-xl max-h-60 object-contain bg-gray-50 dark:bg-white/5" />
                              ) : (
                                <video
                                  src={media?.data}
                                  controls
                                  className="w-full rounded-xl max-h-60 bg-black"
                                />
                              )}
                              <Button size="sm" className="w-full bg-purple-500 hover:bg-purple-600" onClick={() => openShareModal(task)}>
                                <Share2 className="w-3 h-3 mr-1" /> Partager et gagner {formatCurrency(task.amount)}
                              </Button>
                            </div>
                          );
                        }
                        return (
                          <div className="mt-3 space-y-2">
                            {media?.type === "image" ? (
                              <img src={media.data} alt={task.title} className="w-full rounded-xl max-h-60 object-contain bg-gray-50 dark:bg-white/5" />
                            ) : (
                              <video
                                src={media?.data}
                                controls
                                className="w-full rounded-xl max-h-60 bg-black"
                                onEnded={() => setVideoWatched((prev) => ({ ...prev, [task.id]: true }))}
                              />
                            )}
                            {media?.type === "video" ? (
                              videoWatched[task.id] ? (
                                <Button size="sm" className="w-full bg-green-500 hover:bg-green-600" onClick={() => handleComplete(task.id, task.amount, task.title)}>
                                  <Check className="w-3 h-3 mr-1" /> J'ai regardé — {formatCurrency(task.amount)} crédité
                                </Button>
                              ) : (
                                <Button size="sm" className="w-full" disabled>
                                  <Sparkles className="w-3 h-3 mr-1" /> Regardez la vidéo jusqu'à la fin
                                </Button>
                              )
                            ) : (
                              <Button size="sm" className="w-full bg-green-500 hover:bg-green-600" onClick={() => handleComplete(task.id, task.amount, task.title)}>
                                <Check className="w-3 h-3 mr-1" /> J'ai vu l'image — {formatCurrency(task.amount)} crédité
                              </Button>
                            )}
                          </div>
                        );
                      })() : parseShareInfo(task) ? (
                        // Share task: open share modal with progress
                        <Button
                          size="sm"
                          className="mt-3 w-full bg-green-500 hover:bg-green-600"
                          onClick={() => openShareModal(task)}
                        >
                          <Share2 className="w-3 h-3 mr-1" /> Partager
                        </Button>
                      ) : task.validation_type === "manual" ? (
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          variant="outline"
                          onClick={() => openTaskModal(task.id)}
                        >
                          <Upload className="w-3 h-3 mr-1" /> Soumettre une preuve
                        </Button>
                      ) : confirmingId === task.id ? (
                        // Step 2: link opened, ask user to confirm completion
                        <>
                          <Button
                            size="sm"
                            className="mt-3 w-full bg-green-500 hover:bg-green-600"
                            disabled={completingId === task.id}
                            onClick={() => handleComplete(task.id, task.amount, task.title)}
                          >
                            {completingId === task.id ? (
                              <><Sparkles className="w-3 h-3 mr-1 animate-spin" /> Paiement en cours...</>
                            ) : (
                              <><Check className="w-3 h-3 mr-1" /> J'ai terminé la mission</>
                            )}
                          </Button>
                          {task.link && (
                            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => openTaskLink(task)}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Réouvrir le lien
                            </Button>
                          )}
                        </>
                      ) : task.link ? (
                        // Step 1: open the link first
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          variant="outline"
                          onClick={() => openTaskLink(task)}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" /> Ouvrir le lien
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className={`mt-3 w-full ${completingId === task.id ? "bg-green-500 hover:bg-green-600" : ""}`}
                          variant={completingId === task.id ? "default" : "outline"}
                          disabled={completingId === task.id}
                          onClick={() => handleComplete(task.id, task.amount, task.title)}
                        >
                          {completingId === task.id ? (
                            <><Sparkles className="w-3 h-3 mr-1 animate-spin" /> Paiement en cours...</>
                          ) : showSuccess === task.id ? (
                            <><Check className="w-3 h-3 mr-1" /> {formatCurrency(task.amount)} crédité</>
                          ) : (
                            <><Sparkles className="w-3 h-3 mr-1" /> Accomplir +{formatCurrency(task.amount)}</>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Share Task Modal with progress */}
      {shareModal && shareModal.open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg bg-white dark:bg-[#161616] rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Partager la mission</h2>
              <button onClick={() => setShareModal(null)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 text-green-500" />
                <div>
                  <h3 className="font-semibold">{shareModal.title}</h3>
                  <p className="text-xs text-[#8A8A8A]">Partagez le lien ci-dessous</p>
                </div>
              </div>
              <p className="text-sm font-bold text-green-500 mt-3">+{formatCurrency(shareModal.amount)}</p>
            </div>

            {/* ===== ÉTAPE 1 : PARTAGER ===== */}
            {shareModal.step === "share" && (
              <>
                {shareModal.instructions && (
                  <p className="text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-3 rounded-lg mb-4">{shareModal.instructions}</p>
                )}

                {shareModal.link && (
                  <a
                    href={normalizeUrl(shareModal.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-purple-600 text-white font-medium mb-2"
                  >
                    <ExternalLink className="w-4 h-4" /> Ouvrir le lien à partager
                  </a>
                )}
                {shareModal.link && (
                  <Button size="lg" variant="outline" className="w-full mb-4" onClick={copyShareLink}>
                    <Link2 className="w-4 h-4 mr-2" /> Copier le lien à partager
                  </Button>
                )}

                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progression du partage</span>
                    <span className="text-sm font-bold text-green-500">{shareModal.shareCount}/{shareModal.targetCount}</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (shareModal.shareCount / shareModal.targetCount) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#8A8A8A] mt-2">
                    Partagez à {shareModal.targetCount} {shareModal.target === "groups" ? "groupes" : shareModal.target === "both" ? "contacts et groupes" : "contacts"} sur {shareModal.app}
                  </p>
                </div>

                <Button className="w-full mb-2 bg-green-500 hover:bg-green-600" size="lg" onClick={shareViaApp}>
                  <Share2 className="w-4 h-4 mr-2" /> Partager sur {shareModal.app}
                </Button>
                <p className="text-xs text-[#8A8A8A] text-center mb-4">
                  {typeof navigator !== "undefined" && typeof navigator.share === "function"
                    ? "Choisissez l'application dans la fenêtre de partage"
                    : `L'application ${shareModal.app} s'ouvrira avec le lien à partager`}
                </p>

                <Button className="w-full" size="lg" onClick={incrementShare}>
                  <Check className="w-4 h-4 mr-2" /> J'ai partagé ({shareModal.shareCount}/{shareModal.targetCount})
                </Button>
                <p className="text-xs text-[#8A8A8A] text-center mt-2">
                  Cliquez après chaque partage pour valider votre progression.
                </p>
              </>
            )}

            {/* ===== ÉTAPE 2 : REGARDER LE MÉDIA ===== */}
            {shareModal.step === "watch" && (
              <>
                <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 flex items-center gap-3 mb-4">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Partage terminé !</strong> Maintenant, regardez le contenu avant de valider.
                  </div>
                </div>

                {shareModal.mediaData && shareModal.mediaType === "image" && (
                  <div className="mb-4">
                    <button
                      onClick={() => setShareModal({ ...shareModal, imageViewed: !shareModal.imageViewed })}
                      className="w-full"
                    >
                      {shareModal.imageViewed ? (
                        <img
                          src={shareModal.mediaData}
                          alt={shareModal.title}
                          className="w-full rounded-xl max-h-[70vh] object-contain bg-black cursor-zoom-out"
                        />
                      ) : (
                        <div className="relative rounded-xl overflow-hidden bg-gray-50 dark:bg-white/5 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-purple-300 transition-colors">
                          <img
                            src={shareModal.mediaData}
                            alt={shareModal.title}
                            className="w-full max-h-40 object-cover opacity-50"
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Eye className="w-10 h-10 text-purple-500 mb-2" />
                            <span className="text-sm font-medium text-purple-600">Cliquez pour voir l'image en grand</span>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                )}
                {shareModal.mediaData && shareModal.mediaType === "video" && (
                  <video
                    src={shareModal.mediaData}
                    controls
                    className="w-full rounded-xl max-h-60 bg-black mb-4"
                    onEnded={() => setShareModal({ ...shareModal, videoWatched: true })}
                  />
                )}

                {shareModal.mediaType === "image" ? (
                  shareModal.imageViewed ? (
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      size="lg"
                      onClick={() => setShareModal({ ...shareModal, step: "complete" })}
                    >
                      <Eye className="w-4 h-4 mr-2" /> J'ai vu l'image — {formatCurrency(shareModal.amount)}
                    </Button>
                  ) : (
                    <Button className="w-full" size="lg" disabled>
                      <Eye className="w-4 h-4 mr-2" /> Cliquez sur l'image pour la voir en grand
                    </Button>
                  )
                ) : shareModal.videoWatched ? (
                  <Button
                    className="w-full bg-green-500 hover:bg-green-600"
                    size="lg"
                    onClick={() => setShareModal({ ...shareModal, step: "complete" })}
                  >
                    <Check className="w-4 h-4 mr-2" /> J'ai regardé la vidéo
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" disabled>
                    <Sparkles className="w-4 h-4 mr-2" /> Regardez la vidéo jusqu'à la fin
                  </Button>
                )}
              </>
            )}

            {/* ===== ÉTAPE 3 : VALIDER ===== */}
            {shareModal.step === "complete" && (
              <>
                <div className="bg-green-50 dark:bg-green-500/10 rounded-xl p-4 mb-4 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <h3 className="font-semibold">Tout est validé !</h3>
                  <p className="text-sm text-[#8A8A8A] mt-1">
                    Vous avez partagé et regardé le contenu. Vous pouvez maintenant toucher votre commission.
                  </p>
                  <p className="text-2xl font-bold text-green-500 mt-3">+{formatCurrency(shareModal.amount)}</p>
                </div>
                <Button
                  className="w-full bg-green-500 hover:bg-green-600"
                  size="lg"
                  onClick={() => {
                    handleComplete(shareModal.taskId, shareModal.amount, shareModal.title);
                    setShareModal(null);
                  }}
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Valider et toucher ma commission
                </Button>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Task Submission Modal (manual validation) */}
      {showTaskModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-lg bg-white dark:bg-[#161616] rounded-t-3xl sm:rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Soumettre une preuve</h2>
              <button onClick={() => setShowTaskModal(null)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const task = allTasks.find((t) => t.id === showTaskModal);
              if (!task) return null;
              return (
                <>
                  <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{task.icon || "📋"}</span>
                      <div>
                        <h3 className="font-semibold">{task.title}</h3>
                        <p className="text-xs text-[#8A8A8A]">{task.description}</p>
                      </div>
                    </div>
                    {task.instructions && (
                      <p className="text-sm mt-3 bg-white dark:bg-white/5 p-3 rounded-lg">{task.instructions}</p>
                    )}
                    {task.link && (
                      <a href={normalizeUrl(task.link)} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-500 flex items-center gap-1 mt-2">
                        <ExternalLink className="w-3 h-3" /> Ouvrir le lien
                      </a>
                    )}
                    <p className="text-sm font-bold text-green-500 mt-3">+{formatCurrency(task.amount)}</p>
                  </div>

                  {taskFields.length === 0 ? (
                    <p className="text-sm text-[#8A8A8A] text-center py-4">
                      Aucun champ de validation requis. Cliquez sur soumettre.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {taskFields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <label className="text-sm font-medium">
                            {field.title} {field.is_required && <span className="text-red-500">*</span>}
                          </label>
                          {field.description && (
                            <p className="text-xs text-[#8A8A8A]">{field.description}</p>
                          )}
                          {field.field_type === "screenshot" || field.field_type === "image" ? (
                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                              <Upload className="w-6 h-6 text-[#8A8A8A] mx-auto mb-2" />
                              <p className="text-xs text-[#8A8A8A]">Cliquez pour ajouter une image</p>
                              <Input
                                type="file"
                                accept="image/*"
                                className="mt-2"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setAnswers({ ...answers, [field.id]: reader.result as string });
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </div>
                          ) : field.field_type === "video" ? (
                            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center">
                              <Video className="w-6 h-6 text-[#8A8A8A] mx-auto mb-2" />
                              <p className="text-xs text-[#8A8A8A]">Cliquez pour ajouter une vidéo</p>
                              <Input
                                type="file"
                                accept="video/*"
                                className="mt-2"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onload = () => setAnswers({ ...answers, [field.id]: reader.result as string });
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <Input
                              type={field.field_type === "number" ? "number" : field.field_type === "url" ? "url" : "text"}
                              placeholder={field.placeholder || `Entrez ${field.title.toLowerCase()}`}
                              value={answers[field.id] || ""}
                              onChange={(e) => setAnswers({ ...answers, [field.id]: e.target.value })}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {submitError && (
                    <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl mt-4">{submitError}</p>
                  )}

                  <Button
                    className="w-full mt-4"
                    size="lg"
                    disabled={submitting || (taskFields.length > 0 && taskFields.some((f) => f.is_required && !answers[f.id]?.trim()))}
                    onClick={() => handleSubmitManual(task.id)}
                  >
                    {submitting ? (
                      <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Envoi en cours...</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Soumettre pour validation</>
                    )}
                  </Button>
                  <p className="text-xs text-[#8A8A8A] text-center mt-2">
                    Votre preuve sera vérifiée par un administrateur avant crédit.
                  </p>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}
    </div>
  );
}

