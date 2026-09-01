"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Détecteur de connexion global.
 * - Quand la connexion Internet est perdue → redirige vers /offline.
 * - Quand elle revient → retourne automatiquement au tableau de bord.
 * Ne s'active que sur les pages du dashboard (pas /offline, ni /login, /register…).
 */
export function OfflineDetector() {
  const pathname = usePathname();
  const router = useRouter();
  const [wasOnline, setWasOnline] = useState(true);

  useEffect(() => {
    // Jamais d'action sur la page offline elle-même ou les pages auth/admin.
    const isGuarded = pathname === "/offline" || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/admin") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password") || pathname.startsWith("/maintenance");

    const handleOffline = () => {
      setWasOnline(false);
      if (!isGuarded) {
        router.replace("/offline");
      }
    };

    const handleOnline = () => {
      setWasOnline(true);
      if (pathname === "/offline") {
        router.replace("/dashboard");
      }
    };

    // État initial
    if (typeof navigator !== "undefined" && !navigator.onLine && !isGuarded) {
      router.replace("/offline");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [pathname, router]);

  return null;
}