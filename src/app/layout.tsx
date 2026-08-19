import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import Script from "next/script";

export const metadata: Metadata = {
  // Base canonique : garantit que les liens OG/médias utilisent le vrai
  // domaine en production (jamais localhost), cf. getAppBaseUrl().
  metadataBase: new URL("https://rewardlyfree.vercel.app"),
  title: "Rewardly - Plateforme de tâches rémunérées",
  description: "Gagnez de l'argent en accomplissant des tâches simples. Rejoignez Rewardly, la plateforme de micro-tâches rémunérées la plus fiable.",
  keywords: ["tâches rémunérées", "gagner de l'argent", "micro-tâches", "rewardly", "freelance"],
  icons: {
    icon: "/images/logo.png",
    apple: "/images/logo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rewardly",
  },
  openGraph: {
    title: "Rewardly - Plateforme de tâches rémunérées",
    description: "Gagnez de l'argent en accomplissant des tâches simples.",
    type: "website",
    images: ["/images/logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#9D3FE7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rewardly" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Rewardly" />
      </head>
      <body className="bg-[#F7F7F8] dark:bg-[#090909] text-[#111111] dark:text-white antialiased">
        <Providers>{children}</Providers>
        {/* Enregistrement du Service Worker PWA */}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function(err) {
                  console.log('SW registration failed:', err);
                });
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}