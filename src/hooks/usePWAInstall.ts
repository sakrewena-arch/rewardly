"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook pour gérer l'installation PWA directement
 * - Capture l'événement beforeinstallprompt (Android/Windows/Chrome)
 * - Fournit une fonction install() pour déclencher l'installation
 * - Détecte si l'app est déjà installée
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Vérifier si déjà installé
    const checkInstalled = () => {
      const nav: any = navigator;
      if (nav?.standalone) {
        setIsInstalled(true);
        return;
      }
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
        return;
      }
      setIsInstalled(false);
    };
    checkInstalled();

    // Capturer l'événement d'installation PWA
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // Détecter l'installation terminée
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * Déclenche l'installation PWA
   * - Si beforeinstallprompt est disponible (Android/Windows/Chrome) → install() directe
   * - Sinon (iOS Safari) → affiche les instructions
   */
  const install = useCallback(async (): Promise<{ installed: boolean; needsIOSInstructions: boolean }> => {
    // iPhone/iPad avec Safari → instructions manuelles
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      return { installed: false, needsIOSInstructions: true };
    }

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
          setCanInstall(false);
          setIsInstalled(true);
          return { installed: true, needsIOSInstructions: false };
        }
      } catch (e) {
        console.error("Installation error:", e);
      }
      return { installed: false, needsIOSInstructions: false };
    }

    // Pas de beforeinstallprompt → déjà installé ou non disponible
    return { installed: isInstalled, needsIOSInstructions: false };
  }, [deferredPrompt, isInstalled]);

  return { install, canInstall, isInstalled, deferredPrompt };
}