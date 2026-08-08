"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Wrench, Clock } from "lucide-react";

export default function MaintenancePage() {
  const [checking, setChecking] = useState(true);
  const [maintenance, setMaintenance] = useState(true);

  // Vérifier si le mode maintenance est encore actif
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setChecking(false);
      return;
    }
    const check = async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .single();
      const isOn = data?.value === true || data?.value === "true";
      setMaintenance(isOn);
      setChecking(false);
    };
    check();

    // Re-vérifier toutes les 30 secondes au cas où l'admin désactive
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-recharger si la maintenance est désactivée
  useEffect(() => {
    if (!checking && !maintenance) {
      window.location.href = "/dashboard";
    }
  }, [checking, maintenance]);

  if (checking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto animate-pulse rounded-2xl bg-gray-200" />
          <p className="text-gray-500 mt-4">Vérification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      {/* ============================================================
          ANIMATION LOTTIE EN BACKGROUND (visible, sans voile)
          ============================================================ */}
      <div className="absolute inset-0">
        <iframe
          src="https://lottie.host/embed/3c027fe0-63ec-4fd7-bb64-4e4ee782cc5a/oMtJyY2BvE.lottie"
          className="w-full h-full"
          title="Animation maintenance"
          allowFullScreen
          style={{ border: "none", pointerEvents: "none" }}
        />
      </div>

      {/* ============================================================
          CARTE PLACÉE À CÔTÉ DE L'ANIMATION (ne la masque pas)
          ============================================================ */}
      <div className="relative min-h-screen flex items-center justify-end p-4 md:p-8">
        <div className="w-full max-w-sm bg-white/90 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-xl p-8 text-center">
          {/* Icône */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
            <Wrench className="w-10 h-10 text-white" />
          </div>

          {/* Titre */}
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Maintenance</h1>

          {/* Message */}
          <p className="text-gray-600 text-base leading-relaxed">
            L'application est en <span className="font-semibold text-purple-600">maintenance</span>.
            <br />
            Elle sera de nouveau fonctionnelle dans quelques instants.
          </p>

          {/* Excuses */}
          <p className="text-gray-400 mt-4 text-sm">
            Veuillez nous excuser pour la gêne occasionnée. 🙏
          </p>

          {/* Indicateur de temps */}
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-sm">
            <Clock className="w-4 h-4" />
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Équipe technique en cours d'intervention...
          </div>
        </div>
      </div>
    </div>
  );
}