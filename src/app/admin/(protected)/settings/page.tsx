"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save, DollarSign, Users, Shield, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { getSystemSettingsFromDB, saveSystemSettingsAction } from "@/actions/settings-actions";

export default function AdminSettingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    platform_name: "Rewardly",
    min_withdrawal: "5000",
    withdrawal_day: "5",
    investment_duration_days: "7",
    referral_commission_fixed: "500",
    referral_commission_percent: "5",
    max_referrals: "50",
    maintenance_mode: "false",
  });

  useEffect(() => {
    getSystemSettingsFromDB().then((data) => {
      if (data) {
        setSettings({
          platform_name: String(data.platform_name || "Rewardly").replace(/"/g, ""),
          min_withdrawal: String(data.min_withdrawal || "5000").replace(/"/g, ""),
          withdrawal_day: String(data.withdrawal_day || "5").replace(/"/g, ""),
          investment_duration_days: String(data.investment_duration_days || "7").replace(/"/g, ""),
          referral_commission_fixed: String(data.referral_commission_fixed || "500").replace(/"/g, ""),
          referral_commission_percent: String(data.referral_commission_percent || "5").replace(/"/g, ""),
          max_referrals: String(data.max_referrals || "50").replace(/"/g, ""),
          maintenance_mode: String(data.maintenance_mode || "false").replace(/"/g, ""),
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setError(null);
    const result = await saveSystemSettingsAction({
      platform_name: JSON.stringify(settings.platform_name),
      min_withdrawal: settings.min_withdrawal,
      withdrawal_day: settings.withdrawal_day,
      investment_duration_days: settings.investment_duration_days,
      referral_commission_fixed: settings.referral_commission_fixed,
      referral_commission_percent: settings.referral_commission_percent,
      max_referrals: settings.max_referrals,
      maintenance_mode: settings.maintenance_mode,
    });
    if (result?.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result?.error || "Erreur lors de la sauvegarde");
    }
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
              <h1 className="text-xl font-bold">Paramètres</h1>
              <p className="text-[#8A8A8A] text-sm">Configuration de la plateforme</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4 mr-2" /> {saved ? "Enregistré ✓" : "Enregistrer"}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> Finances</h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Retrait minimum (FCFA)</label>
                    <Input value={settings.min_withdrawal} onChange={(e) => setSettings({ ...settings, min_withdrawal: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Jour de retrait (0=Dim, 5=Vendredi)</label>
                    <Input value={settings.withdrawal_day} onChange={(e) => setSettings({ ...settings, withdrawal_day: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Durée d'investissement (jours)</label>
                    <Input value={settings.investment_duration_days} onChange={(e) => setSettings({ ...settings, investment_duration_days: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Parrainage</h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Commission fixe (FCFA)</label>
                    <Input value={settings.referral_commission_fixed} onChange={(e) => setSettings({ ...settings, referral_commission_fixed: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Commission (%)</label>
                    <Input value={settings.referral_commission_percent} onChange={(e) => setSettings({ ...settings, referral_commission_percent: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Maximum de filleuls</label>
                    <Input value={settings.max_referrals} onChange={(e) => setSettings({ ...settings, max_referrals: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Maintenance</h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Nom de la plateforme</label>
                    <Input value={settings.platform_name} onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[#8A8A8A]">Mode maintenance</label>
                    <div className="flex gap-2">
                      <button onClick={() => setSettings({ ...settings, maintenance_mode: "false" })}
                        className={`flex-1 p-2 rounded-xl text-sm border ${settings.maintenance_mode === "false" ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        Désactivé
                      </button>
                      <button onClick={() => setSettings({ ...settings, maintenance_mode: "true" })}
                        className={`flex-1 p-2 rounded-xl text-sm border ${settings.maintenance_mode === "true" ? "border-red-500 bg-red-50 dark:bg-red-500/10" : "border-gray-200 dark:border-gray-700"}`}>
                        Activé
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}