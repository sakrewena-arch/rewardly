"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Users, DollarSign, TrendingUp, Wallet, CheckSquare, Clock, XCircle, Bell, Target, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getAdminAnalytics } from "@/actions/admin-actions";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Filler,
  ArcElement,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, ArcElement, Legend);

interface AnalyticsData {
  dayLabels: string[];
  registrationsByDay: number[];
  depositsByDay: number[];
  withdrawalsByDay: number[];
  tasksByDay: number[];
  submissionsByDay: number[];
  investmentsByDay: number[];
  notificationsByDay: number[];
  totalUsers: number;
  totalTasks: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalEarnings: number;
  totalBalance: number;
  totalInvestments: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  totalNotifications: number;
  conversionRate: number;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminAnalytics().then((d) => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
            <div className="grid grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
              <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
        <div className="max-w-6xl mx-auto p-4 md:p-6">
          <p className="text-center text-[#8A8A8A] py-12">Impossible de charger les données analytiques.</p>
        </div>
      </div>
    );
  }

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8A8A8A" } },
      y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#8A8A8A" } },
    },
  };

  const registrationsData = {
    labels: data.dayLabels,
    datasets: [{
      label: "Inscriptions",
      data: data.registrationsByDay,
      fill: true,
      borderColor: "#9D3FE7",
      backgroundColor: "rgba(157, 63, 231, 0.1)",
      tension: 0.4,
      pointBackgroundColor: "#9D3FE7",
      pointRadius: 4,
    }],
  };

  const financialData = {
    labels: data.dayLabels,
    datasets: [
      {
        label: "Dépôts",
        data: data.depositsByDay,
        borderColor: "#22C55E",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#22C55E",
        pointRadius: 4,
      },
      {
        label: "Retraits",
        data: data.withdrawalsByDay,
        borderColor: "#EF4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#EF4444",
        pointRadius: 4,
      },
    ],
  };

  const activityData = {
    labels: data.dayLabels,
    datasets: [
      {
        label: "Tâches créées",
        data: data.tasksByDay,
        backgroundColor: "#9D3FE7",
        borderRadius: 6,
      },
      {
        label: "Soumissions",
        data: data.submissionsByDay,
        backgroundColor: "#F7CB57",
        borderRadius: 6,
      },
      {
        label: "Notifications",
        data: data.notificationsByDay,
        backgroundColor: "#3B82F6",
        borderRadius: 6,
      },
    ],
  };

  const investmentsData = {
    labels: data.dayLabels,
    datasets: [{
      label: "Investissements (FCFA)",
      data: data.investmentsByDay,
      fill: true,
      borderColor: "#F59E0B",
      backgroundColor: "rgba(245, 158, 11, 0.1)",
      tension: 0.4,
      pointBackgroundColor: "#F59E0B",
      pointRadius: 4,
    }],
  };

  const submissionsDoughnut = {
    labels: ["Validées", "En attente", "Refusées"],
    datasets: [{
      data: [data.approvedSubmissions, data.pendingSubmissions, data.rejectedSubmissions],
      backgroundColor: ["#22C55E", "#F7CB57", "#EF4444"],
      borderWidth: 0,
    }],
  };

  const doughnutOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    cutout: "70%",
  };

  const stats = [
    { icon: Users, label: "Utilisateurs", value: data.totalUsers.toString(), color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-500/20" },
    { icon: DollarSign, label: "Dépôts totaux", value: formatCurrency(data.totalDeposits), color: "text-green-500", bg: "bg-green-100 dark:bg-green-500/20" },
    { icon: TrendingUp, label: "Retraits totaux", value: formatCurrency(data.totalWithdrawals), color: "text-red-500", bg: "bg-red-100 dark:bg-red-500/20" },
    { icon: Wallet, label: "Gains totaux", value: formatCurrency(data.totalEarnings), color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-500/20" },
    { icon: Target, label: "Investissements", value: formatCurrency(data.totalInvestments), color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-500/20" },
    { icon: CheckSquare, label: "Tâches", value: data.totalTasks.toString(), color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-500/20" },
    { icon: Activity, label: "Soumissions", value: data.totalSubmissions.toString(), color: "text-green-500", bg: "bg-green-100 dark:bg-green-500/20" },
    { icon: Bell, label: "Notifications", value: data.totalNotifications.toString(), color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-500/20" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Analytics</h1>
            <p className="text-[#8A8A8A] text-sm">Statistiques détaillées de la plateforme</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <p className="text-lg font-bold">{stat.value}</p>
                  <p className="text-xs text-[#8A8A8A]">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Conversion Rate */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-purple-500" /> Taux de conversion</h3>
                  <p className="text-sm text-[#8A8A8A] mt-1">Pourcentage d'utilisateurs ayant investi</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-purple-500">{data.conversionRate}%</p>
                  <p className="text-xs text-[#8A8A8A]">{data.totalUsers} utilisateurs</p>
                </div>
              </div>
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, data.conversionRate)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Inscriptions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-purple-500" /> Inscriptions (7 derniers jours)</h3>
              <Line data={registrationsData} options={lineOptions} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Dépôts vs Retraits */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-500" /> Dépôts vs Retraits (7 derniers jours)</h3>
              <Line data={financialData} options={{ ...lineOptions, plugins: { legend: { display: true, position: "bottom" as const } } }} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Activité */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Activité (7 derniers jours)</h3>
              <Bar data={activityData} options={{ ...lineOptions, plugins: { legend: { display: true, position: "bottom" as const } } }} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Investissements */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-yellow-500" /> Investissements (7 derniers jours)</h3>
              <Line data={investmentsData} options={lineOptions} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Soumissions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-green-500" /> Statut des soumissions</h3>
              <div className="flex items-center gap-6">
                <div className="w-40 h-40">
                  <Doughnut data={submissionsDoughnut} options={doughnutOptions} />
                </div>
                <div className="space-y-2">
                  {submissionsDoughnut.labels.map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: submissionsDoughnut.datasets[0].backgroundColor[i] }} />
                      <span className="text-sm text-[#8A8A8A]">{label}</span>
                      <span className="text-sm font-medium">{submissionsDoughnut.datasets[0].data[i]}</span>
                    </div>
                  ))}
                  <p className="text-xs text-[#8A8A8A] pt-2">
                    {data.approvedSubmissions} validée{data.approvedSubmissions > 1 ? "s" : ""} • {data.pendingSubmissions} en attente • {data.rejectedSubmissions} refusée{data.rejectedSubmissions > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Résumé financier */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-500" /> Résumé financier</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Balance totale</p>
                  <p className="text-lg font-bold">{formatCurrency(data.totalBalance)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Gains totaux</p>
                  <p className="text-lg font-bold text-green-500">{formatCurrency(data.totalEarnings)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Investissements</p>
                  <p className="text-lg font-bold text-yellow-500">{formatCurrency(data.totalInvestments)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Dépôts</p>
                  <p className="text-lg font-bold text-green-500">{formatCurrency(data.totalDeposits)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Retraits</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(data.totalWithdrawals)}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <p className="text-xs text-[#8A8A8A]">Soumissions</p>
                  <p className="text-lg font-bold">{data.totalSubmissions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}