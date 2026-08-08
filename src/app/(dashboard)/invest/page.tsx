"use client";

import { Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Clock, TrendingUp, Wallet, Shield, Star, Crown, Medal, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { activatePlanAction } from "@/actions/user-actions";
import { getPlans as getPlansFromServer } from "@/actions/admin-actions";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { InvestAuth } from "@/components/features/AuthRequiredPages";

const plansData: Record<string, any> = {
  bronze: { name: "Bronze", price: 5000, slug: "bronze", tasks: 1, minProfit: 10, maxProfit: 20, badge: "Bronze", color: "from-amber-700 to-amber-600", badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-500/20", icon: Medal, dailyTasks: 1,
    features: ["1 tâche rémunérée par jour", "Rentabilité entre 10% et 20%", "Accès aux tâches Bronze", "Support prioritaire", "Retrait après 7 jours"],
  },
  silver: { name: "Silver", price: 10000, slug: "silver", tasks: 3, minProfit: 20, maxProfit: 30, badge: "Silver", color: "from-gray-400 to-gray-300", badgeColor: "bg-gray-100 text-gray-600 dark:bg-gray-500/20", icon: Star, dailyTasks: 3,
    features: ["3 tâches rémunérées par jour", "Rentabilité entre 20% et 30%", "Accès aux tâches Silver", "Support prioritaire", "Retrait après 7 jours", "Badge exclusif"],
  },
  gold: { name: "Gold", price: 20000, slug: "gold", tasks: -1, minProfit: 40, maxProfit: 50, badge: "Premium", color: "from-yellow-500 to-yellow-400", badgeColor: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20", icon: Crown, dailyTasks: -1,
    features: ["Tâches illimitées chaque jour", "Rentabilité entre 40% et 50%", "Accès à toutes les tâches", "Support VIP 24/7", "Retrait après 7 jours", "Badge Premium exclusif", "Priorité sur les nouvelles missions"],
  },
};

function InvestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planSlug = searchParams.get("plan") || "bronze";
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const { user } = useAuth();
  const { wallet, isLoading: walletLoading } = useWallet();

  // Fetch real plan from database
  useEffect(() => {
    getPlansFromServer().then((plans) => {
      const foundPlan = plans.find((p: any) => p.slug === planSlug);
      if (foundPlan) setPlanId(foundPlan.id);
    });
  }, [planSlug]);

  const plan = plansData[planSlug] || plansData.bronze;
  const Icon = plan.icon;

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <InvestAuth />;
  }

  // Check if user has enough balance for the plan
  const balance = wallet?.balance || 0;
  const hasEnoughBalance = balance >= plan.price;

  const handleActivate = async () => {
    if (!user) {
      setError("Veuillez vous connecter pour activer un pack.");
      return;
    }
    if (!planId) {
      setError("Impossible de trouver le plan. Réessayez.");
      return;
    }
    if (!hasEnoughBalance) {
      setError(`Solde insuffisant. Ce pack nécessite ${formatCurrency(plan.price)}.`);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const result = await activatePlanAction(planId, plan.price);
      if (result?.success) {
        setShowSuccess(true);
        setTimeout(() => { router.push("/dashboard"); }, 1500);
      } else {
        setError(result?.error || "Erreur lors de l'activation du pack.");
      }
    } catch (e) {
      console.error("Failed to persist plan activation to Supabase:", e);
      setError("Erreur lors de l'activation du pack.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Aperçu du pack</h1>
          <p className="text-[#8A8A8A] text-sm">Activez un pack pour commencer à gagner</p>
        </div>
      </div>

      {showSuccess ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Pack activé !</h2>
          <p className="text-[#8A8A8A] text-sm mb-2">Votre pack {plan.name} est maintenant actif.</p>
        </motion.div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden">
              <div className={`h-3 bg-gradient-to-r ${plan.color}`} />
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-purple-600" />
                </div>
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <div className="mt-2"><span className="text-4xl font-bold">{formatCurrency(plan.price)}</span></div>
                <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${plan.badgeColor}`}>{plan.badge}</span>
                {!error && (
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 text-xs font-medium">
                    <Wallet className="w-3 h-3" /> Débité de votre wallet
                  </div>
                )}
                {error && (
                  <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 text-xs font-medium">
                    <AlertCircle className="w-3 h-3" /> {error}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold">Détails du pack</h3>
                <div className="space-y-3">
                  {[
                    { icon: Clock, label: "Tâches", value: plan.dailyTasks === -1 ? "Illimitées" : `${plan.dailyTasks}/jour`, color: "" },
                    { icon: TrendingUp, label: "Rentabilité", value: `${plan.minProfit}% - ${plan.maxProfit}%`, color: "text-green-500" },
                    { icon: Shield, label: "Durée", value: "7 jours", color: "" },
                    { icon: Wallet, label: "Prix", value: formatCurrency(plan.price), color: "text-purple-500" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                      <div className="flex items-center gap-2"><item.icon className="w-4 h-4 text-[#8A8A8A]" /><span className="text-sm text-[#8A8A8A]">{item.label}</span></div>
                      <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                    </div>
                  ))}

                  {/* Wallet balance display */}
                  <div className={`flex items-center justify-between p-3 rounded-xl ${
                    hasEnoughBalance
                      ? "bg-green-50 dark:bg-green-500/10"
                      : "bg-red-50 dark:bg-red-500/10"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Wallet className={`w-4 h-4 ${hasEnoughBalance ? "text-green-500" : "text-red-500"}`} />
                      <span className={`text-sm ${hasEnoughBalance ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                        Solde disponible
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${hasEnoughBalance ? "text-green-500" : "text-red-500"}`}>
                      {walletLoading ? "..." : formatCurrency(balance)}
                    </span>
                  </div>

                  {!hasEnoughBalance && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => router.push("/deposit")}
                    >
                      Déposer de l'argent
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-3">Ce qui est inclus</h3>
                <div className="space-y-2">
                  {plan.features.map((feature: string, i: number) => (
                    <div key={i} className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /><span className="text-sm text-[#8A8A8A]">{feature}</span></div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              variant="purple"
              onClick={handleActivate}
              disabled={submitting || !hasEnoughBalance || !user || walletLoading}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {submitting ? "Activation en cours..." : `Activer (${formatCurrency(plan.price)})`}
            </Button>
            <Button className="w-full" size="sm" variant="ghost" onClick={() => router.push("/dashboard")}>Retour à l'accueil</Button>
          </motion.div>
        </>
      )}
    </div>
  );
}

export default function InvestPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 pt-6"><div className="animate-pulse h-96 bg-gray-200 dark:bg-gray-700 rounded-2xl" /></div>}>
      <InvestContent />
    </Suspense>
  );
}