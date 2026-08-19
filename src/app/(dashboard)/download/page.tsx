"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Download, Check, Share2, Smartphone, Monitor, Apple, Loader2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
}

interface ReleasesData {
  tag?: string;
  name?: string | null;
  publishedAt?: string | null;
  android: ReleaseAsset[];
  windows: ReleaseAsset[];
  linux: ReleaseAsset[];
  macos: ReleaseAsset[];
  error?: string;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb > 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb.toFixed(0)} Mo`;
}

export default function DownloadPage() {
  const router = useRouter();
  const { install, isInstalled } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleasesData | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger la dernière release native (APK / EXE / AppImage…)
  useEffect(() => {
    fetch("/api/releases")
      .then((res) => res.json())
      .then((data) => setReleases(data))
      .catch(() => setReleases({ android: [], windows: [], linux: [], macos: [], error: "Impossible de charger les installateurs" }))
      .finally(() => setLoading(false));
  }, []);

  const handleInstallPWA = async () => {
    if (isInstalled) {
      setInstallMsg("L'application est déjà installée sur votre appareil ! ✅");
      return;
    }
    const result = await install();
    if (result.installed) {
      setInstallMsg("Application installée avec succès ! 🎉");
    } else if (result.needsIOSInstructions) {
      setInstallMsg("Sur iPhone/iPad : appuyez sur Partager → 'Sur l'écran d'accueil'");
    } else {
      setInstallMsg("Cliquez sur l'icône d'installation dans la barre d'adresse de votre navigateur.");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 overflow-guard">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Télécharger l'application</h1>
          <p className="text-[#8A8A8A] text-sm">Installez Rewardly sur votre appareil</p>
        </div>
      </div>

      {/* Bannière PWA */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-gradient rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <img src="/images/logo.png" alt="Rewardly" className="w-12 h-12 rounded-xl bg-white/20 object-contain" />
            <div>
              <h2 className="font-bold">Rewardly</h2>
              <p className="text-white/70 text-xs">Application installable</p>
            </div>
          </div>
          <p className="text-white/80 text-sm mb-4">
            Rewardly est une application web progressive (PWA). Elle s'installe comme une application native sur votre appareil.
          </p>
          <Button className="w-full bg-white text-purple-700 hover:bg-white/90" onClick={handleInstallPWA}>
            <Download className="w-4 h-4 mr-2" />
            {isInstalled ? "Déjà installée" : "Installer maintenant"}
          </Button>
          {installMsg && (
            <p className="text-white/90 text-xs bg-white/10 p-2 rounded-lg text-center mt-2">
              {installMsg}
            </p>
          )}
        </div>
      </motion.div>

      {/* ============ APPLICATIONS NATIVES (téléchargement direct) ============ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-purple-500" /> Applications natives</h2>
              <p className="text-xs text-[#8A8A8A] mt-1">
                Téléchargez l'application directement depuis ce site, sans boutique.
                {releases?.tag ? ` Version : ${releases.tag}` : ""}
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-[#8A8A8A]">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des installateurs…
              </div>
            )}

            {!loading && releases?.error && (
              <p className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" /> {releases.error} — créez un tag Git (ex. v0.1.0) pour générer les installateurs.
              </p>
            )}

            {!loading && releases && !releases.error && (
              <DownloadGrid releases={releases} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Instructions par plateforme */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold">Instructions d'installation</h2>

            {/* Android */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="/images/android.jfif" alt="Android" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="font-medium text-sm">Android (Chrome)</p>
                <p className="text-xs text-[#8A8A8A] mt-1">
                  1. Ouvrez le site dans Chrome<br />
                  2. Cliquez sur le menu ⋮ (3 points)<br />
                  3. Sélectionnez "Ajouter à l'écran d'accueil"<br />
                  4. Confirmez → l'icône Rewardly apparaît
                </p>
              </div>
            </div>

            {/* iOS */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="/images/ios.jfif" alt="iOS" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="font-medium text-sm">iOS (Safari)</p>
                <p className="text-xs text-[#8A8A8A] mt-1">
                  1. Ouvrez le site dans Safari<br />
                  2. Cliquez sur le bouton Partager (carré avec flèche ↑)<br />
                  3. Sélectionnez "Sur l'écran d'accueil"<br />
                  4. Confirmez → l'icône Rewardly apparaît
                </p>
              </div>
            </div>

            {/* Windows */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="/images/windows.jfif" alt="Windows" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="font-medium text-sm">Windows (Edge/Chrome)</p>
                <p className="text-xs text-[#8A8A8A] mt-1">
                  1. Ouvrez le site dans Edge ou Chrome<br />
                  2. Cliquez sur l'icône d'installation dans la barre d'adresse<br />
                  3. Confirmez → Rewardly s'installe comme application
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Lien direct */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Share2 className="w-4 h-4" /> Partager le lien</h2>
            <p className="text-sm text-[#8A8A8A]">Partagez ce lien pour que d'autres installent Rewardly :</p>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-sm truncate">
                {typeof window !== "undefined" ? window.location.origin : "rewardly"}
              </div>
              <Button onClick={handleCopyLink} variant="outline">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : "Copier"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ============================================================
// Grille des téléchargements natifs (Android / Windows / Linux / iOS)
// ============================================================
function DownloadGrid({ releases }: { releases: ReleasesData }) {
  return (
    <>
      {/* Android */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Smartphone className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Android</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            Fichier APK à installer. Autorisez « Sources inconnues » si demandé.
          </p>
          {releases.android.length > 0 ? (
            <a
              href={releases.android[0].downloadUrl}
              download
              className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-600 text-white text-xs font-medium hover:bg-green-700"
            >
              <Download className="w-3.5 h-3.5" /> APK ({formatSize(releases.android[0].size)})
            </a>
          ) : (
            <p className="text-xs text-amber-600 mt-1">Non publié</p>
          )}
        </div>
      </div>

      {/* Windows */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Monitor className="w-5 h-5 text-sky-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Windows</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            Installateur (Setup) ou version portable.
          </p>
          {releases.windows.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {releases.windows.map((a) => (
                <a
                  key={a.name}
                  href={a.downloadUrl}
                  download
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-medium hover:bg-sky-700"
                >
                  <Download className="w-3.5 h-3.5" /> {a.name.toLowerCase().includes("setup") ? "Installateur" : "Portable"} ({formatSize(a.size)})
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600 mt-1">Non publié</p>
          )}
        </div>
      </div>

      {/* Linux */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Monitor className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Linux</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            AppImage (universel) ou .deb (Debian/Ubuntu).
          </p>
          {releases.linux.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {releases.linux.map((a) => (
                <a
                  key={a.name}
                  href={a.downloadUrl}
                  download
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-medium hover:bg-orange-700"
                >
                  <Download className="w-3.5 h-3.5" /> {a.name.toLowerCase().includes("appimage") ? "AppImage" : "deb"} ({formatSize(a.size)})
                </a>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-600 mt-1">Non publié</p>
          )}
        </div>
      </div>

      {/* iOS */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white/10 border border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          <Apple className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">iPhone / iPad</p>
          <p className="text-xs text-[#8A8A8A] mt-0.5">
            Apple n'autorise pas l'installation d'IPA hors App Store pour le grand public. Sur iOS, utilisez le bouton PWA « Ajouter à l'écran d'accueil » ci-dessus, ou installez via l'App Store / TestFlight.
          </p>
        </div>
      </div>
    </>
  );
}