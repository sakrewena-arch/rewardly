"use client";

import { useEffect } from "react";

/**
 * Intégration Capacitor NATIF (Android / iOS).
 * - Enregistre le token de push (FCM / APNs) auprès du serveur via la
 *   Server Action registerPushTokenAction (table public.push_tokens).
 * - Ajuste la status bar pour correspondre au thème de l'app.
 * - Intercepte le bouton retour natif : navigation arrière si possible,
 *   sinon RETOUR À L'ACCUEIL ANDROID (minimizeApp) au lieu de quitter l'app.
 * Ne s'exécute QUE dans une WebView Capacitor ; sur le web classique,
 * ce composant ne fait rien (Capacitor.isNativePlatform() === false).
 */
export function NativeCapacitor() {
  useEffect(() => {
    let disposed = false;
    let backHandler: { remove: () => void } | null = null;

    const init = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform(); // "android" | "ios"

        // ---------- Bouton retour natif (Android) ----------
        // L'app Next.js est une SPA : même quand la WebView n'a qu'UNE page,
        // l'historique interne SPA (window.history.length > 1) doit permettre
        // de revenir aux pages précédentes visitées dans l'app.
        // Sinon → on minimise l'app (retour à l'accueil Android) au lieu de
        // la fermer/la faire sembler "planter".
        try {
          const { App } = await import("@capacitor/app");
          backHandler = await App.addListener("backButton", ({ canGoBack }) => {
            if (disposed) return;
            if (canGoBack || window.history.length > 1) {
              window.history.back();
            } else {
              App.minimizeApp();
            }
          });
        } catch {
          /* @capacitor/app non disponible : comportement par défaut conservé */
        }

        // ---------- Status bar ----------
        try {
          const { StatusBar, Style } = await import("@capacitor/status-bar");
          const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
          await StatusBar.setStyle({ style: prefersDark ? Style.Dark : Style.Light }).catch(() => {});
          await StatusBar.setBackgroundColor({ color: prefersDark ? "#090909" : "#F7F7F8" }).catch(() => {});
        } catch {
          /* status-bar non disponible : on ignore */
        }

        // ---------- Push notifications ----------
        // Protégé au maximum : une erreur ici (FCM non configuré, permission
        // refusée, etc.) ne doit JAMAIS faire crasher l'app native.
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");

          // Vérifier la permission sans lancer de dialogue natif déstabilisant
          let perms;
          try {
            perms = await PushNotifications.checkPermissions();
          } catch {
            perms = null;
          }
          if (!perms || perms.receive === "denied") {
            return;
          }

          let finalPerms;
          try {
            finalPerms = await PushNotifications.requestPermissions().catch(() => null);
          } catch {
            finalPerms = null;
          }
          if (!finalPerms || finalPerms.receive !== "granted") {
            return;
          }

          // Enregistrement : peut échouer si FCM n'est pas configuré
          // (google-services.json absent). On ne crash JAMAIS.
          try {
            await PushNotifications.register();
          } catch (err) {
            console.log("Push register indisponible (FCM ?):", err);
            return;
          }

          try {
            PushNotifications.addListener("registration", async ({ value }) => {
              if (disposed || !value) return;
              try {
                const { registerPushTokenAction } = await import("@/actions/push-actions");
                await registerPushTokenAction(platform === "ios" ? "ios" : "android", value);
              } catch (e) {
                console.log("registerPushTokenAction:", e);
              }
            });
          } catch (e) {
            console.log("addListener registration:", e);
          }

          PushNotifications.addListener("registrationError", (err) => {
            console.log("Push registration error (non bloquant):", err);
          });
        } catch (err) {
          // Push non configuré (google-services.json / APNs) : non bloquant.
          console.log("Push notifications indisponibles :", err);
        }
      } catch {
        /* Absence totale de Capacitor → comportement web normal */
      }
    };

    init();
    return () => {
      disposed = true;
      // Retirer le listener backButton proprement à la destruction du composant.
      try {
        backHandler?.remove?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}