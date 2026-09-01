"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Page HORS LIGNE /offline
 * Affichée automatiquement par le Service Worker quand la navigation échoue
 * (pas de connexion), ou par OfflineDetector quand navigator.onLine est false.
 */
export default function OfflinePage() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const online = () => {
      setIsOnline(true);
      // Reconnecté → retour à l'accueil
      router.replace("/dashboard");
    };
    const offline = () => setIsOnline(false);

    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [router]);

  const retry = () => {
    if (navigator.onLine) {
      router.replace("/dashboard");
    } else {
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] flex items-center justify-center p-6">
      <div className="text-center max-w-sm w-full">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/30">
          <WifiOff className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Vous êtes hors ligne</h1>
        <p className="text-[#8A8A8A] text-sm leading-relaxed mb-8">
          {isOnline
            ? "Connexion rétablie ! Vous pouvez continuer."
            : "Vérifiez votre connexion Internet et réessayez."}
        </p>

        <button
          onClick={retry}
          className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors mb-3"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </button>

        <button
          onClick={() => router.push("/")}
          className="w-full h-12 rounded-xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-700 text-sm font-medium flex items-center justify-center gap-2 hover:border-purple-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l&apos;accueil
        </button>

        <p className="text-xs text-[#8A8A8A] mt-6">
          Rewardly nécessite une connexion Internet pour charger vos tâches et votre solde.
        </p>
      </div>
    </div>
  );
}