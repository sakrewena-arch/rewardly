"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, XCircle, ArrowLeft, Search, TrendingUp, Gift, Wallet, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useTasks } from "@/hooks/useTasks";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { HistoryAuth } from "@/components/features/AuthRequiredPages";

type FilterPeriod = "all" | "today" | "week" | "month" | "year";
type FilterType = "all" | "reward" | "deposit" | "withdrawal" | "investment" | "pending" | "approved" | "rejected";

const periods: { key: FilterPeriod; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "today", label: "Aujourd'hui" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "year", label: "Cette année" },
];

interface HistoryItem {
  id: string;
  type: "transaction" | "submission";
  status: string;
  amount: number;
  description: string;
  created_at: string;
  icon: "deposit" | "reward" | "withdrawal" | "investment" | "task-pending" | "task-approved" | "task-rejected";
}

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { transactions, wallet } = useWallet();
  const { submissions, completedToday } = useTasks();
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterType>("all");
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <HistoryAuth />;
  }

  // Fusionner les transactions wallet + les soumissions de tâches
  // Pour les soumissions, on cherche la transaction wallet correspondante pour obtenir le montant réel crédité
  const historyItems: HistoryItem[] = [
    ...(submissions || []).map((sub: any) => {
      // Chercher la transaction wallet correspondante (même tâche, même date)
      const matchingTx = transactions.find(
        (tx) => tx.type === "reward" && 
        Math.abs(new Date(tx.created_at).getTime() - new Date(sub.created_at).getTime()) < 60000
      );
      return {
        id: sub.id,
        type: "submission" as const,
        status: sub.status || "pending",
        // Utiliser le montant de la transaction wallet si disponible, sinon celui de la tâche
        amount: matchingTx?.amount || sub.task?.amount || 0,
        description: sub.task?.title || "Tâche",
        created_at: sub.created_at,
        icon: (sub.status === "approved" ? "task-approved" :
              sub.status === "rejected" ? "task-rejected" : "task-pending") as any,
      };
    }),
    ...transactions.map((tx) => ({
      id: tx.id,
      type: "transaction" as const,
      status: tx.status || "completed",
      amount: tx.amount,
      description: tx.description || tx.type,
      created_at: tx.created_at,
      icon: tx.type as any,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getFilteredItems = () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return historyItems.filter((item) => {
      const itemDate = new Date(item.created_at);
      if (filterPeriod === "today" && itemDate < startOfDay) return false;
      if (filterPeriod === "week" && itemDate < startOfWeek) return false;
      if (filterPeriod === "month" && itemDate < startOfMonth) return false;
      if (filterPeriod === "year" && itemDate < startOfYear) return false;
      if (statusFilter === "pending" && (item.type !== "submission" || item.status !== "pending")) return false;
      if (statusFilter === "approved" && (item.type !== "submission" || item.status !== "approved")) return false;
      if (statusFilter === "rejected" && (item.type !== "submission" || item.status !== "rejected")) return false;
      if (["reward", "deposit", "withdrawal", "investment"].includes(statusFilter)) {
        if (item.type !== "transaction" || item.icon !== statusFilter) return false;
      }
      if (search && !item.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  };

  const filteredItems = getFilteredItems();
  const rewardTransactions = transactions.filter(tx => tx.type === "reward");
  const totalRewards = rewardTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const pendingSubmissions = (submissions || []).filter((s: any) => s.status === "pending").length;

  const getItemStyle = (item: HistoryItem) => {
    switch (item.icon) {
      case "deposit": return { bg: "bg-green-100 dark:bg-green-500/20", color: "text-green-500", icon: <Wallet className="w-4 h-4" />, sign: "+" };
      case "reward": return { bg: "bg-purple-100 dark:bg-purple-500/20", color: "text-purple-500", icon: <Gift className="w-4 h-4" />, sign: "+" };
      case "withdrawal": return { bg: "bg-red-100 dark:bg-red-500/20", color: "text-red-500", icon: <TrendingUp className="w-4 h-4" />, sign: "-" };
      case "investment": return { bg: "bg-blue-100 dark:bg-blue-500/20", color: "text-blue-500", icon: <TrendingUp className="w-4 h-4" />, sign: "-" };
      case "task-pending": return { bg: "bg-yellow-100 dark:bg-yellow-500/20", color: "text-yellow-500", icon: <Clock className="w-4 h-4" />, sign: "+" };
      case "task-approved": return { bg: "bg-green-100 dark:bg-green-500/20", color: "text-green-500", icon: <CheckCircle className="w-4 h-4" />, sign: "+" };
      case "task-rejected": return { bg: "bg-red-100 dark:bg-red-500/20", color: "text-red-500", icon: <XCircle className="w-4 h-4" />, sign: "+" };
      default: return { bg: "bg-gray-100 dark:bg-gray-500/20", color: "text-gray-500", icon: <Clock className="w-4 h-4" />, sign: "" };
    }
  };

  const getStatusLabel = (item: HistoryItem) => {
    if (item.type === "submission") {
      if (item.status === "approved") return "Validée";
      if (item.status === "rejected") return "Refusée";
      return "En attente";
    }
    if (item.status === "completed") return "Terminé";
    if (item.status === "pending") return "En attente";
    return item.status;
  };

  const getStatusColor = (item: HistoryItem) => {
    if (item.type === "submission") {
      if (item.status === "approved") return "bg-green-100 text-green-700 dark:bg-green-500/20";
      if (item.status === "rejected") return "bg-red-100 text-red-700 dark:bg-red-500/20";
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20";
    }
    if (item.status === "completed") return "bg-green-100 text-green-700 dark:bg-green-500/20";
    if (item.status === "pending") return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20";
    return "bg-red-100 text-red-700 dark:bg-red-500/20";
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Historique</h1>
          <p className="text-[#8A8A8A] text-sm">Tâches accomplies, gains et transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{completedToday}</p>
          <p className="text-xs text-[#8A8A8A]">Aujourd'hui</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{(submissions || []).length}</p>
          <p className="text-xs text-[#8A8A8A]">Total tâches</p>
        </Card>
        <Card className="p-3 text-center">
          <Gift className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-500">{formatCurrency(totalRewards)}</p>
          <p className="text-xs text-[#8A8A8A]">Gains</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-500" />
              <span className="text-sm font-medium">Balance actuelle</span>
            </div>
            <span className="text-lg font-bold">{formatCurrency(wallet?.balance || 0)}</span>
          </div>
        </CardContent>
      </Card>

      {pendingSubmissions > 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-3 flex items-center gap-3 border border-amber-200 dark:border-amber-500/20">
          <Clock className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            <strong>{pendingSubmissions} soumission{pendingSubmissions > 1 ? "s" : ""} en attente</strong> de validation
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {periods.map((period) => (
          <button
            key={period.key}
            onClick={() => setFilterPeriod(period.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filterPeriod === period.key
                ? "bg-purple-600 text-white"
                : "bg-white dark:bg-[#161616] text-[#8A8A8A] hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
        <Input
          placeholder="Rechercher dans l'historique..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: "all", label: "Tous" },
          { key: "reward", label: "Gains" },
          { key: "deposit", label: "Dépôts" },
          { key: "withdrawal", label: "Retraits" },
          { key: "investment", label: "Investissements" },
          { key: "pending", label: "En attente" },
          { key: "approved", label: "Validées" },
          { key: "rejected", label: "Refusées" },
        ].map((type) => (
          <button
            key={type.key}
            onClick={() => setStatusFilter(type.key as FilterType)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === type.key
                ? "bg-purple-100 dark:bg-purple-500/20 text-purple-600"
                : "bg-gray-100 dark:bg-gray-800 text-[#8A8A8A]"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between font-semibold hover:text-purple-600 transition-colors"
          >
            <span className="flex items-center gap-2">
              <ChevronDown className={`w-4 h-4 transition-transform ${historyExpanded ? "rotate-180" : ""}`} />
              Historique complet
            </span>
            <span className="text-xs text-[#8A8A8A] font-normal">{filteredItems.length} élément{filteredItems.length > 1 ? "s" : ""}</span>
          </button>

          {historyExpanded && (
            <div className="space-y-2 mt-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-[#8A8A8A] text-sm">Aucun élément trouvé</p>
                </div>
              ) : (
                <>
                  {filteredItems.slice(0, showAllHistory ? filteredItems.length : 10).map((item, index) => {
                    const style = getItemStyle(item);
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${style.bg}`}>
                                  {style.icon}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{item.description}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-[#8A8A8A]">{formatDate(item.created_at, "relative")}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getStatusColor(item)}`}>
                                      {getStatusLabel(item)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className={`text-sm font-semibold ${style.color}`}>
                                {style.sign}{formatCurrency(item.amount)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}

                  {filteredItems.length > 10 && (
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="w-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-2"
                    >
                      {showAllHistory ? "Voir moins" : `Voir tout (${filteredItems.length})`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}