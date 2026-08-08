"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Edit, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getPlans, createPlanAction, updatePlanAction, togglePlanStatusAction } from "@/actions/admin-actions";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  daily_tasks: number;
  min_profitability: number;
  max_profitability: number;
  badge: string;
  is_active: boolean;
}

export default function AdminPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", slug: "", price: "", daily_tasks: "", min_profitability: "", max_profitability: "", badge: "",
  });

  const loadPlans = async () => {
    try {
      const data = await getPlans(true);
      setPlans(data || []);
    } catch (e) {
      console.error("Failed to load plans", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleSave = async () => {
    if (editing) {
      await updatePlanAction({
        planId: editing.id,
        name: form.name || undefined,
        price: form.price ? Number(form.price) : undefined,
        daily_tasks: form.daily_tasks ? Number(form.daily_tasks) : undefined,
        min_profitability: form.min_profitability ? Number(form.min_profitability) : undefined,
        max_profitability: form.max_profitability ? Number(form.max_profitability) : undefined,
        badge: form.badge || undefined,
      });
    } else {
      await createPlanAction({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s+/g, "-"),
        price: Number(form.price),
        daily_tasks: Number(form.daily_tasks),
        min_profitability: Number(form.min_profitability),
        max_profitability: Number(form.max_profitability),
        badge: form.badge || "Standard",
      });
    }
    setShowForm(false);
    setEditing(null);
    setForm({ name: "", slug: "", price: "", daily_tasks: "", min_profitability: "", max_profitability: "", badge: "" });
    loadPlans();
  };

  const toggleStatus = async (id: string, currentActive: boolean) => {
    await togglePlanStatusAction(id, !currentActive);
    loadPlans();
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/admin")} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Gestion des packs</h1>
              <p className="text-[#8A8A8A] text-sm">{plans.length} packs</p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ name: "", slug: "", price: "", daily_tasks: "", min_profitability: "", max_profitability: "", badge: "" }); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau pack
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold">{editing ? "Modifier" : "Créer"} un pack</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bronze" />
                </div>
                {!editing && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug</label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="bronze" />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prix (FCFA)</label>
                  <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="5000" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tâches/jour (-1 = illimité)</label>
                  <Input type="number" value={form.daily_tasks} onChange={(e) => setForm({ ...form, daily_tasks: e.target.value })} placeholder="1" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rentabilité min %</label>
                  <Input type="number" value={form.min_profitability} onChange={(e) => setForm({ ...form, min_profitability: e.target.value })} placeholder="10" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rentabilité max %</label>
                  <Input type="number" value={form.max_profitability} onChange={(e) => setForm({ ...form, max_profitability: e.target.value })} placeholder="20" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Badge</label>
                  <Input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Bronze" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Annuler</Button>
                <Button onClick={handleSave} disabled={!form.name || !form.price}>
                  {editing ? "Modifier" : "Créer"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <div className={`h-2 ${plan.is_active ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-700"}`} />
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${plan.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {plan.is_active ? "Actif" : "Inactif"}
                    </span>
                  </div>
                  <p className="text-2xl font-bold mb-4">{formatCurrency(plan.price)}</p>
                  <div className="space-y-1 text-sm mb-4">
                    <p className="text-[#8A8A8A]">
                      Tâches: <span className="font-medium">{plan.daily_tasks === -1 ? "Illimité" : `${plan.daily_tasks}/jour`}</span>
                    </p>
                    <p className="text-[#8A8A8A]">
                      Rentabilité: <span className="font-medium text-green-500">{plan.min_profitability}% - {plan.max_profitability}%</span>
                    </p>
                    <p className="text-[#8A8A8A]">
                      Badge: <span className="font-medium">{plan.badge}</span>
                    </p>
                    <p className="text-[#8A8A8A]">
                      Prix: <span className="font-medium">{formatCurrency(plan.price)}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditing(plan);
                        setForm({
                          name: plan.name, slug: plan.slug, price: String(plan.price),
                          daily_tasks: String(plan.daily_tasks), min_profitability: String(plan.min_profitability),
                          max_profitability: String(plan.max_profitability), badge: plan.badge,
                        });
                        setShowForm(true);
                      }}
                    >
                      <Edit className="w-3 h-3 mr-1" /> Modifier
                    </Button>
                    <Button
                      variant={plan.is_active ? "destructive" : "secondary"}
                      size="sm"
                      onClick={() => toggleStatus(plan.id, plan.is_active)}
                    >
                      {plan.is_active ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}