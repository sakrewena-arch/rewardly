"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Wallet, TrendingUp, Gift, Eye, EyeOff, ExternalLink, Clock, Bell, Megaphone, X, XCircle, ChevronDown, Lock, Rocket, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useTasks } from "@/hooks/useTasks";
import { generateDailyRemindersAction } from "@/actions/reminder-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatTaskReward } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function DashboardPage() {
  const { profile, user, isLoading: isAuthLoading } = useAuth();
  const { wallet, transactions, isLoading, withdrawableAmount, refreshWallet } = useWallet();
  const { tasks, completedToday, isLoading: tasksLoading } = useTasks();
  const router = useRouter();
  const [showBalance, setShowBalance] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [txFilter, setTxFilter] = useState<"today" | "week" | "month" | "year" | "all">("all");
  const [showAllTx, setShowAllTx] = useState(false);
  const [txExpanded, setTxExpanded] = useState(true);
  // Tâches refusées récentes (avec le motif retourné par l'admin)
  const [rejectedTasks, setRejectedTasks] = useState<any[]>([]);

  // Charger les notifications (annonces) pour l'utilisateur connecté
  useEffect(() => {
    if (!user) return;
    // 🔔 Générer les rappels quotidiens (tâches du jour + passage plan supérieur)
    // pour l'utilisateur connecté — une seule fois par jour (localStorage +
    // déduplication anti-spam côté base de données).
    try {
      const lastReminder = localStorage.getItem("rewardly_last_reminder");
      const today = new Date().toISOString().slice(0, 10);
      if (lastReminder !== today) {
        generateDailyRemindersAction().finally(() => {
          localStorage.setItem("rewardly_last_reminder", today);
        });
      }
    } catch (e) {
      /* localStorage indisponible : on ignore */
    }

    const supabase = createClient();
    if (!supabase) return;

    const loadAnnouncements = async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(10);
      setAnnouncements(data || []);
    };

    loadAnnouncements();

    // Écouter les nouvelles notifications en temps réel
    const channel = supabase
      .channel("dashboard-announcements")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadAnnouncements()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=is.null",
        },
        () => loadAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Charger les tâches refusées récentes (avec le motif) pour « Transactions récentes »
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase
      .from("task_submissions")
      .select("id, admin_comment, created_at, tasks(title)")
      .eq("user_id", user.id)
      .eq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(
        (res: any) => setRejectedTasks(res.data || []),
        () => setRejectedTasks([])
      );
  }, [user]);

  // Charger les annonces masquées
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissed = JSON.parse(localStorage.getItem("rewardly_dismissed_announcements") || "[]");
      setDismissedAnnouncements(dismissed);
    } catch (e) {}
  }, []);

  const dismissAnnouncement = (id: string) => {
    const next = [...dismissedAnnouncements, id];
    setDismissedAnnouncements(next);
    localStorage.setItem("rewardly_dismissed_announcements", JSON.stringify(next));
  };

  // Filtre de période commun aux transactions et aux tâches refusées
  const inPeriod = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    if (txFilter === "today") return date.toDateString() === now.toDateString();
    if (txFilter === "week") return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (txFilter === "month") return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (txFilter === "year") return date.getFullYear() === now.getFullYear();
    return true;
  };

  // ============================================================
  // Landing pour les visiteurs (non connectés) :
  // le contenu marketing est complet, le CTA Connexion/Inscription
  // est affiché EN BAS, là où la liste des tâches apparaît.
  // ============================================================
  const guestLanding = (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 overflow-guard">
      {/* HERO */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-purple-900/50 ring-1 ring-white/15">
          {/* Halo décoratif */}
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-[#F7CB57]/20 blur-3xl pointer-events-none" />
          <div className="card-gradient p-6 relative">
            {/* Identité — carte à fond translucide */}
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30 px-3 py-2.5 shadow-lg shadow-black/20">
              <img
                src="/images/logo.png"
                alt="Rewardly"
                className="w-11 h-11 rounded-xl object-contain bg-white p-1.5 shadow-lg shadow-black/30"
              />
              <div>
                <span className="block text-lg font-extrabold tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                  Rewardly
                </span>
                <span className="block text-[10px] font-semibold tracking-[0.14em] text-white/75 uppercase">
                  Des missions · Du cash
                </span>
              </div>
            </div>

            {/* Titre — grande carte dégradé */}
            <div className="mt-3.5 relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-fuchsia-500/30 to-[#F7CB57]/15 ring-1 ring-white/25 shadow-xl shadow-purple-900/40 p-4">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F7CB57]">
                Prêt à gagner ?
              </p>
              <h1 className="mt-1 text-[1.7rem] font-black leading-tight text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.35)]">
                Votre 1ère tâche vous attend
              </h1>
            </div>

            {/* Description — carte glass */}
            <div className="mt-3 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-3 py-2.5 shadow-lg">
              <p className="text-sm leading-relaxed text-white/90">
                Créez un compte gratuit, accomplissez <strong className="font-bold text-[#F7CB57]">1 tâche par jour</strong> et retirez vos gains en Mobile Money.
              </p>
            </div>

            {/* Wallet (juste le visuel, sans texte) */}
            <div className="mt-5 relative overflow-hidden rounded-3xl shadow-2xl shadow-purple-900/50 ring-1 ring-white/20">
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#F7CB57] via-yellow-300 to-[#F7CB57] z-10" />
              <div className="card-gradient px-6 pt-8 pb-5 relative flex flex-col items-center justify-center">
                <DotLottieReact
                  src="/wallet-loader.json"
                  loop
                  autoplay
                  style={{ width: "100%", maxWidth: "240px", height: "130px" }}
                />
                {/* Bouton Commencer */}
                <button
                  onClick={() => router.push("/register")}
                  className="mt-3 w-full bg-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 shadow-lg shadow-black/30"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <Rocket className="w-4 h-4 text-purple-600" />
                  </div>
                  <span className="font-semibold text-sm text-[#111111]">Commencer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* COMMENT ÇA MARCHE */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-lg font-semibold mb-3">Comment ça marche ?</h2>
        <div className="space-y-3">
          {[
            { icon: Rocket, title: "1. Créez votre compte gratuit", desc: "Inscription en 30 secondes, sans aucun paiement." },
            { icon: CheckCircle, title: "2. Accomplissez la tâche du jour", desc: "Visites, sondages, partages, abonnements : 1 mission / jour." },
            { icon: ArrowUpRight, title: "3. Retirez vos gains", desc: "Crédit instantané, retrait en Mobile Money (Orange, MTN, Wave…)." },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800">
              <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <s.icon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* AVANTAGES */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Pourquoi Rewardly ?</h3>
            <div className="space-y-2">
              {[
                "100% gratuit : aucun pack, aucun investissement, aucun dépôt",
                "1 tâche rémunérée par jour pour tous les utilisateurs",
                "Gains retirables via Mobile Money",
                "Parrainage : gagnez 10% des gains de chaque filleul",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#8A8A8A]">{line}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 🔐 AUTHENTIFICATION EN BAS — là où s'affiche la liste des tâches */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="rounded-2xl border-2 border-purple-300 dark:border-purple-500/40 bg-gradient-to-r from-purple-600 to-purple-800 p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-yellow-400" />
            <h3 className="font-bold text-lg">Vos tâches vous attendent</h3>
          </div>
          <p className="text-purple-100 text-sm mb-4">
            Connectez-vous ou créez votre compte gratuit pour voir la tâche du jour et retirer vos gains.
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={() => router.push("/register")}>
              <Rocket className="w-4 h-4 mr-2" /> Créer un compte gratuit
            </Button>
            <Button size="lg" variant="outline" className="w-full bg-white/10 border border-white/30 text-white" onClick={() => router.push("/login")}>
              <Lock className="w-4 h-4 mr-2" /> Se connecter
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (isLoading) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 overflow-guard">
        <div className="animate-pulse space-y-4">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-3xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PAGE D'ACCUEIL POUR LES VISITEURS (non connectés)
  // Le contenu est affiché en entier ; l'appel à l'authentification
  // est placé EN BAS, là où la liste des tâches apparaît.
  // ============================================================
  if (!user && !isAuthLoading) {
    return guestLanding;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      {/* Bank Card Premium */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl shadow-xl"
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-[#F7CB57] z-10" />
        <div className="card-gradient p-6 pt-8 pb-6 relative">
          {/* Card Header - Balance + Animation Lottie */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Balance totale</p>
              <div className="flex items-center gap-2 mt-1">
                <motion.p
                  key={wallet?.balance || 0}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-bold text-white"
                >
                  {showBalance ? formatCurrency(wallet?.balance || 0) : "*****"}
                </motion.p>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-white/60 hover:text-white transition-colors p-1"
                >
                  {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Animation Lottie Wallet (fichier LOCAL → aucune erreur réseau) */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <DotLottieReact
                src="/wallet-loader.json"
                loop
                autoplay
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </div>

          {/* Card Details - Name + Email */}
          <div className="mb-6">
            <p className="text-white/50 text-xs">{profile?.full_name || "Utilisateur"}</p>
            <p className="text-white text-sm font-medium mt-0.5">
              {user ? (user.email || "Email non défini") : "Non authentifié"}
            </p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
              <p className="text-white/60 text-[10px]">Gains</p>
              <p className="text-white font-bold text-sm">{formatCurrency(wallet?.total_earnings || 0)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
              <p className="text-white/60 text-[10px]">Tâches</p>
              <p className="text-white font-bold text-sm">{tasks.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
              <p className="text-white/60 text-[10px]">Retirable</p>
              <p className="text-white font-bold text-sm">{formatCurrency(withdrawableAmount)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/withdraw")}
              className="bg-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-semibold text-sm text-[#111111]">Retirer</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Annonces (notifications admin) - affichées juste sous la carte balance */}
      {announcements.filter((a) => !dismissedAnnouncements.includes(a.id)).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          {announcements
            .filter((a) => !dismissedAnnouncements.includes(a.id))
            .map((announcement) => (
              <motion.div
                key={announcement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-gradient-to-r from-purple-50 to-white dark:from-purple-500/10 dark:to-[#161616] shadow-sm"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{announcement.title}</h3>
                      <button
                        onClick={() => dismissAnnouncement(announcement.id)}
                        className="text-[#8A8A8A] hover:text-[#111111] dark:hover:text-white transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-[#8A8A8A] mt-1">
                      {announcement.message.replace(/\[LINK\][^\]]*\[\/LINK\]/g, "").trim()}
                    </p>
                    {(() => {
                      const linkMatch = announcement.message?.match(/\[LINK\]([^\]]+)\[\/LINK\]/);
                      const linkUrl = linkMatch ? linkMatch[1] : null;
                      return linkUrl ? (
                        <a
                          href={linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Rejoindre / Voir
                        </a>
                      ) : null;
                    })()}
                    <div className="text-xs text-[#8A8A8A] mt-2 flex items-center gap-1">
                      <Bell className="w-3 h-3" />
                      {formatDate(announcement.created_at, "relative")}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
        </motion.div>
      )}

      {/* (Section packs/investissement supprimée — plateforme 100% gratuite) */}

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid-stats"
      >
        <Card className="p-4">
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-500" />
            </div>
            <p className="text-xs text-[#8A8A8A]">Gains totaux</p>
            <p className="text-sm font-bold">{formatCurrency(wallet?.total_earnings || 0)}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xs text-[#8A8A8A]">Tâches disponibles</p>
            <p className="text-sm font-bold">{tasks.length}</p>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex flex-col gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <Gift className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs text-[#8A8A8A]">Disponible</p>
            <p className="text-sm font-bold">{formatCurrency(withdrawableAmount)}</p>
          </div>
        </Card>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setTxExpanded(!txExpanded)}
                  className="flex items-center gap-2 font-semibold hover:text-purple-600 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${txExpanded ? "rotate-180" : ""}`} />
                  Transactions récentes
                </button>
                <button onClick={refreshWallet} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                  Actualiser
                </button>
              </div>

              {txExpanded && (
              <>
              {/* Filtre par période (liste déroulante compacte) */}
              <div className="relative mb-3">
                <select
                  value={txFilter}
                  onChange={(e) => { setTxFilter(e.target.value as any); setShowAllTx(false); }}
                  className="w-full appearance-none bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                >
                  <option value="all">Toutes les périodes</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="week">7 derniers jours</option>
                  <option value="month">30 derniers jours</option>
                  <option value="year">Cette année</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A] pointer-events-none" />
              </div>

              <div className="space-y-3">
                {transactions
                  .filter((tx) => {
                    const date = new Date(tx.created_at);
                    const now = new Date();
                    if (txFilter === "today") {
                      return date.toDateString() === now.toDateString();
                    }
                    if (txFilter === "week") {
                      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      return date >= weekAgo;
                    }
                    if (txFilter === "month") {
                      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      return date >= monthAgo;
                    }
                    if (txFilter === "year") {
                      return date.getFullYear() === now.getFullYear();
                    }
                    return true;
                  })
                  .slice(0, showAllTx ? 20 : 5)
                  .map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                          tx.type === "reward" ? "bg-purple-100 dark:bg-purple-500/20" :
                          "bg-gray-100 dark:bg-gray-500/20"
                        }`}>
                          {tx.type === "reward" ? <Gift className="w-4 h-4 text-purple-500" /> :
                          <ArrowUpRight className="w-4 h-4 text-gray-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description || tx.type}</p>
                          <p className="text-xs text-[#8A8A8A]">{formatDate(tx.created_at, "relative")}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${
                        tx.type === "reward" ? "text-green-500" : "text-red-500"
                      }`}>
                        {tx.type === "reward" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}

                {transactions.filter((tx) => {
                  const date = new Date(tx.created_at);
                  const now = new Date();
                  if (txFilter === "today") return date.toDateString() === now.toDateString();
                  if (txFilter === "week") return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  if (txFilter === "month") return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  if (txFilter === "year") return date.getFullYear() === now.getFullYear();
                  return true;
                }).length === 0 && (
                  <p className="text-center text-sm text-[#8A8A8A] py-4">Aucune transaction sur cette période</p>
                )}

                {transactions.filter((tx) => {
                  const date = new Date(tx.created_at);
                  const now = new Date();
                  if (txFilter === "today") return date.toDateString() === now.toDateString();
                  if (txFilter === "week") return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                  if (txFilter === "month") return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                  if (txFilter === "year") return date.getFullYear() === now.getFullYear();
                  return true;
                }).length > 5 && (
                  <button
                    onClick={() => setShowAllTx(!showAllTx)}
                    className="w-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-2"
                  >
                    {showAllTx ? "Voir moins" : "Voir plus"}
                  </button>
                )}

                {/* Tâches refusées (avec le motif) */}
                {rejectedTasks.filter((r) => inPeriod(r.created_at)).length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-red-500 mb-2">
                      <XCircle className="w-4 h-4" />
                      Tâche{rejectedTasks.filter((r) => inPeriod(r.created_at)).length > 1 ? "s" : ""} refusée{rejectedTasks.filter((r) => inPeriod(r.created_at)).length > 1 ? "s" : ""}
                    </div>
                    <div className="space-y-3">
                      {rejectedTasks.filter((r) => inPeriod(r.created_at)).map((r) => (
                        <div key={r.id} className="bg-red-50 dark:bg-red-500/10 rounded-xl p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium flex-1 truncate-2">{r.tasks?.title || "Tâche"}</p>
                            <span className="text-xs font-semibold text-red-500">Refusée</span>
                          </div>
                          {r.admin_comment && (
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                              <strong>Motif :</strong> {r.admin_comment}
                            </p>
                          )}
                          <p className="text-xs text-[#8A8A8A] mt-1">{formatDate(r.created_at, "relative")}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </motion.div>

      {/* Tasks Section */}
      {tasks.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes tâches</h2>
            <button onClick={() => router.push("/tasks")} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
              Voir tout
            </button>
          </div>
          {tasks.slice(0, 3).map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-xl flex-shrink-0">
                      {task.icon || "📋"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate-2">{task.title}</h3>
                          {task.description && (
                            <p className="text-xs text-[#8A8A8A] mt-0.5 truncate-2 text-safe">{task.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-green-500 whitespace-nowrap flex-shrink-0">
                          {formatTaskReward(task)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        {task.estimated_time && (
                          <span className="flex items-center gap-1 text-xs text-[#8A8A8A]">
                            <Clock className="w-3 h-3" />
                            {task.estimated_time} min
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${task.validation_type === "auto" ? "bg-green-100 text-green-700 dark:bg-green-500/20" : "bg-amber-100 text-amber-700 dark:bg-amber-500/20"}`}>
                          {task.validation_type === "auto" ? "Auto" : "Manuel"}
                        </span>
                      </div>
                      <Button size="sm" className="mt-3 w-full" variant="outline" onClick={() => router.push("/tasks")}>
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Commencer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
        </div>
      ) : !tasksLoading ? (
        <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4 text-center">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            {completedToday > 0
              ? "Votre tâche du jour est accomplie ✅ Revenez demain pour une nouvelle tâche gratuite."
              : "Aucune tâche disponible pour le moment. Repassez bientôt !"}
          </p>
        </div>
      ) : null}

    </div>
  );
}