"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Check, X, ChevronDown, Users, Wallet, TrendingUp, Gift, Calendar, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getDeposits, validateDepositAction, getUsers } from "@/actions/admin-actions";

interface Deposit {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  reference: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null; username: string | null } | null;
}

type FilterPeriod = "all" | "today" | "yesterday" | "week" | "month" | "year";
type FilterStatus = "all" | "pending" | "approved" | "rejected";

const periods: { key: FilterPeriod; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "today", label: "Aujourd'hui" },
  { key: "yesterday", label: "Hier" },
  { key: "week", label: "Cette semaine" },
  { key: "month", label: "Ce mois" },
  { key: "year", label: "Cette année" },
];

const statuses: { key: FilterStatus; label: string }[] = [
  { key: "all", label: "Tous les statuts" },
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvés" },
  { key: "rejected", label: "Refusés" },
];

export default function AdminDepositsPage() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listExpanded, setListExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadDeposits = async () => {
    try {
      const [data, usersData] = await Promise.all([getDeposits(), getUsers()]);
      setDeposits(data || []);
      setUsers(usersData || []);
    } catch (e) {
      console.error("Failed to load deposits", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const handleValidate = async (id: string, approve: boolean) => {
    await validateDepositAction(id, approve);
    loadDeposits();
  };

  // Filtres par période
  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    return deposits.filter((d) => {
      const itemDate = new Date(d.created_at);
      if (filterPeriod === "today" && itemDate < startOfDay) return false;
      if (filterPeriod === "yesterday" && (itemDate < startOfYesterday || itemDate >= startOfDay)) return false;
      if (filterPeriod === "week" && itemDate < startOfWeek) return false;
      if (filterPeriod === "month" && itemDate < startOfMonth) return false;
      if (filterPeriod === "year" && itemDate < startOfYear) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (search) {
        const name = (d.profiles?.full_name || d.profiles?.username || "").toLowerCase();
        const ref = (d.reference || "").toLowerCase();
        if (!name.includes(search.toLowerCase()) && !ref.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [deposits, filterPeriod, filterStatus, search]);

  // Statistiques
  const stats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const countInRange = (start: Date | null) => {
      return deposits.filter((d) => {
        const date = new Date(d.created_at);
        if (start && date < start) return false;
        return d.status === "approved";
      });
    };

    const today = countInRange(startOfDay);
    const yesterday = deposits.filter((d) => {
      const date = new Date(d.created_at);
      return date >= startOfYesterday && date < startOfDay && d.status === "approved";
    });
    const week = countInRange(startOfWeek);
    const month = countInRange(startOfMonth);
    const year = countInRange(startOfYear);
    const all = countInRange(null);

    const sum = (arr: Deposit[]) => arr.reduce((s, d) => s + d.amount, 0);
    const uniqueUsers = (arr: Deposit[]) => new Set(arr.map((d) => d.user_id)).size;

    return {
      today: { count: today.length, total: sum(today), users: uniqueUsers(today) },
      yesterday: { count: yesterday.length, total: sum(yesterday), users: uniqueUsers(yesterday) },
      week: { count: week.length, total: sum(week), users: uniqueUsers(week) },
      month: { count: month.length, total: sum(month), users: uniqueUsers(month) },
      year: { count: year.length, total: sum(year), users: uniqueUsers(year) },
      all: { count: all.length, total: sum(all), users: uniqueUsers(all) },
    };
  }, [deposits]);

  // Données utilisateur enrichies
  const getUserData = (userId: string) => {
    return users.find((u) => u.user_id === userId);
  };

  const totalFiltered = filtered.reduce((s, d) => s + d.amount, 0);
  const uniqueFilteredUsers = new Set(filtered.map((d) => d.user_id)).size;

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Gestion des dépôts</h1>
            <p className="text-[#8A8A8A] text-sm">
              {deposits.filter((d) => d.status === "pending").length} en attente • {deposits.length} total
            </p>
          </div>
        </div>

        {/* Statistiques par période */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { key: "today", label: "Aujourd'hui", data: stats.today },
            { key: "yesterday", label: "Hier", data: stats.yesterday },
            { key: "week", label: "Semaine", data: stats.week },
            { key: "month", label: "Mois", data: stats.month },
            { key: "year", label: "Année", data: stats.year },
            { key: "all", label: "Total", data: stats.all },
          ].map((stat) => (
            <Card key={stat.key} className="p-3">
              <p className="text-xs text-[#8A8A8A]">{stat.label}</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(stat.data.total)}</p>
              <p className="text-xs text-[#8A8A8A] mt-1">
                {stat.data.count} dépôt{stat.data.count > 1 ? "s" : ""} • {stat.data.users} utilisateur{stat.data.users > 1 ? "s" : ""}
              </p>
            </Card>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
            <Input
              placeholder="Rechercher par nom ou référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <select
              className="h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            >
              {statuses.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Résumé du filtre actuel */}
        <div className="flex items-center gap-2 text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
          <Filter className="w-4 h-4" />
          <span>
            {filtered.length} dépôt{filtered.length > 1 ? "s" : ""} • {formatCurrency(totalFiltered)} • {uniqueFilteredUsers} utilisateur{uniqueFilteredUsers > 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8A8A8A]">Aucun dépôt trouvé</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => setListExpanded(!listExpanded)}
                className="w-full flex items-center justify-between p-4 font-semibold hover:text-purple-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ChevronDown className={`w-4 h-4 transition-transform ${listExpanded ? "rotate-180" : ""}`} />
                  Liste des dépôts
                </span>
                <span className="text-xs text-[#8A8A8A] font-normal">{filtered.length} dépôt{filtered.length > 1 ? "s" : ""}</span>
              </button>

              {listExpanded && (
              <div className="space-y-2 p-4 pt-0">
            {filtered.slice(0, showAll ? filtered.length : 10).map((d) => {
              const userData = getUserData(d.user_id);
              const isExpanded = expandedId === d.id;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="overflow-hidden">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          d.status === "approved" ? "bg-green-100 dark:bg-green-500/20" :
                          d.status === "pending" ? "bg-yellow-100 dark:bg-yellow-500/20" :
                          "bg-red-100 dark:bg-red-500/20"
                        }`}>
                          {d.status === "approved" ? <Check className="w-5 h-5 text-green-500" /> :
                           d.status === "pending" ? <Wallet className="w-5 h-5 text-yellow-500" /> :
                           <X className="w-5 h-5 text-red-500" />}
                        </div>
                        <div className="text-left">
                          <p className="font-medium">{d.profiles?.full_name || d.profiles?.username || "Utilisateur"}</p>
                          <p className="text-xs text-[#8A8A8A]">{formatDate(d.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-green-500">+{formatCurrency(d.amount)}</p>
                          <p className="text-xs text-[#8A8A8A]">{d.method}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#8A8A8A] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                            <p className="text-xs text-[#8A8A8A]">Montant dépôt</p>
                            <p className="font-bold text-green-500">{formatCurrency(d.amount)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                            <p className="text-xs text-[#8A8A8A]">Investissement</p>
                            <p className="font-bold text-blue-500">{formatCurrency(userData?.invested_capital || 0)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                            <p className="text-xs text-[#8A8A8A]">Gains</p>
                            <p className="font-bold text-purple-500">{formatCurrency(userData?.total_earnings || 0)}</p>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                            <p className="text-xs text-[#8A8A8A]">Balance</p>
                            <p className="font-bold">{formatCurrency(userData?.balance || 0)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-[#8A8A8A]">Email</p>
                            <p className="font-medium truncate">{userData?.email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#8A8A8A]">Téléphone</p>
                            <p className="font-medium">{userData?.phone || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#8A8A8A]">Pack</p>
                            <p className="font-medium">{userData?.plan?.name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-[#8A8A8A]">Référence</p>
                            <p className="font-medium truncate">{d.reference || "—"}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            d.status === "approved"
                              ? "bg-green-100 text-green-700"
                              : d.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {d.status === "approved" ? "Dépôt effectué" : d.status === "pending" ? "En attente de paiement" : "Échoué"}
                          </span>
                          <span className="text-xs text-[#8A8A8A]">
                            Crédité automatiquement
                          </span>
                        </div>
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}

            {filtered.length > 10 && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-3"
              >
                {showAll ? "Voir moins" : `Voir tout (${filtered.length})`}
              </button>
            )}
              </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}