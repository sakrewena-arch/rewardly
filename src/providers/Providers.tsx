"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NativeCapacitor } from "@/components/features/NativeCapacitor";
import { OfflineDetector } from "@/components/features/OfflineDetector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
        {/* Détection hors ligne (redirige vers /offline) */}
        <OfflineDetector />
        {/* Push natif + status bar + bouton retour — no-op sur le web */}
        <NativeCapacitor />
      </ThemeProvider>
    </QueryClientProvider>
  );
}