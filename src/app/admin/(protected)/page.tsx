"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, DollarSign, CheckSquare, TrendingUp, ArrowUpRight, Settings, Shield, Bell, Activity, Wallet, Clock, BadgeCheck, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { getPlatformStats } from "@/actions/admin-actions";

interface PlatformStats {
  total_users: number;
  total_deposits: number;
  total_withdrawals: number;
  total_earnings: number;
  total_investments: number;
  pending_deposits: number;
  pending_withdrawals: number;
  pending_submissions: number;
  plans_with_users: Array<{
    plan_id: string;
    plan_name: string;
    plan_slug: string;
    plan_price: number;
    user_count: number;
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlatformStats().then((data) => {
      setStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const adminMenu = [
    { icon: Users, label: "Utilisateurs", href: "/admin/users", desc: "Gérer les utilisateurs", color: "from-blue-500 to-blue-600" },
    { icon: DollarSign, label: "Dépôts", href: "/admin/deposits", desc: "Dépôts effectués", color: "from-green-500 to-green-600" },
    { icon: TrendingUp, label: "Retraits", href: "/admin/withdrawals", desc: "Gérer les retraits", color: "from-orange-500 to-orange-600" },
    { icon: CheckSquare, label: "Tâches", href: "/admin/tasks", desc: "Créer et gérer les tâches", color: "from-purple-500 to-purple-600" },
    { icon: Shield, label: "Packs", href: "/admin/plans", desc: "Gérer les packs", color: "from-cyan-500 to-cyan-600" },
    { icon: Bell, label: "Notifications", href: "/admin/notifications", desc: "Notifications push", color: "from-pink-500 to-pink-600" },
    { icon: Settings, label: "Paramètres", href: "/admin/settings", desc: "Configuration", color: "from-gray-500 to-gray-600" },
    { icon: Activity, label: "Analytics", href: "/admin/analytics", desc: "Statistiques", color: "from-indigo-500 to-indigo-600" },
    { icon: Megaphone, label: "Services", href: "/admin/services", desc: "Commandes publicitaires", color: "from-rose-500 to-rose-600" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administration</h1>
            <p className="text-[#8A8A8A] text-sm">Panneau de contrôle de la plateforme</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
            Retour au site
          </Button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Stats Grid - Real Data */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <span className="text-xs font-medium flex items-center gap-0.5 text-green-500">
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
                <p className="text-2xl font-bold">{stats?.total_users ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Utilisateurs</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_deposits ?? 0)}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Dépôts validés</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_withdrawals ?? 0)}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Retraits payés</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-purple-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_investments ?? 0)}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Capital investi</p>
              </Card>
            </div>

            {/* Pending Approvals */}
            <div className="grid grid-cols-3 gap-4">
              <Card className={`p-4 ${(stats?.pending_deposits ?? 0) > 0 ? "border-yellow-300 dark:border-yellow-500/30" : ""}`}>
                <p className="text-3xl font-bold text-yellow-500">{stats?.pending_deposits ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Dépôts en attente</p>
              </Card>
              <Card className={`p-4 ${(stats?.pending_withdrawals ?? 0) > 0 ? "border-yellow-300 dark:border-yellow-500/30" : ""}`}>
                <p className="text-3xl font-bold text-orange-500">{stats?.pending_withdrawals ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Retraits en attente</p>
              </Card>
              <Card className={`p-4 ${(stats?.pending_submissions ?? 0) > 0 ? "border-purple-300 dark:border-purple-500/30" : ""}`}>
                <p className="text-3xl font-bold text-purple-500">{stats?.pending_submissions ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Validations de tâches</p>
              </Card>
            </div>

            {/* Users per Plan */}
            {stats?.plans_with_users && stats.plans_with_users.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h2 className="font-semibold mb-4">Utilisateurs par pack</h2>
                  <div className="grid md:grid-cols-3 gap-4">
                    {stats.plans_with_users.map((plan) => (
                      <div key={plan.plan_id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Shield className="w-4 h-4 text-purple-500" />
                          <span className="font-semibold">{plan.plan_name}</span>
                        </div>
                        <p className="text-3xl font-bold">{plan.user_count}</p>
                        <p className="text-xs text-[#8A8A8A] mt-1">utilisateurs actifs</p>
                        <p className="text-xs text-purple-500 mt-1">{formatCurrency(plan.plan_price)} / pack</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Admin Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {adminMenu.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => router.push(item.href)}
              className="flex items-start gap-4 p-4 bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800 hover:shadow-md transition-all text-left"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                <item.icon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{item.label}</h3>
                <p className="text-xs text-[#8A8A8A] mt-0.5">{item.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}