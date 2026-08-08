"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle, Clock, Link2, Type, Hash, Image, Video, MessageCircle, Send, Target, Share2, ChevronDown, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getTasks, createTaskAction, deleteTaskAction, getPlans, getCategories, getSubmissions, approveSubmissionAction, rejectSubmissionAction } from "@/actions/admin-actions";

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  icon: string | null;
  estimated_time: number | null;
  instructions: string | null;
  link: string | null;
  max_completions: number | null;
  duration_minutes: number | null;
  validation_type: "auto" | "manual";
  is_active: boolean;
  created_at: string;
  plans: { name: string; slug: string } | null;
  task_categories: { name: string; slug: string } | null;
}

interface FieldInput {
  title: string;
  description: string;
  field_type: string;
  is_required: boolean;
  placeholder: string;
  max_size?: number;
}

interface Submission {
  id: string;
  status: string;
  created_at: string;
  user_id: string;
  admin_comment: string | null;
  tasks: { title: string; amount: number } | null;
  profiles: { full_name: string | null; username: string | null } | null;
  submission_answers?: Array<{
    id: string;
    value: string;
    submission_fields: { title: string; field_type: string } | null;
  }>;
}

const fieldTypes = [
  { value: "text", label: "Texte", icon: Type },
  { value: "number", label: "Nombre", icon: Hash },
  { value: "url", label: "URL / Lien", icon: Link2 },
  { value: "screenshot", label: "Capture d'écran", icon: Image },
  { value: "image", label: "Image", icon: Image },
  { value: "video", label: "Vidéo", icon: Video },
  { value: "telegram", label: "Username Telegram", icon: Send },
  { value: "whatsapp", label: "Numéro WhatsApp", icon: MessageCircle },
];

const taskIcons = ["📋", "💬", "🌐", "📸", "📱", "🎥", "📊", "⭐", "🏆", "📢", "✅", "🎯"];

export default function AdminTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    title: "",
    description: "",
    amount: "",
    plan_id: "",
    category_id: "",
    icon: "📋",
    estimated_time: "",
    instructions: "",
    link: "",
    max_completions: "",
    duration_minutes: "",
    validation_type: "auto" as "auto" | "manual",
    task_type: "standard" as "standard" | "share",
    share_app: "",
    share_target: "",
    media_data: "", // base64 data for uploaded image/video
  });
  const [mediaType, setMediaType] = useState<"image" | "video" | "">("");
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [fields, setFields] = useState<FieldInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [showValidations, setShowValidations] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  // Expanded detail cards (validation + task) to show media without taking space
  const [expandedValidation, setExpandedValidation] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [showAllTasks, setShowAllTasks] = useState(false);

  // Detect if a value is a data URL (image/video) to render it as media
  const isMediaData = (value: string) => {
    return value.startsWith("data:image/") || value.startsWith("data:video/");
  };
  const isImageData = (value: string) => value.startsWith("data:image/");
  const isVideoData = (value: string) => value.startsWith("data:video/");

  // Parse [MEDIA] from task instructions to extract the actual image/video
  const parseMediaFromInstructions = (instructions: string | null) => {
    if (!instructions) return null;
    const match = instructions.match(/\[MEDIA\] type=(\w+) data=(data:[^\s]+)/);
    if (!match) return null;
    return { type: match[1] as "image" | "video", data: match[2] };
  };

  // Parse [SHARE] from task instructions to extract share info
  const parseShareFromInstructions = (instructions: string | null) => {
    if (!instructions) return null;
    // Handle empty values (e.g. "app= target= count=4")
    const match = instructions.match(/\[SHARE\] app=(\w*) target=(\w*) count=(\d*)/);
    if (!match) return null;
    return { app: match[1] || "whatsapp", target: match[2] || "contacts", count: parseInt(match[3], 10) || 1 };
  };

  // Clean instructions: remove [MEDIA] and [SHARE] markers so raw data isn't shown
  const cleanInstructions = (instructions: string | null) => {
    if (!instructions) return "";
    return instructions
      .replace(/\[MEDIA\] type=\w+ data=data:[^\s]+\n?/g, "")
      .replace(/\[SHARE\] app=\w* target=\w* count=\d*\n?/g, "")
      .trim();
  };

  // Human-readable share target
  const shareTargetLabel = (target: string) => {
    if (target === "groups") return "groupes";
    if (target === "both") return "contacts et groupes";
    return "contacts";
  };

  const loadData = async () => {
    try {
      const [tasksData, plansData, catsData] = await Promise.all([
        getTasks(),
        getPlans(true),
        getCategories(),
      ]);
      const serverTasks = tasksData || [];
      setTasks((prev) => {
        const map = new Map<string, any>();
        serverTasks.forEach((t: any) => map.set(t.id, t));
        prev.forEach((t: any) => {
          if (!map.has(t.id)) map.set(t.id, t);
        });
        return Array.from(map.values());
      });
      setPlans(plansData || []);
      setCategories(catsData || []);
    } catch (e) {
      console.error("Failed to load admin tasks data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Read local submissions from localStorage (test mode manual validation)
  const getLocalSubmissions = () => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("rewardly_task_submissions") || "[]");
    } catch (e) {
      return [];
    }
  };

  // Update a local submission's status in localStorage
  const updateLocalSubmissionStatus = (submissionId: string, status: string, comment?: string) => {
    if (typeof window === "undefined") return;
    const local = getLocalSubmissions();
    const next = local.map((s: any) =>
      s.id === submissionId ? { ...s, status, admin_comment: comment || s.admin_comment || null } : s
    );
    localStorage.setItem("rewardly_task_submissions", JSON.stringify(next));
  };

  const loadSubmissions = async () => {
    const data = await getSubmissions("pending");
    const local = getLocalSubmissions().filter((s: any) => s.status === "pending");
    // Merge DB + local submissions (deduplicate by id)
    const merged = [...(data || []), ...local];
    const map = new Map<string, any>();
    merged.forEach((s: any) => { if (!map.has(s.id)) map.set(s.id, s); });
    setSubmissions(Array.from(map.values()));
  };

  const handleShowValidations = () => {
    setShowValidations(!showValidations);
    if (!showValidations) loadSubmissions();
  };

  // Tâches filtrées par période
  const getFilteredTasks = () => {
    const now = new Date();
    return tasks.filter((t) => {
      const date = new Date(t.created_at);
      if (filterPeriod === "today") return date.toDateString() === now.toDateString();
      if (filterPeriod === "week") return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (filterPeriod === "month") return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (filterPeriod === "year") return date.getFullYear() === now.getFullYear();
      return true;
    });
  };
  const filteredTasks = getFilteredTasks();

  const addField = () => {
    setFields([...fields, { title: "", description: "", field_type: "text", is_required: true, placeholder: "" }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, key: keyof FieldInput, value: string | boolean) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
  };

  const handleCreateTask = async () => {
    if (!form.title || !form.amount || !form.plan_id) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const effectivePlanId = form.plan_id === "all" ? null : form.plan_id;
      // Encode share info in instructions for share-type tasks
      let finalInstructions = form.instructions || "";
      if (form.task_type === "share") {
        finalInstructions = `[SHARE] app=${form.share_app} target=${form.share_target} count=${form.max_completions}\n${finalInstructions}`;
      }
      // Encode media (image/video) in instructions
      if (form.media_data && mediaType) {
        finalInstructions = `[MEDIA] type=${mediaType} data=${form.media_data}\n${finalInstructions}`;
      }
      const result = await createTaskAction({
        title: form.title,
        description: form.description || undefined,
        amount: Number(form.amount),
        plan_id: effectivePlanId || "",
        category_id: form.category_id || undefined,
        icon: form.icon,
        estimated_time: form.estimated_time ? Number(form.estimated_time) : undefined,
        instructions: finalInstructions || undefined,
        link: form.link || undefined,
        max_completions: form.max_completions ? Number(form.max_completions) : undefined,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
        validation_type: form.validation_type,
        fields: form.validation_type === "manual" ? fields.map((f, i) => ({
          title: f.title,
          description: f.description || undefined,
          field_type: f.field_type as any,
          is_required: f.is_required,
          placeholder: f.placeholder || undefined,
          max_size: f.max_size,
          sort_order: i,
        })) : undefined,
      });
      if (result?.success) {
        const createdTaskId = (result as any).task_id || null;
        setFeedback(createdTaskId ? `Tâche créée avec succès : ${form.title} (id: ${createdTaskId})` : `Tâche créée avec succès : ${form.title}`);
        setShowForm(false);
        setForm({
          title: "", description: "", amount: "", plan_id: "", category_id: "",
          icon: "📋", estimated_time: "", instructions: "", link: "",
          max_completions: "", duration_minutes: "", validation_type: "auto",
          task_type: "standard", share_app: "", share_target: "", media_data: "",
        });
        setMediaType("");
        setMediaPreview("");
        setFields([]);
        await loadData();
      } else {
        setFeedback(result?.error || "Erreur lors de la création de la tâche.");
      }
    } catch (e) {
      console.error("Failed to create task", e);
      setFeedback("Erreur lors de la création de la tâche");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Supprimer cette tâche ?")) return;
    await deleteTaskAction(taskId);
    setFeedback("Tâche supprimée.");
    await loadData();
  };

  const handleApprove = async (submissionId: string) => {
    // Update local submission status (so history/dashboard show "validé")
    updateLocalSubmissionStatus(submissionId, "approved");

    // If this is a LOCAL submission (test mode, id starts with "sub-"),
    // the RPC won't find it in DB → credit the wallet locally
    if (submissionId.startsWith("sub-")) {
      const local = getLocalSubmissions();
      const sub = local.find((s: any) => s.id === submissionId);
      if (sub && sub.task?.amount) {
        // Credit the local wallet (balance + total_earnings)
        const storedWallet = localStorage.getItem("rewardly_wallet");
        if (storedWallet) {
          try {
            const wallet = JSON.parse(storedWallet);
            wallet.balance = (wallet.balance || 0) + sub.task.amount;
            wallet.total_earnings = (wallet.total_earnings || 0) + sub.task.amount;
            wallet.updated_at = new Date().toISOString();
            localStorage.setItem("rewardly_wallet", JSON.stringify(wallet));
          } catch (e) {}
        }
        // Add a completed transaction
        const storedTx = localStorage.getItem("rewardly_transactions");
        const txs = storedTx ? JSON.parse(storedTx) : [];
        const newTx = {
          id: "tx-" + Date.now(),
          user_id: "local-user",
          wallet_id: "local-wallet",
          amount: sub.task.amount,
          type: "reward",
          description: `Tâche validée : ${sub.task.title || "Tâche"}`,
          reference: null,
          status: "completed",
          created_at: new Date().toISOString(),
        };
        localStorage.setItem("rewardly_transactions", JSON.stringify([newTx, ...txs]));
      }
    } else {
      // DB submission → use the RPC to credit
      await approveSubmissionAction(submissionId);
    }
    loadSubmissions();
  };

  const handleReject = async (submissionId: string) => {
    const comment = prompt("Motif du refus :");
    // Update local submission status (so history/dashboard show "rejeté")
    updateLocalSubmissionStatus(submissionId, "rejected", comment || undefined);
    await rejectSubmissionAction(submissionId, comment || undefined);
    loadSubmissions();
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Gestion des tâches</h1>
              <p className="text-[#8A8A8A] text-sm">{tasks.length} tâches</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleShowValidations}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Validations ({submissions.length})
            </Button>
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" /> {showForm ? "Fermer" : "Nouvelle tâche"}
            </Button>
          </div>
        </div>

        {feedback && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${feedback.includes("Erreur") ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-300" : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-500/10 dark:text-green-300"}`}>
            {feedback}
          </div>
        )}

        {showForm && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold text-lg">Créer une tâche</h2>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Titre de la tâche *</label>
                    <Input placeholder="Ex: Rejoindre le canal Telegram" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input placeholder="Décrivez la tâche pour les utilisateurs" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Récompense (FCFA) *</label>
                    <Input type="number" placeholder="500" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Pack concerné *</label>
                    <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })}>
                      <option value="">Sélectionner un pack</option>
                      <option value="all">Tous les plans</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Catégorie</label>
                    <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">Aucune</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Icone</label>
                    <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
                      {taskIcons.map((icon) => (
                        <option key={icon} value={icon}>{icon}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Temps estimé (min)</label>
                    <Input type="number" placeholder="5" value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Lien de la tâche</label>
                    <Input placeholder="https://t.me/canal, https://whatsapp.com/group, https://site.com..." value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Média (image ou vidéo)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setMediaType("image"); setMediaPreview(""); setForm({ ...form, media_data: "" }); }} className={`p-3 rounded-xl border-2 text-left transition-all ${mediaType === "image" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2"><Image className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium">Image</span></div>
                      </button>
                      <button onClick={() => { setMediaType("video"); setMediaPreview(""); setForm({ ...form, media_data: "" }); }} className={`p-3 rounded-xl border-2 text-left transition-all ${mediaType === "video" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2"><Video className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium">Vidéo</span></div>
                      </button>
                    </div>
                    {mediaType && (
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept={mediaType === "image" ? "image/*" : "video/*"}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && mediaType === "image") {
                              // Compress image client-side to stay under the request limit
                              const reader = new FileReader();
                              reader.onload = () => {
                                const img = document.createElement("img");
                                img.onload = () => {
                                  const MAX = 800;
                                  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                                  const canvas = document.createElement("canvas");
                                  canvas.width = Math.round(img.width * scale);
                                  canvas.height = Math.round(img.height * scale);
                                  const ctx = canvas.getContext("2d");
                                  if (ctx) {
                                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                    const compressed = canvas.toDataURL("image/jpeg", 0.8);
                                    setForm({ ...form, media_data: compressed });
                                    setMediaPreview(compressed);
                                  }
                                };
                                img.src = reader.result as string;
                              };
                              reader.readAsDataURL(file);
                            } else if (file && file.size <= 8 * 1024 * 1024) {
                              // Videos: limit to 8 MB to stay safely under the body limit
                              const reader = new FileReader();
                              reader.onload = () => {
                                const data = reader.result as string;
                                setForm({ ...form, media_data: data });
                                setMediaPreview(data);
                              };
                              reader.readAsDataURL(file);
                            } else if (file) {
                              alert("Vidéo trop volumineuse. La taille maximale est de 8 MB.");
                            }
                          }}
                        />
                        {mediaPreview && (
                          mediaType === "image" ? (
                            <img src={mediaPreview} alt="Aperçu" className="w-full max-h-48 object-contain rounded-xl" />
                          ) : (
                            <video src={mediaPreview} controls className="w-full max-h-48 rounded-xl" />
                          )
                        )}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Type de tâche</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setForm({ ...form, task_type: "standard" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.task_type === "standard" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-5 h-5 text-purple-500" />
                          <span className="font-semibold text-sm">Standard</span>
                        </div>
                        <p className="text-xs text-[#8A8A8A]">Visite de site, rejoindre un canal, regarder une vidéo...</p>
                      </button>
                      <button onClick={() => setForm({ ...form, task_type: "share" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.task_type === "share" ? "border-green-500 bg-green-50 dark:bg-green-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Share2 className="w-5 h-5 text-green-500" />
                          <span className="font-semibold text-sm">Partage</span>
                        </div>
                        <p className="text-xs text-[#8A8A8A]">Partager le lien dans WhatsApp, Telegram, Facebook...</p>
                      </button>
                    </div>
                  </div>

                  {form.task_type === "share" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Application de partage *</label>
                        <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={form.share_app} onChange={(e) => setForm({ ...form, share_app: e.target.value })}>
                          <option value="">Choisir l'application</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="telegram">Telegram</option>
                          <option value="facebook">Facebook</option>
                          <option value="instagram">Instagram</option>
                          <option value="twitter">Twitter / X</option>
                          <option value="tiktok">TikTok</option>
                          <option value="other">Autre</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Partager à *</label>
                        <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={form.share_target} onChange={(e) => setForm({ ...form, share_target: e.target.value })}>
                          <option value="">Choisir la cible</option>
                          <option value="contacts">Contacts</option>
                          <option value="groups">Groupes</option>
                          <option value="both">Contacts et groupes</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Nombre de personnes / groupes *</label>
                        <Input type="number" placeholder="10" value={form.max_completions} onChange={(e) => setForm({ ...form, max_completions: e.target.value })} />
                        <p className="text-xs text-[#8A8A8A]">L'utilisateur devra partager le lien à ce nombre de {form.share_target === "groups" ? "groupes" : "personnes"} avant de terminer la tâche.</p>
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Instructions</label>
                    <textarea className="w-full min-h-[80px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm" placeholder="Expliquez précisément ce que l'utilisateur doit faire..." value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
                  </div>

                  {form.task_type !== "share" && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre max de participations</label>
                      <Input type="number" placeholder="100" value={form.max_completions} onChange={(e) => setForm({ ...form, max_completions: e.target.value })} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Durée (min)</label>
                    <Input type="number" placeholder="10" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Type de validation</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setForm({ ...form, validation_type: "auto" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.validation_type === "auto" ? "border-green-500 bg-green-50 dark:bg-green-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="font-semibold text-sm">Automatique</span>
                        </div>
                        <p className="text-xs text-[#8A8A8A]">L'utilisateur est crédité immédiatement après avoir cliqué sur le bouton accomplir.</p>
                      </button>
                      <button onClick={() => setForm({ ...form, validation_type: "manual" })} className={`p-4 rounded-xl border-2 text-left transition-all ${form.validation_type === "manual" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-5 h-5 text-purple-500" />
                          <span className="font-semibold text-sm">Manuelle</span>
                        </div>
                        <p className="text-xs text-[#8A8A8A]">L'utilisateur doit fournir des preuves, validées par un admin avant crédit.</p>
                      </button>
                    </div>
                  </div>
                </div>

                {form.validation_type === "manual" && (
                  <div className="space-y-3 border-t border-gray-100 dark:border-gray-800 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">Champs de validation</h3>
                        <p className="text-xs text-[#8A8A8A] mt-0.5">Les preuves que l'utilisateur devra fournir (captures, liens, textes...)</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={addField}>
                        <Plus className="w-3 h-3 mr-1" /> Ajouter un champ
                      </Button>
                    </div>

                    {fields.length === 0 && (
                      <p className="text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-4 rounded-xl">Ajoutez au moins un champ de validation. Exemples : capture d'écran de preuve, lien de partage, nombre de groupes, etc.</p>
                    )}

                    {fields.map((field, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-purple-500">Champ {index + 1}</span>
                          <button onClick={() => removeField(index)} className="text-red-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Titre du champ *</label>
                            <Input placeholder="Ex: Capture d'écran de preuve" value={field.title} onChange={(e) => updateField(index, "title", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Type de champ</label>
                            <select className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm" value={field.field_type} onChange={(e) => updateField(index, "field_type", e.target.value)}>
                              {fieldTypes.map((ft) => (
                                <option key={ft.value} value={ft.value}>{ft.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <label className="text-xs font-medium">Description / Aide</label>
                            <Input placeholder="Ex: Envoyez le lien du groupe où vous avez partagé" value={field.description} onChange={(e) => updateField(index, "description", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Placeholder</label>
                            <Input placeholder="Ex: https://t.me/..." value={field.placeholder} onChange={(e) => updateField(index, "placeholder", e.target.value)} />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={field.is_required} onChange={(e) => updateField(index, "is_required", e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                              Obligatoire
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
                  <Button onClick={handleCreateTask} disabled={submitting || !form.title || !form.amount || !form.plan_id}>
                    {submitting ? "Création..." : "Créer la tâche"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {showValidations && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Validations en attente</h2>
                  <Button size="sm" variant="outline" onClick={loadSubmissions}>Actualiser</Button>
                </div>
                {submissions.length === 0 ? (
                  <p className="text-sm text-[#8A8A8A] text-center py-8">Aucune validation en attente</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.map((sub) => (
                      <div key={sub.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm">{sub.tasks?.title || "Tâche"}</p>
                            <p className="text-xs text-[#8A8A8A]">{sub.profiles?.full_name || sub.profiles?.username || "Utilisateur"} • {formatCurrency(sub.tasks?.amount || 0)}</p>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">En attente</span>
                        </div>
                        {sub.submission_answers && sub.submission_answers.length > 0 && (
                          <div className="space-y-2">
                            {sub.submission_answers.map((answer) => (
                              <div key={answer.id} className="flex items-start gap-2 text-sm">
                                <span className="text-[#8A8A8A] font-medium w-32 flex-shrink-0">{answer.submission_fields?.title || "Réponse"}:</span>
                                {isImageData(answer.value) ? (
                                  <img src={answer.value} alt="Preuve" className="w-24 h-24 object-cover rounded-lg" />
                                ) : isVideoData(answer.value) ? (
                                  <video src={answer.value} controls className="w-40 h-24 object-cover rounded-lg" />
                                ) : (
                                  <span className="break-all">{answer.value}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setExpandedValidation(expandedValidation === sub.id ? null : sub.id)}>
                            {expandedValidation === sub.id ? "Masquer" : "Détail"}
                          </Button>
                          <Button size="sm" variant="default" className="bg-green-500 hover:bg-green-600" onClick={() => handleApprove(sub.id)}>
                            <CheckCircle className="w-3 h-3 mr-1" /> Approuver & Créditer
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(sub.id)}>
                            <XCircle className="w-3 h-3 mr-1" /> Refuser
                          </Button>
                        </div>
                        {expandedValidation === sub.id && (
                          <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                            {sub.submission_answers && sub.submission_answers.map((answer) => (
                              <div key={answer.id} className="flex items-start gap-2 text-sm">
                                <span className="text-[#8A8A8A] font-medium w-32 flex-shrink-0">{answer.submission_fields?.title || "Réponse"}:</span>
                                {isImageData(answer.value) ? (
                                  <img src={answer.value} alt="Preuve" className="w-full max-h-60 object-contain rounded-lg" />
                                ) : isVideoData(answer.value) ? (
                                  <video src={answer.value} controls className="w-full max-h-60 rounded-lg" />
                                ) : (
                                  <span className="break-all">{answer.value}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2 text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 px-3 py-2 rounded-xl flex-1">
              <Filter className="w-4 h-4" />
              <span>{filteredTasks.length} tâche{filteredTasks.length !== 1 ? "s" : ""} affichée{filteredTasks.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="relative">
              <select
                value={filterPeriod}
                onChange={(e) => { setFilterPeriod(e.target.value as any); setShowAllTasks(false); }}
                className="h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 pr-8 text-sm appearance-none cursor-pointer"
              >
                <option value="all">Toutes les périodes</option>
                <option value="today">Aujourd'hui</option>
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
                <option value="year">Cette année</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A] pointer-events-none" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks
              .slice(0, showAllTasks ? undefined : 9)
              .map((task, index) => (
              <motion.div key={task.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                <Card className="overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{task.icon || "📋"}</span>
                        <h3 className="font-semibold">{task.title}</h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${task.validation_type === "auto" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"}`}>
                        {task.validation_type === "auto" ? "Auto" : "Manuel"}
                      </span>
                    </div>
                    {task.description && <p className="text-sm text-[#8A8A8A] mb-3 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center gap-3 text-sm mb-3">
                      <span className="font-bold text-green-500">+{formatCurrency(task.amount)}</span>
                      {task.estimated_time && <span className="flex items-center gap-1 text-[#8A8A8A]"><Clock className="w-3 h-3" /> {task.estimated_time} min</span>}
                      {task.plans && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{task.plans.name}</span>}
                    </div>
                    {(() => {
                      const media = parseMediaFromInstructions(task.instructions);
                      const share = parseShareFromInstructions(task.instructions);
                      const cleanInstr = cleanInstructions(task.instructions);
                      return (
                        <>
                          {/* Share info (always visible) */}
                          {share && (
                            <div className="mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                              <p className="text-xs font-medium text-green-700 dark:text-green-300 flex items-center gap-1">
                                <Share2 className="w-3 h-3" /> Partager sur {share.app} à {share.count} {shareTargetLabel(share.target)}
                              </p>
                            </div>
                          )}
                          {/* Clean instructions (no raw data) */}
                          {cleanInstr && <p className="text-xs text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-2 rounded-lg mb-3 line-clamp-2">{cleanInstr}</p>}
                          {task.link && <a href={task.link} target="_blank" className="text-xs text-purple-500 flex items-center gap-1 mb-3"><Link2 className="w-3 h-3" /> {task.link}</a>}
                          <div className="flex items-center justify-between">
                            <span className={`text-xs px-2 py-1 rounded-full ${task.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{task.is_active ? "Active" : "Inactive"}</span>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                                {expandedTask === task.id ? "Masquer" : "Détail"}
                              </Button>
                              <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          {expandedTask === task.id && (
                            <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                              {/* Media full size (only in detail) */}
                              {media && (
                                <div>
                                  {media.type === "image" ? (
                                    <img src={media.data} alt={task.title} className="w-full max-h-60 object-contain rounded-lg" />
                                  ) : (
                                    <video src={media.data} controls className="w-full max-h-60 rounded-lg" />
                                  )}
                                </div>
                              )}
                              {/* Share details */}
                              {share && (
                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-500/10">
                                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Partage requis</p>
                                  <p className="text-sm text-[#8A8A8A]">Application : {share.app}</p>
                                  <p className="text-sm text-[#8A8A8A]">Cible : {shareTargetLabel(share.target)}</p>
                                  <p className="text-sm text-[#8A8A8A]">Nombre : {share.count}</p>
                                </div>
                              )}
                              {cleanInstr && (
                                <p className="text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-3 rounded-lg">{cleanInstr}</p>
                              )}
                              {task.link && (
                                <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-500 flex items-center gap-1">
                                  <Link2 className="w-3 h-3" /> {task.link}
                                </a>
                              )}
                              {task.description && (
                                <p className="text-sm text-[#8A8A8A]">{task.description}</p>
                              )}
                              {task.estimated_time && (
                                <p className="text-sm text-[#8A8A8A]">Temps estimé : {task.estimated_time} min</p>
                              )}
                              {task.max_completions && (
                                <p className="text-sm text-[#8A8A8A]">Max participations : {task.max_completions}</p>
                              )}
                              {task.duration_minutes && (
                                <p className="text-sm text-[#8A8A8A]">Durée : {task.duration_minutes} min</p>
                              )}
                              {task.task_categories && (
                                <p className="text-sm text-[#8A8A8A]">Catégorie : {task.task_categories.name}</p>
                              )}
                              {task.plans && (
                                <p className="text-sm text-[#8A8A8A]">Pack : {task.plans.name}</p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </Card>
              </motion.div>
            ))}

            {filteredTasks.length > 9 && (
              <button
                onClick={() => setShowAllTasks(!showAllTasks)}
                className="col-span-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-3"
              >
                {showAllTasks ? "Voir moins" : "Voir tout"}
              </button>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
