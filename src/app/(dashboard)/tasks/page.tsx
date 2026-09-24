"use client";

import { motion } from "framer-motion";
import { Clock, Search, Lock, CheckCircle, Info, Sparkles, Check, Upload, Link2, Video, ExternalLink, X, Share2, Eye, AlertCircle, ListChecks, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatTaskReward } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { submitTaskAction } from "@/actions/user-actions";
import { getTaskFields } from "@/actions/admin-actions";
import { useNav } from "@/context/NavContext";

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
  const { tasks, allTasks, isLoading, dailyLimit, completedToday, totalPlanTasks, allTasksCompleted, completeTask, addSubmission } = useTasks();
  const [search, setSearch] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [showPending, setShowPending] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState<string | null>(null);
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Tâche dont le panneau "Instructions" (bottom sheet) est ouvert
  const [bottomSheetTask, setBottomSheetTask] = useState<any>(null);

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
    amountLabel: string;
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

  // Parse [MEDIA] info from task instructions (image/video — data URL ou URL publique)
  const parseMediaInfo = (task: any) => {
    const instructions = task.instructions || "";
    const match = instructions.match(/\[MEDIA\] type=(\w+) (?:data=(data:[^\s]+)|src=([^\s]+))/);
    if (!match) return null;
    return {
      type: match[1] as "image" | "video",
      data: match[2] || match[3],
      cleanInstructions: instructions.replace(/\[MEDIA\] type=\w+ (?:data=data:[^\s]+|src=[^\s]+)\n?/, ""),
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
    if (showTaskModal || shareModalOpen || bottomSheetTask) {
      hideNav(true);
    } else {
      showNav();
    }
  }, [showTaskModal, shareModalOpen, bottomSheetTask, hideNav, showNav]);

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
      .replace(/\[MEDIA\] type=\w+ (?:data=data:[^\s]+|src=[^\s]+)\n?/g, "")
      .trim();
    setShareModal({
      open: true,
      taskId: task.id,
      title: task.title,
      amount: task.amount,
      amountLabel: task.amount_label || "",
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

  // ============================================================
  // CONSTRUCTION DU MESSAGE PARTAGÉ
  // ORDRE respecté : [Image/Vidéo] → [Texte] → [Lien]
  // ============================================================
  const buildShareMessage = () => {
    if (!shareModal) return { text: "", link: "", fullMessage: "" };
    const link = shareModal.link ? normalizeUrl(shareModal.link) : window.location.href;

    // 📝 Texte = titre + consignes (le média est placé AVANT via l'aperçu
    //    et joint séparément par l'API de partage native).
    let text = `${shareModal.title} — Rejoignez-nous !`;
    const instructions = (shareModal.instructions || "").trim();
    if (instructions) text += `\n${instructions}`;

    return { text, link, fullMessage: `${text}\n${link}` };
  };

  // Copy the link to share to clipboard
  const copyShareLink = () => {
    if (!shareModal) return;
    navigator.clipboard.writeText(buildShareMessage().link);
    alert("Lien copié dans le presse-papiers !");
  };

  // Copy the full message (text + link) to clipboard
  const copyShareMessage = () => {
    if (!shareModal) return;
    navigator.clipboard.writeText(buildShareMessage().fullMessage);
    alert("Message partagé copié (texte + lien) !");
  };

  // Increment share count (user clicked "J'ai partagé")
  const incrementShare = () => {
    if (!shareModal) return;
    const newCount = shareModal.shareCount + 1;
    setShareModal({ ...shareModal, shareCount: newCount });
    // If target reached, go to "watch" step ONLY if there is a media to watch,
    // otherwise jump directly to validation.
    if (newCount >= shareModal.targetCount) {
      const nextStep = shareModal.mediaData ? "watch" : "complete";
      setShareModal({ ...shareModal, shareCount: newCount, step: nextStep });
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
  // ORDRE DU PARTAGE : [Image/Vidéo] → [Texte] → [Lien]
  // NOTE: Le partage n'incrémente PAS la progression automatiquement.
  // L'utilisateur doit cliquer sur "J'ai partagé" pour valider chaque partage.
  const shareViaApp = async () => {
    if (!shareModal) return;
    const { text, link } = buildShareMessage();

    // Build files array (media) + text + link, share ALL together
    // → le destinataire voit : [image/vidéo] puis le texte, puis le lien.
    const mediaFile = shareModal.mediaData ? base64ToFile(shareModal.mediaData) : null;
    const files = mediaFile ? [mediaFile] : [];

    // Try native Web Share API first (shares media + text + link on mobile)
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

    // Fallback: deep links to specific apps (TEXTE puis LIEN ;
    // l'image/vidéo se joint MANUELLEMENT dans l'application cible).
    const encodedText = encodeURIComponent(text + "\n" + link);
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

    // ✅ Crédit UNIQUEMENT via la RPC submit_task (atomique côté serveur :
    //    vérifie la limite de 1 tâche/jour, anti-double soumission,
    //    puis crédite le wallet + crée la transaction).
    //    Plus AUCUN fallback de crédit direct côté client (RLS désormais
    //    verrouillée) — on évite ainsi tout crédit injustifié ou double crédit.
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
      // RPC échouée (limite du jour atteinte, déjà accomplie...) →
      // on affiche l'erreur au lieu de créditer manuellement.
      console.error("submitTaskAction failed:", result?.error);
      setSubmitError(result?.error || "Impossible de valider cette tâche. Veuillez réessayer.");
      setCompletingId(null);
      setConfirmingId(null);
      setTimeout(() => setSubmitError(null), 5000);
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

  // ============================================================
  // PANNEAU "INSTRUCTIONS" (bottom sheet)
  // ============================================================

  // Nettoyer les instructions des balises techniques [MEDIA]/[SHARE]
  // et des lignes "NB" (avertissements) qui sont affichées séparément.
  const NB_LINE_PATTERN = /^(NB|N\.?\s*B\.?)\s*[:.\-–—]?\s*/i;

  const getCleanInstructions = (task: any) => {
    return (task?.instructions || "")
      .replace(/\[SHARE\] app=\w+ target=\w+ count=\d+\n?/g, "")
      .replace(/\[MEDIA\] type=\w+ (?:data=data:[^\s]+|src=[^\s]+)\n?/g, "")
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l && !NB_LINE_PATTERN.test(l))
      .join("\n")
      .trim();
  };

  // Lignes "NB:" → choses à éviter, affichées dans un encadré rouge bien visible
  const getNbLines = (task: any) => {
    if (!task?.instructions) return [];
    return (task.instructions as string)
      .split("\n")
      .map((l: string) => l.trim())
      .filter((l: string) => l && NB_LINE_PATTERN.test(l));
  };

  // Mots-clés qui signalent une information importante (surlignée)
  const IMPORTANT_WORDS = [
    "important", "obligatoire", "requis", "attention", "avertissement",
    "ne pas", "n'oubliez", "n'oublie", "vérifiez", "verifiez", "confirmez",
    "code", "numéro", "numero", "téléphone", "telephone", "lien", "cliquez",
    "ouvrez", "partagez", "groupe", "groupes", "contact", "inscription",
    "abonnement", "suivez", "rendez-vous", "doit", "devrez", "garantir",
    "impératif", "imperatif", "⚠", "! ",
  ];

  // Rendu mis en forme d'une ligne : liens cliquables, numéros et valeurs
  // entre guillemets mis en couleur (soulignés / gras).
  const renderRichText = (text: string) => {
    const parts: React.ReactNode[] = [];
    const pattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\+?\d[\d\s.-]{7,}|"[^"]+")/g;
    pattern.lastIndex = 0;
    let last = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const token = m[0];
      if (/^(https?:\/\/|www\.)/.test(token)) {
        parts.push(
          <a
            key={`u${k++}`}
            href={/^https?:/.test(token) ? token : `https://${token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 font-semibold underline break-all"
          >
            {token}
          </a>
        );
      } else if (/^\+?\d[\d\s.-]{7,}$/.test(token)) {
        parts.push(
          <span key={`n${k++}`} className="font-bold text-purple-700 dark:text-purple-300">
            {token}
          </span>
        );
      } else {
        parts.push(
          <span key={`q${k++}`} className="font-semibold text-purple-700 dark:text-purple-300">
            {token}
          </span>
        );
      }
      last = m.index + token.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    if (parts.length === 0) parts.push(text);
    return parts;
  };

  // Rendu d'une ligne d'instructions (lignes importantes surlignées)
  const renderInstructionLine = (line: string, i: number) => {
    const clean = line.trim();
    if (!clean) return null;
    const lower = clean.toLowerCase();
    const isImportant = IMPORTANT_WORDS.some((w) => lower.includes(w));

    if (isImportant) {
      return (
        <div
          key={i}
          className="bg-amber-50 dark:bg-amber-500/10 border-l-4 border-amber-400 dark:border-amber-500 rounded-r-lg px-3 py-2"
        >
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 leading-relaxed">
            {renderRichText(clean)}
          </p>
        </div>
      );
    }

    return (
      <p key={i} className="text-sm text-[#8A8A8A] leading-relaxed">
        {renderRichText(clean)}
      </p>
    );
  };

  // Accomplir une tâche depuis le panneau puis fermer le panneau
  const completeFromSheet = async (task: any) => {
    setBottomSheetTask(null);
    await handleComplete(task.id, task.amount, task.title);
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

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Tâches</h1>
        <p className="text-[#8A8A8A] text-sm mt-1">
          {completedToday}/{dailyLimit} tâche aujourd'hui
          {totalPlanTasks > 0 ? ` • ${totalPlanTasks} tâche${totalPlanTasks > 1 ? "s" : ""} disponible${totalPlanTasks > 1 ? "s" : ""} aujourd'hui` : ""}
        </p>
      </motion.div>

      {/* Bandeau gratuit : 1 tâche par jour pour TOUS les utilisateurs */}
      <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-3 flex items-center gap-3">
        <Info className="w-5 h-5 text-purple-500 flex-shrink-0" />
        <div className="text-sm text-purple-700 dark:text-purple-300">
          Plateforme <strong>100% gratuite</strong> — accomplissez <strong>1 tâche par jour</strong>
          {completedToday > 0 ? " (tâche du jour déjà accomplie ✅)" : ""}
        </div>
      </div>

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

      {submitError && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3 flex items-center gap-3 border border-red-200 dark:border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="text-sm text-red-700 dark:text-red-300 flex-1">{submitError}</div>
        </motion.div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
        <Input placeholder="Rechercher une tâche..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            {completedToday >= dailyLimit ? (
              <>
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-[#8A8A8A] text-sm">
                  Tâche du jour accomplie ! Revenez demain pour une nouvelle tâche gratuite.
                </p>
                <p className="text-xs text-[#8A8A8A] mt-2">
                  Vous avez accompli {completedToday}/{dailyLimit} tâche aujourd'hui
                </p>
              </>
            ) : (
              <>
                <Clock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <p className="font-semibold text-[#111111] dark:text-white">
                  {allTasksCompleted
                    ? "Vous avez accompli toutes les tâches disponibles"
                    : "Aucune tâche disponible pour le moment"}
                </p>
                <p className="text-sm text-[#8A8A8A] mt-1">
                  {allTasksCompleted
                    ? "De nouvelles missions arrivent bientôt — veuillez patienter et repasser plus tard."
                    : "Veuillez patienter, de nouvelles tâches seront bientôt ajoutées. Revenez un peu plus tard !"}
                </p>
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
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate-2">{task.title}</h3>
                          {task.description && (
                            <p className="text-xs text-[#8A8A8A] mt-0.5 truncate-2 text-safe">{task.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-green-500 whitespace-nowrap flex-shrink-0">{formatTaskReward(task)}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        {task.estimated_time && <span className="flex items-center gap-1 text-xs text-[#8A8A8A]"><Clock className="w-3 h-3" /> {task.estimated_time} min</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${task.validation_type === "auto" ? "bg-green-100 text-green-700 dark:bg-green-500/20" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20"}`}>
                          {task.validation_type === "auto" ? "Auto" : "Manuel"}
                        </span>
                      </div>

                      {/* Bouton Instructions → bottom sheet (consignes + action) */}
                      <Button
                        size="sm"
                        className="mt-3 w-full text-purple-600 dark:text-purple-300 border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                        variant="outline"
                        onClick={() => setBottomSheetTask(task)}
                      >
                        <ListChecks className="w-3 h-3 mr-1" /> Instructions
                      </Button>
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
                                <Share2 className="w-3 h-3 mr-1" /> Partager et gagner {formatTaskReward(task)}
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
              <p className="text-sm font-bold text-green-500 mt-3">{formatTaskReward({ amount: shareModal.amount, amount_label: shareModal.amountLabel })}</p>
            </div>

            {/* ===== ÉTAPE 1 : PARTAGER ===== */}
            {shareModal.step === "share" && (
              <>
                {/* 🖼️ MÉDIA EN PREMIER (image/vidéo) — ordre : média → texte → lien */}
                {shareModal.mediaData && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-[#8A8A8A] mb-1">Aperçu du partage : image/vidéo en premier</p>
                    {shareModal.mediaType === "video" ? (
                      <video src={shareModal.mediaData} className="w-full rounded-xl max-h-48 bg-black" muted />
                    ) : (
                      <img src={shareModal.mediaData} alt="Aperçu du média à partager" className="w-full rounded-xl max-h-48 object-cover" />
                    )}
                  </div>
                )}

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
                <Button size="lg" variant="outline" className="w-full mb-1" onClick={copyShareMessage}>
                  <FileText className="w-4 h-4 mr-2" /> Copier texte + lien
                </Button>

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
                    : `L'application ${shareModal.app} s'ouvrira avec le texte et le lien à partager`}
                </p>
                {shareModal.mediaData && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 text-center flex items-center justify-center gap-1 mb-3">
                    <AlertCircle className="w-3 h-3" /> Si l'image/vidéo n'est pas ajoutée automatiquement, joignez-la au même message.
                  </p>
                )}

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

                {!shareModal.mediaData ? (
                  <>
                    {/* Aucune image/vidéo : rien à regarder, on valide directement */}
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      size="lg"
                      onClick={() => setShareModal({ ...shareModal, step: "complete" })}
                    >
                      <Check className="w-4 h-4 mr-2" /> Valider ma mission — {formatTaskReward({ amount: shareModal.amount, amount_label: shareModal.amountLabel })}
                    </Button>
                    <p className="text-xs text-[#8A8A8A] text-center mt-2">
                      Aucune vidéo à regarder : confirmez pour recevoir votre récompense.
                    </p>
                  </>
                ) : shareModal.mediaType === "image" ? (
                  shareModal.imageViewed ? (
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600"
                      size="lg"
                      onClick={() => setShareModal({ ...shareModal, step: "complete" })}
                    >
                      <Eye className="w-4 h-4 mr-2" /> J'ai vu l'image — {formatTaskReward({ amount: shareModal.amount, amount_label: shareModal.amountLabel })}
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
                    Vous avez terminé la mission de partage. Touchez votre récompense !
                  </p>
                  <p className="text-2xl font-bold text-green-500 mt-3">{formatTaskReward({ amount: shareModal.amount, amount_label: shareModal.amountLabel })}</p>
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
                      <span className="text-2xl flex-shrink-0">{task.icon || "📋"}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate-2">{task.title}</h3>
                        {task.description && (
                          <p className="text-xs text-[#8A8A8A] truncate-2 text-safe">{task.description}</p>
                        )}
                      </div>
                    </div>
                    {task.instructions && (
                      <p className="text-sm mt-3 bg-white dark:bg-white/5 p-3 rounded-lg text-safe max-h-40 overflow-y-auto">{task.instructions}</p>
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
    {/* ===== PANNEAU INSTRUCTIONS (bottom sheet : se déroule du bas vers le haut) ===== */}
      {bottomSheetTask && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center overflow-hidden">
          {/* Fond sombre (clic = fermer) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setBottomSheetTask(null)}
          />
          {/* Panneau qui remonte depuis le bas */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#161616] rounded-t-3xl p-6 max-h-[88vh] overflow-y-auto"
          >
            {/* Poignée */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* En-tête */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                  {bottomSheetTask.icon || "📋"}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-lg leading-snug">{bottomSheetTask.title}</h2>
                  <p className="text-sm font-bold text-green-500 mt-1">{formatTaskReward(bottomSheetTask)}</p>
                </div>
              </div>
              <button
                onClick={() => setBottomSheetTask(null)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0"
                aria-label="Fermer les instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Méta */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {bottomSheetTask.estimated_time && (
                <span className="flex items-center gap-1 text-xs text-[#8A8A8A] bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                  <Clock className="w-3 h-3" /> {bottomSheetTask.estimated_time} min
                </span>
              )}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${bottomSheetTask.validation_type === "auto" ? "bg-green-100 text-green-700 dark:bg-green-500/20" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20"}`}>
                {bottomSheetTask.validation_type === "auto" ? "Validation automatique" : "Validation manuelle"}
              </span>
            </div>

            {/* Instructions */}
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-purple-500" /> Instructions
            </h3>

            {/* Média si présent */}
            {(() => {
              const media = parseMediaInfo(bottomSheetTask);
              if (!media) return null;
              return (
                <div className="mb-3">
                  {media.type === "image" ? (
                    <img src={media.data} alt={bottomSheetTask.title} className="w-full rounded-xl max-h-72 object-contain bg-gray-50 dark:bg-white/5" />
                  ) : (
                    <video src={media.data} controls className="w-full rounded-xl max-h-60 bg-black" />
                  )}
                </div>
              );
            })()}

            {/* Lignes d'instructions (importantes surlignées / soulignées / colorées) */}
            {(() => {
              const lines = getCleanInstructions(bottomSheetTask)
                .split("\n")
                .map((l: string, i: number) => renderInstructionLine(l, i));
              return lines.length > 0 ? (
                <div className="space-y-3 mb-6">{lines}</div>
              ) : (
                <p className="text-sm text-[#8A8A8A] mb-6">
                  Aucune instruction détaillée pour cette mission. Suivez le lien puis revenez pour valider.
                </p>
              );
            })()}

            {/* NB — Choses à éviter : encadré d'avertissement BIEN VISIBLE */}
            {(() => {
              const nbList = getNbLines(bottomSheetTask);
              return (
                <div className="mb-6 rounded-xl border-2 border-red-300 dark:border-red-500/60 bg-red-100 dark:bg-red-500/10 p-4">
                  <p className="font-bold text-red-700 dark:text-red-400 text-sm flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /> NB — À éviter
                  </p>
                  {nbList.length > 0 ? (
                    <div className="space-y-1.5">
                      {nbList.map((nb, i) => (
                        <p key={i} className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                          • {renderRichText(nb.replace(NB_LINE_PATTERN, ""))}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
                      • Suivez <strong>strictement</strong> les instructions ci-dessus. Toute <strong>fraude, fausse preuve ou tentative de triche</strong> entraîne le rejet de la mission et peut mener à la <strong>suspension définitive</strong> du compte.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Lien de la mission */}
            {(() => {
              const media = parseMediaInfo(bottomSheetTask);
              const showLink = Boolean(bottomSheetTask.link) && !parseShareInfo(bottomSheetTask) && !media;
              return showLink ? (
                <a
                  href={normalizeUrl(bottomSheetTask.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => openTaskLink(bottomSheetTask)}
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium mb-6"
                >
                  <ExternalLink className="w-4 h-4" /> Voir la mission
                </a>
              ) : null;
            })()}
          {/* Action principale selon le type de tâche */}
            {(() => {
              // Tâche à partager → on passe par la modal de partage
              if (parseShareInfo(bottomSheetTask)) {
                return (
                  <Button
                    size="lg"
                    className="w-full bg-green-500 hover:bg-green-600"
                    onClick={() => {
                      openShareModal(bottomSheetTask);
                      setBottomSheetTask(null);
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Partager et gagner {formatTaskReward(bottomSheetTask)}
                  </Button>
                );
              }

              // Tâche manuelle → envoyer les preuves
              if (bottomSheetTask.validation_type === "manual") {
                return (
                  <>
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        openTaskModal(bottomSheetTask.id);
                        setBottomSheetTask(null);
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" /> Envoyer les preuves
                    </Button>
                    <p className="text-xs text-[#8A8A8A] text-center mt-2">
                      Votre preuve sera vérifiée par un administrateur avant crédit.
                    </p>
                  </>
                );
              }

              // Tâche auto : lien déjà ouvert → confirmer la mission
              if (confirmingId === bottomSheetTask.id) {
                return (
                  <>
                    <Button
                      size="lg"
                      className="w-full bg-green-500 hover:bg-green-600"
                      disabled={completingId === bottomSheetTask.id}
                      onClick={() => completeFromSheet(bottomSheetTask)}
                    >
                      {completingId === bottomSheetTask.id ? (
                        <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Paiement en cours...</>
                      ) : (
                        <><Check className="w-4 h-4 mr-2" /> J'ai terminé la mission</>
                      )}
                    </Button>
                    {bottomSheetTask.link && (
                      <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => openTaskLink(bottomSheetTask)}>
                        <ExternalLink className="w-4 h-4 mr-1" /> Rouvrir le lien
                      </Button>
                    )}
                  </>
                );
              }

              // Tâche auto avec lien → ouvrir la mission
              if (bottomSheetTask.link && !parseMediaInfo(bottomSheetTask)) {
                return (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => openTaskLink(bottomSheetTask)}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Ouvrir la mission
                  </Button>
                );
              }

              // Tâche auto simple (ou média sans partage) → accomplir
              return (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={completingId === bottomSheetTask.id}
                  onClick={() => completeFromSheet(bottomSheetTask)}
                >
                  {completingId === bottomSheetTask.id ? (
                    <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Paiement en cours...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Accomplir la tâche — {formatTaskReward(bottomSheetTask)}</>
                  )}
                </Button>
              );
            })()}
          </motion.div>
        </div>
      )}
    </div>
  );
}

