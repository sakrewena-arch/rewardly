"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Ban, CheckCircle, Trash2, Shield, Mail, Phone, Wallet, TrendingUp, CheckSquare, Users, ChevronDown, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getUsers, banUserAction, deleteUserAction, getPlans } from "@/actions/admin-actions";

interface UserData {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  role: string;
  is_active: boolean;
  is_banned: boolean;
  created_at: string;
  profile_id: string;
  balance: number;
  total_earnings: number;
  invested_capital: number;
  locked_amount: number;
  plan: {
    id: string;
    name: string;
    slug: string;
    amount: number;
    start_date: string;
    end_date: string;
  } | null;
  deposit_count: number;
  total_deposits: number;
  withdrawal_count: number;
  total_withdrawals: number;
  tasks_completed: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");

  const loadUsers = async (planSlug?: string) => {
    setRefreshing(true);
    try {
      // Charger UNIQUEMENT les vrais utilisateurs depuis la base de données
      const data = await getUsers(planSlug);
      setUsers(data || []);
    } catch (e) {
      console.error("Failed to load users", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getPlans(true).then((data) => setPlans(data || []));
    loadUsers();
  }, []);

  const handlePlanFilter = (slug: string) => {
    setSelectedPlan(slug);
    loadUsers(slug === "all" ? undefined : slug);
  };

  const handleBan = async (userId: string, ban: boolean) => {
    await banUserAction(userId, ban);
    loadUsers(selectedPlan === "all" ? undefined : selectedPlan);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.")) return;
    await deleteUserAction(userId);
    loadUsers(selectedPlan === "all" ? undefined : selectedPlan);
  };

  const filtered = users.filter((u) => {
    // Filtre par période
    const date = new Date(u.created_at);
    const now = new Date();
    if (filterPeriod === "today" && date.toDateString() !== now.toDateString()) return false;
    if (filterPeriod === "week" && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
    if (filterPeriod === "month" && date < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
    if (filterPeriod === "year" && date.getFullYear() !== now.getFullYear()) return false;

    // Recherche
    return (u.email?.toLowerCase().includes(search.toLowerCase()) ||
     u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
     u.username?.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] overflow-guard">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Gestion des utilisateurs</h1>
            <p className="text-[#8A8A8A] text-sm">{users.length} utilisateurs{refreshing ? " (chargement...)" : ""}</p>
          </div>
        </div>

        {/* Plan Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => handlePlanFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedPlan === "all"
                ? "bg-purple-600 text-white"
                : "bg-white dark:bg-[#161616] text-[#8A8A8A] hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            Tous
          </button>
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => handlePlanFilter(plan.slug)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedPlan === plan.slug
                  ? "bg-purple-600 text-white"
                  : "bg-white dark:bg-[#161616] text-[#8A8A8A] hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
            <Input placeholder="Rechercher par nom, email, username..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="relative">
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value as any)}
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

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-[#8A8A8A]">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 font-semibold hover:text-purple-600 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  Liste des utilisateurs
                </span>
                <span className="text-xs text-[#8A8A8A] font-normal">{filtered.length} utilisateur{filtered.length > 1 ? "s" : ""}</span>
              </button>

              {expanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 dark:border-gray-800">
                    <tr className="text-left text-[#8A8A8A]">
                      <th className="p-4 font-medium">Utilisateur</th>
                      <th className="p-4 font-medium">Pack</th>
                      <th className="p-4 font-medium">Wallet</th>
                      <th className="p-4 font-medium">Dépôts</th>
                      <th className="p-4 font-medium">Retraits</th>
                      <th className="p-4 font-medium">Tâches</th>
                      <th className="p-4 font-medium">Statut</th>
                      <th className="p-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, showAll ? filtered.length : 10).map((u) => (
                      <tr key={u.user_id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${u.is_banned ? "from-red-500 to-red-600" : u.plan ? "from-purple-500 to-purple-600" : "from-gray-400 to-gray-500"} flex items-center justify-center text-white font-bold text-xs`}>
                              {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{u.full_name || "—"}</p>
                              <p className="text-xs text-[#8A8A8A]">{u.email}</p>
                              <p className="text-xs text-[#8A8A8A] flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {u.phone || "Pas de téléphone"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {u.plan ? (
                            <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                              {u.plan.name}
                            </span>
                          ) : (
                            <span className="text-xs text-[#8A8A8A]">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <p className="font-medium">{formatCurrency(u.balance)}</p>
                            <p className="text-xs text-green-500">Gains: {formatCurrency(u.total_earnings)}</p>
                            <p className="text-xs text-[#8A8A8A]">Bloqué: {formatCurrency(u.locked_amount)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <p className="font-medium">{u.deposit_count}</p>
                            <p className="text-xs text-green-500">{formatCurrency(u.total_deposits)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <p className="font-medium">{u.withdrawal_count}</p>
                            <p className="text-xs text-orange-500">{formatCurrency(u.total_withdrawals)}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-purple-500" />
                            <span className="font-medium">{u.tasks_completed}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            u.is_banned ? "bg-red-100 text-red-700" :
                            u.is_active ? "bg-green-100 text-green-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {u.is_banned ? "Banni" : u.is_active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleBan(u.user_id, !u.is_banned)}
                              className={`w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center ${u.is_banned ? "text-green-500" : "text-red-500"}`}
                              title={u.is_banned ? "Débannir" : "Bannir"}
                            >
                              {u.is_banned ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDelete(u.user_id)}
                              className="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

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