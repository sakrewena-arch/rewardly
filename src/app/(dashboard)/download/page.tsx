"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Download, Check, Share2, Smartphone, Monitor, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function DownloadPage() {
  const router = useRouter();
  const { install, isInstalled } = usePWAInstall();
  const [copied, setCopied] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);

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
          <h1 className="text-xl font-bold">Télécharger l&apos;application</h1>
          <p className="text-[#8A8A8A] text-sm">Utilisez Rewardly sur tous vos appareils</p>
        </div>
      </div>

      {/* Bannière Web */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-gradient rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <img src="/images/logo.png" alt="Rewardly" className="w-12 h-12 rounded-xl bg-white/20 object-contain" />
            <div>
              <h2 className="font-bold">Rewardly</h2>
              <p className="text-white/70 text-xs">Plateforme sécurisée</p>
            </div>
          </div>
          <p className="text-white/80 text-sm mb-4">
            Rewardly fonctionne sur Android, iOS, Windows et macOS directement dans votre navigateur (WebView), sans installation lourde.
          </p>
          <Button className="w-full bg-white text-purple-700 hover:bg-white/90" onClick={handleInstallPWA}>
            <Download className="w-4 h-4 mr-2" />
            {isInstalled ? "Déjà installée" : "Installer sur l'accueil"}
          </Button>
          {installMsg && (
            <p className="text-white/90 text-xs bg-white/10 p-2 rounded-lg text-center mt-2">
              {installMsg}
            </p>
          )}
        </div>
      </motion.div>
{/* Compatibilité WebView */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-purple-500" /> Fonctionne partout, sans téléchargement
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <Smartphone className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="font-medium text-xs">Android / iOS</p>
              <p className="text-[10px] text-[#8A8A8A] mt-0.5">via navigateur</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <Monitor className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="font-medium text-xs">Windows / macOS</p>
              <p className="text-[10px] text-[#8A8A8A] mt-0.5">via navigateur</p>
            </div>
            <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
              <Download className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="font-medium text-xs">Installation PWA</p>
              <p className="text-[10px] text-[#8A8A8A] mt-0.5">sur l'accueil</p>
            </div>
          </div>
          <Button variant="outline" className="w-full mt-3" onClick={handleCopyLink}>
            <Share2 className="w-4 h-4 mr-2" />
            {copied ? <Check className="w-4 h-4 text-green-500" /> : null}
            {copied ? " Lien copié !" : " Copier le lien du site"}
          </Button>
        </div>
      </motion.div>

      {/* Instructions rapides */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
          <h2 className="font-semibold">Comment installer</h2>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">1</div>
            <div>
              <p className="font-medium text-sm">Android (Chrome)</p>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Menu ⋮ → « Ajouter à l'écran d'accueil »</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">2</div>
            <div>
              <p className="font-medium text-sm">iPhone / iPad (Safari)</p>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Partager (↑) → « Sur l'écran d'accueil »</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">3</div>
            <div>
              <p className="font-medium text-sm">Windows / macOS</p>
              <p className="text-xs text-[#8A8A8A] mt-0.5">Chrome / Edge : icône d'installation dans la barre d'adresse</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}