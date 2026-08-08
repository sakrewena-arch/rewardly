"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search, Check, X, DollarSign, ChevronDown, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getWithdrawals, validateWithdrawalAction } from "@/actions/admin-actions";

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  account_info: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string | null; username: string | null } | null;
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<"all" | "today" | "week" | "month" | "year">("all");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "paid" | "rejected" } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadWithdrawals = async () => {
    try {
      const data = await getWithdrawals();
      setWithdrawals(data || []);
    } catch (e) {
      console.error("Failed to load withdrawals", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const handleValidate = async (id: string, status: string) => {
    setProcessing(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await validateWithdrawalAction(id, status);
      if (result?.success === false) {
        setActionError(result.error || "Erreur lors de la validation");
      } else {
        setActionSuccess(status === "paid" ? "Paiement envoyé avec succès !" : "Retrait rejeté, le montant a été remboursé.");
      }
      loadWithdrawals();
    } catch (e: any) {
      setActionError(e.message || "Erreur lors de la validation");
    } finally {
      setProcessing(null);
      setConfirmAction(null);
    }
  };

  const filtered = withdrawals.filter((w) => {
    // Filtre par période
    const date = new Date(w.created_at);
    const now = new Date();
    if (filterPeriod === "today" && date.toDateString() !== now.toDateString()) return false;
    if (filterPeriod === "week" && date < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false;
    if (filterPeriod === "month" && date < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)) return false;
    if (filterPeriod === "year" && date.getFullYear() !== now.getFullYear()) return false;

    // Recherche
    return (w.profiles?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (w.account_info || "").includes(search);
  });

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Gestion des retraits</h1>
            <p className="text-[#8A8A8A] text-sm">
              {withdrawals.filter((w) => w.status === "pending").length} en attente
            </p>
          </div>
        </div>

        {actionError && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="flex items-center gap-2 text-green-500 text-sm bg-green-50 dark:bg-green-500/10 p-3 rounded-xl">
            <Check className="w-4 h-4 flex-shrink-0" />
            {actionSuccess}
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
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
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8A8A8A]">Aucun retrait trouvé</p>
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
                  Liste des retraits
                </span>
                <span className="text-xs text-[#8A8A8A] font-normal">{filtered.length} retrait{filtered.length > 1 ? "s" : ""}</span>
              </button>

              {expanded && (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr className="text-left text-[#8A8A8A]">
                    <th className="p-4 font-medium">Utilisateur</th>
                    <th className="p-4 font-medium">Montant</th>
                    <th className="p-4 font-medium">Méthode</th>
                    <th className="p-4 font-medium">Compte</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium">Statut</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, showAll ? filtered.length : 10).map((w) => (
                    <tr key={w.id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="p-4 font-medium">
                        {w.profiles?.full_name || w.profiles?.username || "Utilisateur"}
                      </td>
                      <td className="p-4 font-medium">{formatCurrency(w.amount)}</td>
                      <td className="p-4 text-[#8A8A8A]">{w.method}</td>
                      <td className="p-4 text-[#8A8A8A] text-xs">{w.account_info || "—"}</td>
                      <td className="p-4 text-[#8A8A8A]">{formatDate(w.created_at)}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          w.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : w.status === "paid"
                            ? "bg-green-100 text-green-700"
                            : w.status === "approved"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {w.status === "pending" ? "En attente" : w.status === "paid" ? "Payé" : w.status === "approved" ? "Approuvé" : "Rejeté"}
                        </span>
                      </td>
                      <td className="p-4">
                        {w.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmAction({ id: w.id, action: "paid" })}
                              disabled={processing === w.id}
                              className="px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-medium flex items-center gap-1"
                            >
                              <DollarSign className="w-3 h-3" />
                              Payer
                            </button>
                            <button
                              onClick={() => setConfirmAction({ id: w.id, action: "rejected" })}
                              disabled={processing === w.id}
                              className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium flex items-center gap-1"
                            >
                              <X className="w-3 h-3" />
                              Rejeter
                            </button>
                          </div>
                        )}
                        {/* Si le paiement a échoué (approved) → bouton Réessayer */}
                        {w.status === "approved" && (
                          <button
                            onClick={() => setConfirmAction({ id: w.id, action: "paid" })}
                            disabled={processing === w.id}
                            className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium flex items-center gap-1"
                          >
                            <DollarSign className="w-3 h-3" />
                            Réessayer
                          </button>
                        )}
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

        {/* Popup de confirmation */}
        {confirmAction && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-[#161616] rounded-2xl p-6 shadow-2xl">
              <div className="text-center mb-4">
                <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${
                  confirmAction.action === "paid" ? "bg-green-100 dark:bg-green-500/20" : "bg-red-100 dark:bg-red-500/20"
                }`}>
                  {confirmAction.action === "paid" ? (
                    <DollarSign className="w-8 h-8 text-green-500" />
                  ) : (
                    <X className="w-8 h-8 text-red-500" />
                  )}
                </div>
                <h2 className="text-lg font-bold">
                  {confirmAction.action === "paid" ? "Confirmer le paiement" : "Confirmer le rejet"}
                </h2>
                <p className="text-sm text-[#8A8A8A] mt-1">
                  {confirmAction.action === "paid"
                    ? "Le montant sera envoyé à l'utilisateur via son opérateur téléphonique."
                    : "Le montant sera remboursé sur le wallet de l'utilisateur."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setConfirmAction(null)}
                  disabled={processing === confirmAction.id}
                >
                  Annuler
                </Button>
                <Button
                  className={`flex-1 ${confirmAction.action === "paid" ? "bg-green-500 hover:bg-green-600" : "bg-red-500 hover:bg-red-600"}`}
                  onClick={() => handleValidate(confirmAction.id, confirmAction.action)}
                  disabled={processing === confirmAction.id}
                >
                  {processing === confirmAction.id ? "Traitement..." : confirmAction.action === "paid" ? "Payer" : "Rejeter"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}