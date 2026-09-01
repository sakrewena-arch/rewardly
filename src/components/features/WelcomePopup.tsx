"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Megaphone, Coins, CheckCircle, FileText, X, Loader2, Smartphone, Monitor, Apple } from "lucide-react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "rewardly_welcome_accepted";

// ============================================================
// DÉTECTION DE PLATEFORME + TÉLÉCHARGEMENT DIRECT
// ============================================================
type Platform = "android" | "ios" | "windows" | "linux" | "macos" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const platform = (navigator as any).platform || "";

  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows|win32|win64/i.test(ua) || /win/i.test(platform)) return "windows";
  if (/mac os x|macintosh|macppc/i.test(ua) || /mac/i.test(platform)) return "macos";
  if (/linux/i.test(ua) || /linux/i.test(platform)) return "linux";

  return "other";
}

interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

interface ReleasesData {
  android: ReleaseAsset[];
  windows: ReleaseAsset[];
  linux: ReleaseAsset[];
  macos: ReleaseAsset[];
  error?: string;
}
export default function WelcomePopup() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<"accept" | "options">("accept");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const acceptedDone = localStorage.getItem(STORAGE_KEY);
    if (!acceptedDone) {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  const handleAccept = () => {
    setStep("options");
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
  };

  const handleClose = () => {
    setShow(false);
  };

  // ============================================================
  // TÉLÉCHARGEMENT DIRECT SELON LA PLATEFORME
  // ============================================================
  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const platform = detectPlatform();

      const res = await fetch("/api/releases");
      const data: ReleasesData = await res.json();

      let asset: ReleaseAsset | undefined;
      if (platform === "android") {
        asset = data.android?.[0];
      } else if (platform === "windows") {
        asset = data.windows?.[0];
      } else if (platform === "linux") {
        asset = data.linux?.[0];
      } else if (platform === "macos") {
        asset = data.macos?.[0];
      }

      if (asset?.downloadUrl) {
        const a = document.createElement("a");
        a.href = asset.downloadUrl;
        a.download = asset.name;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setDownloading(false);
        return;
      }

      // Pas d'asset pour cette plateforme → fallback vers la page /download
      if (platform === "ios" || platform === "other") {
        router.push("/download");
      } else {
        setDownloadError("Aucun installateur disponible pour votre plateforme pour le moment.");
      }
      setDownloading(false);
    } catch (e) {
      console.error("Download error:", e);
      setDownloadError("Impossible de récupérer les installateurs. Réessayez plus tard.");
      setDownloading(false);
    }
  };

  const platform = detectPlatform();
  const platformLabel =
    platform === "android" ? "Android" :
    platform === "ios" ? "iOS" :
    platform === "windows" ? "Windows" :
    platform === "linux" ? "Linux" :
    platform === "macos" ? "macOS" : "votre appareil";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            className="w-full max-w-md bg-white dark:bg-[#161616] rounded-3xl overflow-hidden shadow-2xl my-auto"
          >
            {/* Logo + Header */}
            <div className="card-gradient p-6 text-center relative">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src="/images/logo.png"
                alt="Rewardly Logo"
                className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur object-contain mx-auto mb-3"
              />
              <h1 className="text-2xl font-bold text-white">Bienvenue sur Rewardly</h1>
              <p className="text-white/70 text-sm mt-1">La plateforme de micro-tâches rémunérées</p>
            </div>

            {step === "accept" ? (
              /* ======= ÉTAPE 1 : Conditions d'utilisation ======= */
              <div className="p-6 space-y-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-500" /> Conditions d'utilisation
                </h2>

                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 max-h-56 overflow-y-auto text-sm space-y-3">
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">1. Comment Rewardly fonctionne</strong><br />
                    Rewardly est une plateforme de micro-tâches rémunérées. Des <strong>entreprises</strong> publient des missions (visites de sites, partages, questionnaires...), et vous êtes <strong>récompensé</strong> pour chaque tâche accomplie.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">2. Vos gains</strong><br />
                    Chaque tâche validée crédite votre <strong>solde Rewardly</strong>. Vous pouvez ensuite <strong>retirer vos gains</strong> via Mobile Money (Orange, MTN, Wave...) selon les conditions en vigueur.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">3. Utilisation responsable</strong><br />
                    Une seule tâche par compte. Toute tentative de fraude (multi-comptes, bots, fausses preuves) entraîne la <strong>suspension définitive</strong> du compte et la perte des gains.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">4. Retraits</strong><br />
                    Les retraits sont traités sous <strong>24-48h</strong> après validation. Un montant minimum peut s'appliquer.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">5. Données personnelles</strong><br />
                    Vos données sont utilisées uniquement pour le fonctionnement de la plateforme. Elles ne sont <strong>jamais vendues</strong> à des tiers.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm text-[#8A8A8A]">
                    J'accepte les <strong>conditions d'utilisation</strong> et la <strong>politique de confidentialité</strong>
                  </span>
                </label>

                <button
                  onClick={handleAccept}
                  disabled={!accepted}
                  className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <CheckCircle className="w-5 h-5" />
                  J'accepte et je continue
                </button>
              </div>
            ) : (
              /* ======= ÉTAPE 2 : 3 options ======= */
              <div className="p-6 space-y-3">
                <h2 className="font-semibold text-center mb-2">Que voulez-vous faire ?</h2>

                {/* Bouton 1 - Télécharger l'app (détection plateforme + téléchargement direct) */}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 hover:border-purple-500 transition-all text-left active:scale-[0.98] disabled:opacity-60"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    {downloading ? (
                      <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
                    ) : platform === "android" ? (
                      <Smartphone className="w-5 h-5 text-purple-600" />
                    ) : platform === "ios" ? (
                      <Apple className="w-5 h-5 text-purple-600" />
                    ) : (
                      <Monitor className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {downloading ? "Préparation du téléchargement..." : "Télécharger l'application native"}
                    </p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5 break-words">
                      {downloading ? "Patientez un instant..." : `Détecté : ${platformLabel} • Téléchargement direct`}
                    </p>
                  </div>
                  {!downloading && <Download className="w-5 h-5 text-purple-600 flex-shrink-0" />}
                </button>

                {downloadError && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 p-2 rounded-lg break-words">
                    {downloadError}
                  </p>
                )}

                {/* Bouton 2 - Nous contacter pour publicités */}
                <button
                  onClick={() => router.push("/services")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 hover:border-rose-500 transition-all text-left active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-rose-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Nous contacter pour vos publicités</p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5 break-words">Promouvez votre entreprise, site web, application</p>
                  </div>
                </button>

                {/* Bouton 3 - Commencer à gagner */}
                <button
                  onClick={handleClose}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 hover:border-green-500 transition-all text-left active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Commencer à gagner de l'argent</p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5 break-words">Accéder aux tâches rémunérées</p>
                  </div>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
