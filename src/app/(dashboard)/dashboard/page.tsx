"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Wallet, TrendingUp, Gift, Eye, EyeOff, ExternalLink, Clock, Crown, Star, Bell, Megaphone, X, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { useTasks } from "@/hooks/useTasks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const plans = [
  {
    name: "Bronze", price: 5000, tasks: "1 tâche/jour", profitability: "10% - 20%", badge: "Bronze",
    color: "from-amber-700 to-amber-600", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/20",
  },
  {
    name: "Silver", price: 10000, tasks: "3 tâches/jour", profitability: "20% - 30%", badge: "Silver",
    color: "from-gray-400 to-gray-300", badgeColor: "bg-gray-100 text-gray-600 dark:bg-gray-500/20",
  },
  {
    name: "Gold", price: 20000, tasks: "Toutes les tâches", profitability: "40% - 50%", badge: "Premium",
    color: "from-yellow-500 to-yellow-400", badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20",
  },
];

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const { wallet, transactions, isLoading, withdrawableAmount, refreshWallet } = useWallet();
  const { tasks, hasPack, userPlanSlug } = useTasks();
  const effectivePlanSlug = userPlanSlug;
  const router = useRouter();
  const [showBalance, setShowBalance] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [txFilter, setTxFilter] = useState<"today" | "week" | "month" | "year" | "all">("all");
  const [showAllTx, setShowAllTx] = useState(false);
  const [txExpanded, setTxExpanded] = useState(true);
  const isGoldPlan = effectivePlanSlug === "gold";
  const showUpgradeCard = !isGoldPlan;

  // Charger les notifications (annonces) pour l'utilisateur connecté
  useEffect(() => {
    if (!user) return;
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
            {/* Animation Lottie Wallet */}
            <div className="relative w-20 h-20 flex-shrink-0">
              <DotLottieReact
                src="https://lottie.host/50442351-6dc1-41b7-a313-e51d8f625e3a/gqYGBd7Mvi.json"
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
              <p className="text-white/60 text-[10px]">Investi</p>
              <p className="text-white font-bold text-sm">{formatCurrency(wallet?.invested_capital || 0)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 text-center">
              <p className="text-white/60 text-[10px]">Retirable</p>
              <p className="text-white font-bold text-sm">{formatCurrency(withdrawableAmount)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/deposit")}
              className="bg-white rounded-xl py-3 px-4 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
            >
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 text-green-600" />
              </div>
              <span className="font-semibold text-sm text-[#111111]">Déposer</span>
            </motion.button>
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

      {/* Available Packs - shown when no pack is active */}
      {!hasPack && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4 text-center mb-4">
            <Crown className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <h2 className="font-semibold text-sm mb-1">Aucun pack actif</h2>
            <p className="text-xs text-[#8A8A8A]">Choisissez un pack pour commencer à gagner de l'argent</p>
          </div>
          <h2 className="text-lg font-semibold mb-3">Packs disponibles</h2>
          <div className="space-y-3">
            {plans.map((plan, index) => (
              <motion.div key={plan.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }}>
                <Card className="overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <p className="text-2xl font-bold mt-1">{formatCurrency(plan.price)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${plan.badgeColor}`}>{plan.badge}</span>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#8A8A8A]">Tâches</span>
                        <span className="font-medium">{plan.tasks}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#8A8A8A]">Rentabilité</span>
                        <span className="font-medium text-green-500">{plan.profitability}</span>
                      </div>
                    </div>
                    <Button className="w-full" variant={plan.name === "Gold" ? "purple" : "outline"} onClick={() => router.push(`/invest?plan=${plan.name.toLowerCase()}`)}>
                      <Crown className="w-4 h-4 mr-2" /> Choisir ce pack
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Upgrade Banner - only visible when user has a pack */}
      {hasPack ? (
        showUpgradeCard ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-600 to-purple-800 p-5 text-white shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-lg">Améliorez votre plan</h3>
              </div>
              <p className="text-purple-100 text-sm">
                {effectivePlanSlug === "bronze" || !effectivePlanSlug
                  ? "Passez au Silver ou au Gold pour débloquer plus de tâches et des gains plus élevés."
                  : "Passez au Gold pour profiter de toutes les missions disponibles."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {(!effectivePlanSlug || effectivePlanSlug === "bronze") && (
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
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-2xl p-5 text-white"
          >
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-white" />
              <div>
                <h3 className="font-bold">Plan Gold</h3>
                <p className="text-yellow-100 text-sm">Vous avez le meilleur pack ! Tâches illimitées.</p>
              </div>
            </div>
          </motion.div>
        )
      ) : null}

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
            <p className="text-xs text-[#8A8A8A]">Capital investi</p>
            <p className="text-sm font-bold">{formatCurrency(wallet?.invested_capital || 0)}</p>
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
      {transactions.length > 0 && (
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
                          tx.type === "deposit" ? "bg-green-100 dark:bg-green-500/20" :
                          tx.type === "reward" ? "bg-purple-100 dark:bg-purple-500/20" :
                          tx.type === "investment" ? "bg-blue-100 dark:bg-blue-500/20" :
                          "bg-gray-100 dark:bg-gray-500/20"
                        }`}>
                          {tx.type === "deposit" ? <ArrowDownLeft className="w-4 h-4 text-green-500" /> :
                           tx.type === "reward" ? <Gift className="w-4 h-4 text-purple-500" /> :
                           tx.type === "investment" ? <Wallet className="w-4 h-4 text-blue-500" /> :
                           <ArrowUpRight className="w-4 h-4 text-gray-500" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.description || tx.type}</p>
                          <p className="text-xs text-[#8A8A8A]">{formatDate(tx.created_at, "relative")}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${
                        tx.type === "deposit" || tx.type === "reward" ? "text-green-500" : "text-red-500"
                      }`}>
                        {tx.type === "deposit" || tx.type === "reward" ? "+" : "-"}{formatCurrency(tx.amount)}
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
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tasks Section - always shown when user has a pack */}
      {tasks.length > 0 && (
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
                        <div>
                          <h3 className="font-semibold text-sm">{task.title}</h3>
                          <p className="text-xs text-[#8A8A8A] mt-0.5">{task.description}</p>
                        </div>
                        <span className="text-sm font-bold text-green-500 whitespace-nowrap">
                          +{formatCurrency(task.amount)}
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
      )}

    </div>
  );
}