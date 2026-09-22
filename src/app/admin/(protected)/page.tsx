"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, CheckSquare, TrendingUp, ArrowUpRight, Settings, Bell, Activity, Wallet, Clock, BadgeCheck, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { getPlatformStats } from "@/actions/admin-actions";

interface PlatformStats {
  total_users: number;
  total_tasks: number;
  total_withdrawals: number;
  total_earnings: number;
  pending_withdrawals: number;
  pending_submissions: number;
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
    { icon: TrendingUp, label: "Retraits", href: "/admin/withdrawals", desc: "Gérer les retraits", color: "from-orange-500 to-orange-600" },
    { icon: CheckSquare, label: "Tâches", href: "/admin/tasks", desc: "Créer et gérer les tâches", color: "from-purple-500 to-purple-600" },
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
                    <CheckSquare className="w-5 h-5 text-green-500" />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stats?.total_tasks ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Tâches</p>
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
                <p className="text-2xl font-bold">{formatCurrency(stats?.total_earnings ?? 0)}</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Gains totaux</p>
              </Card>
            </div>

            {/* Pending Approvals */}
            <div className="grid grid-cols-2 gap-4">
              <Card className={`p-4 ${(stats?.pending_withdrawals ?? 0) > 0 ? "border-yellow-300 dark:border-yellow-500/30" : ""}`}>
                <p className="text-3xl font-bold text-orange-500">{stats?.pending_withdrawals ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Retraits en attente</p>
              </Card>
              <Card className={`p-4 ${(stats?.pending_submissions ?? 0) > 0 ? "border-purple-300 dark:border-purple-500/30" : ""}`}>
                <p className="text-3xl font-bold text-purple-500">{stats?.pending_submissions ?? 0}</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Validations de tâches</p>
              </Card>
            </div>
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