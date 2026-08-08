"use client";

import { motion } from "framer-motion";
import { TrendingUp, DollarSign, CheckSquare, Target, Wallet, Gift, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useTasks } from "@/hooks/useTasks";
import { useAuth } from "@/context/AuthContext";
import { AnalyticsAuth } from "@/components/features/AuthRequiredPages";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  ArcElement,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, ArcElement, Legend);

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { wallet, transactions, isLoading: walletLoading, withdrawableAmount } = useWallet();
  const { submissions, isLoading: tasksLoading } = useTasks();

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <AnalyticsAuth />;
  }

  const isLoading = walletLoading || tasksLoading;

  const totalEarnings = wallet?.total_earnings || 0;
  const totalInvested = wallet?.invested_capital || 0;
  const currentBalance = wallet?.balance || 0;

  const completedTasks = submissions.filter((s) => s.status === "approved").length;
  const pendingTasks = submissions.filter((s) => s.status === "pending").length;
  const rejectedTasks = submissions.filter((s) => s.status === "rejected").length;
  const totalTasks = submissions.length;

  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
  const pendingRate = totalTasks > 0 ? Math.round((pendingTasks / totalTasks) * 100) : 0;
  const failedRate = totalTasks > 0 ? Math.round((rejectedTasks / totalTasks) * 100) : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toLocaleDateString("fr-FR", { weekday: "short" });
  });

  const dailyEarnings = last7Days.map((_, dayIndex) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - dayIndex));
    const dayStart = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(day.setHours(23, 59, 59, 999));
    return transactions
      .filter((tx) => {
        const txDate = new Date(tx.created_at);
        return (tx.type === "reward" || tx.type === "bonus") && 
               txDate >= dayStart && txDate <= dayEnd;
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  });

  const lineData = {
    labels: last7Days,
    datasets: [
      {
        label: "Gains",
        data: dailyEarnings,
        fill: true,
        borderColor: "#9D3FE7",
        backgroundColor: "rgba(157, 63, 231, 0.1)",
        tension: 0.4,
        pointBackgroundColor: "#9D3FE7",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#8A8A8A" } },
      y: { grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#8A8A8A", callback: (v: any) => v + " F" } },
    },
  };

  const doughnutData = {
    labels: ["Tâches complétées", "En attente", "Refusées"],
    datasets: [
      {
        data: [Math.max(successRate, totalTasks > 0 ? 1 : 100), pendingRate, failedRate],
        backgroundColor: ["#9D3FE7", "#F7CB57", "#EF4444"],
        borderWidth: 0,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    cutout: "70%",
  };

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-[#8A8A8A] text-sm mt-1">Vos statistiques détaillées</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium flex items-center gap-0.5 text-green-500">
              <TrendingUp className="w-3 h-3" />
              +{totalEarnings > 0 ? Math.round((totalEarnings / Math.max(1, currentBalance)) * 100) : 0}%
            </span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(totalEarnings)}</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">Gains totaux</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <CheckSquare className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium flex items-center gap-0.5 text-green-500">
              <TrendingUp className="w-3 h-3" />
              +{completedTasks}
            </span>
          </div>
          <p className="text-lg font-bold">{completedTasks}</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">Tâches complétées</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium flex items-center gap-0.5 text-green-500">
              <TrendingUp className="w-3 h-3" />
              +{successRate}%
            </span>
          </div>
          <p className="text-lg font-bold">{successRate}%</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">Taux de réussite</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Wallet className="w-4 h-4 text-yellow-500" />
            <span className="text-xs font-medium flex items-center gap-0.5 text-green-500">
              <TrendingUp className="w-3 h-3" />
              +{formatCurrency(currentBalance)}
            </span>
          </div>
          <p className="text-lg font-bold">{formatCurrency(currentBalance)}</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">Balance</p>
        </Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Gains hebdomadaires</h3>
          <Line data={lineData} options={lineOptions} />
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Statut des soumissions</h3>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="space-y-2">
              {doughnutData.labels.map((label, i) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: doughnutData.datasets[0].backgroundColor[i] }} />
                  <span className="text-sm text-[#8A8A8A]">{label}</span>
                  <span className="text-sm font-medium">{doughnutData.datasets[0].data[i]}%</span>
                </div>
              ))}
              <p className="text-xs text-[#8A8A8A]">
                {completedTasks} complétée{completedTasks > 1 ? "s" : ""} • {pendingTasks} en attente • {rejectedTasks} refusée{rejectedTasks > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Résumé financier</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Balance disponible</span>
                <span className="font-medium">{formatCurrency(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Capital investi</span>
                <span className="font-medium">{formatCurrency(totalInvested)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Gains cumulés</span>
                <span className="font-medium text-green-500">{formatCurrency(totalEarnings)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Montant retirable</span>
                <span className="font-medium text-blue-500">{formatCurrency(withdrawableAmount)}</span>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-2 flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Transactions</span>
                <span className="font-medium">{transactions.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Soumissions totales</span>
                <span className="font-medium">{submissions.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}