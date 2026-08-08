"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Bell, Globe, Shield, Smartphone, Save, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { SettingsAuth } from "@/components/features/AuthRequiredPages";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    pushNotifications: false,
    language: "fr",
    currency: "XOF",
  });

  // Charger les préférences depuis la base de données
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("language, currency, push_notifications, email_notifications")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setSettings({
          notifications: data.email_notifications,
          emailNotifications: data.email_notifications,
          pushNotifications: data.push_notifications,
          language: data.language || "fr",
          currency: data.currency || "XOF",
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <SettingsAuth />;
  }

  const handleSave = async () => {
    // Persister les préférences dans la base de données (RPC upsert)
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.rpc("upsert_user_preferences", {
      p_language: settings.language,
      p_currency: settings.currency,
      p_push_notifications: settings.pushNotifications,
      p_email_notifications: settings.emailNotifications,
    });
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Paramètres</h1>
          <p className="text-[#8A8A8A] text-sm">Préférences de votre compte</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifications push</p>
                  <p className="text-xs text-[#8A8A8A]">Recevoir des alertes en temps réel</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, pushNotifications: !settings.pushNotifications })}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors ${settings.pushNotifications ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.pushNotifications ? "translate-x-6" : ""}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Notifications email</p>
                  <p className="text-xs text-[#8A8A8A]">Recevoir des emails importants</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, emailNotifications: !settings.emailNotifications })}
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors ${settings.emailNotifications ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.emailNotifications ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Globe className="w-4 h-4" /> Préférences</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-[#8A8A8A]">Langue</label>
                <select
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
                  value={settings.language}
                  onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#8A8A8A]">Devise</label>
                <select
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
                  value={settings.currency}
                  onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                >
                  <option value="XOF">FCFA (XOF)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="USD">Dollar (USD)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4" /> Sécurité</h2>
            <button
              onClick={() => router.push("/security")}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#8A8A8A]" />
                <span className="text-sm">Gérer la sécurité du compte</span>
              </div>
              <ArrowLeft className="w-4 h-4 rotate-180 text-[#8A8A8A]" />
            </button>
          </CardContent>
        </Card>
      </motion.div>

      <Button className="w-full" size="lg" onClick={handleSave}>
        {saved ? <><Check className="w-4 h-4 mr-2" /> Enregistré</> : <><Save className="w-4 h-4 mr-2" /> Enregistrer</>}
      </Button>
    </div>
  );
}