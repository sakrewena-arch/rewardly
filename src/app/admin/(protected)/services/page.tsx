"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Megaphone, Mail, Phone, Check, X, Building2, Clock, Users, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getServiceOrders, updateServiceOrderStatus } from "@/actions/admin-actions";

interface ServiceOrder {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string;
  service_type: string;
  description: string | null;
  pack: string;
  pack_amount: number;
  duration: string;
  target_users: number | null;
  status: string;
  payment_status: string;
  created_at: string;
}

const serviceTypeLabels: Record<string, string> = {
  sondage: "Sondage",
  visite: "Visite de site",
  test_jeu: "Test de jeu",
  test_app: "Test d'application",
  test_site: "Test de site web",
  test_ia: "Test d'IA",
  autre: "Autre",
};

export default function AdminServicesPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadOrders = async () => {
    const data = await getServiceOrders();
    setOrders(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatus = async (id: string, status: string) => {
    await updateServiceOrderStatus(id, status);
    loadOrders();
  };

  const pendingCount = orders.filter((o) => o.status === "pending").length;

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] overflow-guard">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Commandes de services</h1>
            <p className="text-[#8A8A8A] text-sm">{pendingCount} en attente • {orders.length} total</p>
          </div>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#8A8A8A]">Aucune commande reçue</p>
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
                  Liste des commandes
                </span>
                <span className="text-xs text-[#8A8A8A] font-normal">{orders.length} commande{orders.length > 1 ? "s" : ""}</span>
              </button>

              {expanded && (
                <div className="space-y-2 p-4 pt-0">
                  {orders.slice(0, showAll ? orders.length : 10).map((order) => (
                    <div key={order.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{order.company_name}</p>
                          <p className="text-xs text-[#8A8A8A]">{serviceTypeLabels[order.service_type] || order.service_type} • Pack {order.pack}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          order.status === "approved" ? "bg-green-100 text-green-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {order.status === "pending" ? "En attente" : order.status === "approved" ? "Approuvée" : "Refusée"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-[#8A8A8A]">Montant</p>
                          <p className="font-bold text-green-500">{formatCurrency(order.pack_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#8A8A8A]">Durée</p>
                          <p className="font-medium">{order.duration}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#8A8A8A]">Utilisateurs</p>
                          <p className="font-medium">{order.target_users || "Illimité"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#8A8A8A]">Date</p>
                          <p className="font-medium">{formatDate(order.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-col md:flex-row gap-2 text-sm">
                        <a href={`mailto:${order.contact_email}`} className="flex items-center gap-1 text-purple-600 hover:underline">
                          <Mail className="w-3 h-3" /> {order.contact_email}
                        </a>
                        <a href={`tel:${order.contact_phone}`} className="flex items-center gap-1 text-purple-600 hover:underline">
                          <Phone className="w-3 h-3" /> {order.contact_phone}
                        </a>
                      </div>

                      {order.description && (
                        <p className="text-sm text-[#8A8A8A] bg-white dark:bg-[#161616] p-3 rounded-xl">{order.description}</p>
                      )}

                      {order.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => handleStatus(order.id, "approved")}>
                            <Check className="w-3 h-3 mr-1" /> Approuver
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleStatus(order.id, "rejected")}>
                            <X className="w-3 h-3 mr-1" /> Refuser
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {orders.length > 10 && (
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="w-full text-center text-xs text-purple-600 hover:text-purple-700 font-medium py-3"
                    >
                      {showAll ? "Voir moins" : `Voir tout (${orders.length})`}
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