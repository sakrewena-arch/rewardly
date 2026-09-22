"use client";

import { useEffect, useState } from "react";
import { toPng } from "html-to-image";
import { ArrowLeft, Download, Wallet, Sparkles, Users, Check, TrendingUp, ArrowRight, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ============================================================
// PAGE /affiche — Génère une affiche publicitaire moderne pour Rewardly
// Aperçu + bouton de téléchargement PNG (haute résolution).
// ============================================================

// Lien officiel de la plateforme (fixe, identique côté serveur & client
// → aucune erreur d'hydratation ; cohérent en dev et en production).
const BASE_URL = "https://rewardly.website";

function PosterArtwork() {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(`${BASE_URL}/register`)}`;

  return (
    <div
      id="poster"
      style={{ width: 1200, height: 1600 }}
      className="relative overflow-hidden bg-[#160B38] text-white font-sans"
    >
      {/* Halos décoratifs */}
      <div className="absolute -top-32 -left-24 w-[500px] h-[500px] rounded-full bg-[#7C3AED]/40 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full bg-[#F7CB57]/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 -left-20 w-[380px] h-[380px] rounded-full bg-[#C026D3]/25 blur-3xl pointer-events-none" />
      {/* Grille décorative */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center h-full px-16 py-14">
        {/* ===== HEADER ===== */}
        <div className="flex flex-col items-center gap-4">
          <img
            src="/images/logo.png"
            alt="Rewardly"
            className="w-24 h-24 rounded-3xl object-contain bg-white p-4 shadow-2xl shadow-black/40"
          />
          <div>
            <div className="text-5xl font-black tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
              Rewardly
            </div>
            <div className="text-lg font-semibold tracking-[0.22em] text-[#F7CB57] uppercase mt-1">
              Des missions · Du cash
            </div>
          </div>
        </div>

        {/* ===== TITRE ===== */}
        <div className="mt-8 max-w-[820px] mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F7CB57] text-[#160B38] font-extrabold uppercase tracking-widest text-base px-5 py-2.5 shadow-[0_8px_30px_rgba(247,203,87,0.5)]">
            <Sparkles className="w-5 h-5" /> 100% gratuit
          </div>
          <h1 className="mt-6 text-[3.6rem] font-black leading-[1.05] drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)]">
            Gagnez de l&apos;argent en accomplissant des tâches simples
          </h1>
          <p className="mt-5 text-2xl leading-relaxed text-white/85 mx-auto max-w-[640px]">
            Créez un compte gratuit, accomplissez{" "}
            <span className="font-bold text-[#F7CB57]">1 tâche par jour</span> et
            retirez vos gains en Mobile Money.
          </p>
        </div>

        {/* ===== WALLET DE LA PLATEFORME ===== */}
        <div className="relative mt-8 w-[620px] mx-auto">
          <div className="absolute -inset-3 rounded-[2.2rem] bg-gradient-to-r from-[#F7CB57] via-[#C026D3] to-[#7C3AED] opacity-70 blur-lg" />
          <div className="relative overflow-hidden rounded-[2rem] card-gradient p-8 shadow-2xl shadow-black/50 text-left">
            {/* Liséré doré (comme le wallet connecté) */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-[#F7CB57]" />
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-medium uppercase tracking-widest text-white/60">Balance totale</div>
                <div className="text-5xl font-black mt-1 drop-shadow-lg">{formatCurrency(158000)}</div>
              </div>
              <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center border border-white/30">
                <Wallet className="w-10 h-10 text-[#F7CB57]" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-white/80">
              <span className="text-lg">Le wallet qui vous fait gagner</span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white text-[#5B21B6] font-bold text-base px-5 py-2.5 shadow-lg">
                💰 Retirable
              </span>
            </div>
          </div>
        </div>

        {/* ===== ÉTAPES ===== */}
        <div className="mt-8 space-y-3">
          {[
            { icon: Users, title: "1. Créez votre compte gratuit", desc: "Inscription en 30 secondes, aucun paiement." },
            { icon: Check, title: "2. Accomplissez 1 tâche par jour", desc: "Visites, sondages, partages, abonnements." },
            { icon: TrendingUp, title: "3. Retirez vos gains", desc: "Mobile Money : Orange, MTN, Wave, Moov..." },
          ].map((s) => (
            <div
              key={s.title}
              className="w-[600px] mx-auto flex items-center gap-5 bg-white/10 ring-1 ring-white/20 rounded-2xl px-6 py-4 text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#C026D3] flex items-center justify-center flex-shrink-0">
                <s.icon className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold">{s.title}</div>
                <div className="text-base text-white/70 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== BADGE PARRAINAGE ===== */}
        <div className="mt-7 w-[600px] mx-auto flex items-center justify-between rounded-2xl bg-[#F7CB57] text-[#160B38] px-7 py-4 shadow-[0_10px_36px_rgba(247,203,87,0.4)]">
          <div>
            <div className="text-2xl font-black">Parrainez vos amis 🎉</div>
            <div className="text-lg font-semibold mt-0.5">Gagnez 10% des gains de chaque filleul</div>
          </div>
          <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-2xl font-black">10%</div>
        </div>

        {/* ===== QR + CTA ===== */}
        <div className="mt-7 w-[600px] mx-auto flex items-center gap-6 rounded-3xl bg-white/10 ring-1 ring-white/20 px-7 py-6">
          <img
            src={qrUrl}
            alt="QR code Rewardly"
            className="w-36 h-36 rounded-2xl bg-white p-2"
          />
          <div>
            <div className="text-3xl font-black leading-tight">
              Rejoignez-nous<br /> gratuitement !
            </div>
            <div className="mt-3 inline-flex items-center gap-3 rounded-full bg-white text-[#5B21B6] font-bold text-lg px-7 py-3 shadow-xl">
              <ArrowRight className="w-5 h-5" /> {BASE_URL.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="mt-auto pt-8 flex items-center justify-center gap-6 text-white/60">
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Rewardly" className="w-10 h-10 rounded-lg object-contain bg-white p-1" />
            <span className="text-lg font-semibold text-white/80">Rewardly</span>
          </div>
          <span className="text-xl font-bold text-[#F7CB57]">Gagnez en vous amusant 🚀</span>
        </div>
      </div>
    </div>
  );
}

export default function AffichePage() {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Échelle d'aperçu : l'affiche fait 1200×1600, on l'adapte à l'écran
  const [scale, setScale] = useState(0.3);

  useEffect(() => {
    const update = () => {
      const available = Math.min(window.innerWidth - 40, 520);
      setScale(Math.min(1, available / 1200));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Export PNG haute résolution (2400×3200)
  const handleDownload = async () => {
    const node = document.getElementById("poster");
    if (!node) return;
    setDownloading(true);
    setError(null);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = "rewardly-affiche.png";
      link.href = dataUrl;
      link.click();
    } catch (e) {
      setError("Impossible de générer l'image sur cet appareil. Réessayez.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909]">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-16 space-y-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-lg">Affiche publicitaire</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Aperçu de l'affiche */}
        <div className="flex justify-center rounded-2xl bg-black/30 dark:bg-black/40 py-4 overflow-x-auto">
          <div style={{ width: 1200 * scale, height: 1600 * scale }}>
            <div
              style={{
                width: 1200,
                height: 1600,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <PosterArtwork />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération en cours...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" /> Télécharger l&apos;affiche (PNG)
              </>
            )}
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => router.push("/register")}>
            <Share2 className="w-4 h-4 mr-2" /> Créer un compte gratuit
          </Button>
          {error && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">{error}</p>
          )}
          <p className="text-xs text-[#8A8A8A] text-center">
            Affiche 1200 × 1600 px — partagez-la sur WhatsApp, Telegram ou imprimez-la.
          </p>
        </div>
      </div>
    </div>
  );
}