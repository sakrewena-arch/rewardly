"use client";

import { useEffect } from "react";

/**
 * Intégration Capacitor NATIF (Android / iOS).
 * - Enregistre le token de push (FCM / APNs) auprès du serveur via la
 *   Server Action registerPushTokenAction (table public.push_tokens).
 * - Ajuste la status bar pour correspondre au thème de l'app.
 * Ne s'exécute QUE dans une WebView Capacitor ; sur le web classique,
 * ce composant ne fait rien (Capacitor.isNativePlatform() === false).
 */
export function NativeCapacitor() {
  useEffect(() => {
    let disposed = false;

    const init = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const platform = Capacitor.getPlatform(); // "android" | "ios"

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
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          const perms = await PushNotifications.requestPermissions();
          if (perms.receive !== "granted") return;

          await PushNotifications.register();

          PushNotifications.addListener("registration", async ({ value }) => {
            if (disposed || !value) return;
            const { registerPushTokenAction } = await import("@/actions/push-actions");
            await registerPushTokenAction(platform === "ios" ? "ios" : "android", value);
          });

          PushNotifications.addListener("registrationError", (err) => {
            console.error("Push registration error:", err);
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
    };
  }, []);

  return null;
}