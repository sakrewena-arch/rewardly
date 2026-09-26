"use client";

// ============================================================
// AFFICHE PUBLICITAIRE (/affiche)
// ============================================================
// Affiche prête à publier (WhatsApp, Facebook) ou à imprimer en A4.
//   • Reprend EXACTEMENT le wallet de la plateforme (même dégradé,
//     même mise en page que la carte du tableau de bord).
//   • Drapeaux de TOUS les pays supportés (source : src/lib/geo.ts).
//   • Téléchargement PNG haute définition (html-to-image) + impression.
// ============================================================

import { useCallback, useRef, useState } from "react";
import {
  Download,
  Printer,
  Link2,
  Check,
  ShieldCheck,
  Zap,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Loader2,
  Smartphone,
} from "lucide-react";
import { FEEXPAY_COUNTRIES } from "@/lib/geo";
import { getAppBaseUrl, formatCurrency } from "@/lib/utils";

/** Montant mis en avant sur l'affiche (illustration commerciale). */
const MONTANT_AFFICHE = 508000;

/** Pays supportés (drapeau + nom) — dérivés de la config FeeXPay. */
const COUNTRIES = Object.values(FEEXPAY_COUNTRIES).map((c) => ({
  code: c.code,
  flag: c.flag,
  name: c.name,
}));

/** Logos Mobile Money réellement proposés par la plateforme. */
const MOMO_LOGOS = Array.from(
  new Set(
    Object.values(FEEXPAY_COUNTRIES)
      .flatMap((c) => c.paymentMethods)
      .filter((m) => m.type === "momo")
      .map((m) => m.logo)
  )
).slice(0, 7);

const ETAPES = [
  { n: "1", titre: "Activez votre pack", texte: "Dès 5 000 FCFA (Bronze, Silver, Gold)" },
  { n: "2", titre: "Accomplissez vos tâches", texte: "De 1 à plusieurs missions par jour" },
  { n: "3", titre: "Retirez vos gains", texte: "Mobile Money, dès 5 000 FCFA" },
];

const AVANTAGES = [
  { icon: Zap, titre: "Tâches simples", texte: "Quelques minutes par jour" },
  { icon: Smartphone, titre: "Mobile Money", texte: "MTN • Moov • Wave • Orange" },
  { icon: Users, titre: "Parrainage 10 %", texte: "Sur les investissements de vos filleuls" },
  { icon: ShieldCheck, titre: "Paiements suivis", texte: "Chaque opération est tracée" },
];

export default function AfficheClient() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = getAppBaseUrl().replace(/\/$/, "");
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=0&data=${encodeURIComponent(
    baseUrl
  )}`;

  /** Télécharge l'affiche en PNG haute définition. */
  const downloadPng = useCallback(async () => {
    if (!posterRef.current) return;
    setExporting(true);
    setError(null);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0A0614",
      });
      const link = document.createElement("a");
      link.download = "affiche-rewardly.png";
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export affiche:", e);
      setError("Impossible de générer l'image. Utilisez « Imprimer / PDF ».");
    } finally {
      setExporting(false);
    }
  }, []);

  const copyPosterLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${baseUrl}/affiche`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  }, [baseUrl]);

  return (
    <main className="min-h-screen bg-[#05030B] pb-16">
      {/* ===== Barre d'outils (masquée à l'impression) ===== */}
      <div className="no-print sticky top-0 z-50 border-b border-white/10 bg-[#05030B]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-sm font-bold text-white">Affiche publicitaire</h1>
            <p className="text-[11px] text-white/50">
              À publier sur WhatsApp / Facebook, ou à imprimer en A4 — pour un format story, utilisez
              « Télécharger l&apos;image »
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadPng}
              disabled={exporting}
              className="flex items-center gap-2 rounded-xl bg-[#F7CB57] px-3.5 py-2 text-xs font-bold text-[#241A00] transition hover:brightness-105 disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Génération…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Télécharger l&apos;image
                </>
              )}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              <Printer className="h-4 w-4" /> Imprimer / PDF
            </button>
            <button
              onClick={copyPosterLink}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
              {copied ? "Lien copié" : "Copier le lien"}
            </button>
          </div>
        </div>
        {error && (
          <p className="mx-auto max-w-5xl px-4 pb-2 text-[11px] text-red-400">{error}</p>
        )}
      </div>

      {/* ===== L'AFFICHE (exactement ce qui sera exporté / imprimé) ===== */}
      <div className="px-3 pt-6 sm:px-6">
        <div
          ref={posterRef}
          className="print-poster relative mx-auto w-full max-w-[880px] overflow-hidden rounded-[28px] shadow-2xl shadow-black/60"
          style={{ background: "linear-gradient(160deg,#160A2E 0%,#0A0614 45%,#07030F 100%)" }}
        >
          {/* Halos + trame (texture d'affiche) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 70% at 50% -15%, rgba(157,63,231,0.55) 0%, rgba(157,63,231,0) 60%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(55% 35% at 92% 108%, rgba(247,203,87,0.26) 0%, rgba(247,203,87,0) 65%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "46px 46px",
            }}
          />

          <div className="relative px-5 pb-6 pt-6 sm:px-10 sm:pb-8 sm:pt-9">
            {/* ---------- En-tête de marque ---------- */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/logo.png"
                  alt="Rewardly"
                  className="h-11 w-11 rounded-2xl bg-white/10 object-contain p-1 sm:h-14 sm:w-14"
                />
                <div>
                  <p className="text-lg font-black leading-none tracking-tight text-white sm:text-2xl">
                    REWARDLY
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#F7CB57] sm:text-xs">
                    Tâches rémunérées • Mobile Money
                  </p>
                </div>
              </div>
              <div className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] font-semibold text-white/80 sm:px-3 sm:py-1.5 sm:text-xs">
                {COUNTRIES.length} pays
              </div>
            </div>

            {/* ---------- Accroche ---------- */}
            <div className="mt-6 text-center sm:mt-9">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F7CB57] sm:text-sm">
                Gagnez jusqu&apos;à
              </p>
              <p className="mt-1 text-[15vw] font-black leading-[0.9] text-white sm:text-[66px] md:text-[80px]">
                508&nbsp;000
                <span className="ml-2 align-middle text-[5.5vw] font-bold text-[#F7CB57] sm:text-3xl md:text-4xl">
                  FCFA
                </span>
              </p>
              <p className="mx-auto mt-2 max-w-[560px] text-[12.5px] font-medium leading-snug text-white/80 sm:text-base">
                de gains cumulés par les membres actifs*, en accomplissant des{" "}
                <span className="font-bold text-white">tâches simples</span> depuis leur téléphone
              </p>
            </div>

            {/* ---------- LE WALLET DE LA PLATEFORME ---------- */}
            <div className="relative mt-6 overflow-hidden rounded-3xl shadow-2xl shadow-black/50 sm:mt-8">
              <div className="absolute left-0 right-0 top-0 z-10 h-2 bg-[#F7CB57]" />
              <div className="card-gradient px-4 pb-5 pt-7 sm:px-7 sm:pb-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60 sm:text-[10px]">
                      Balance totale
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-[8.5vw] font-black leading-none text-white sm:text-[40px]">
                        {formatCurrency(MONTANT_AFFICHE)}
                      </p>
                      <Eye className="h-4 w-4 text-white/60 sm:h-5 sm:w-5" />
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/logo.png"
                    alt=""
                    className="h-10 w-10 rounded-xl bg-white/15 object-contain p-1 sm:h-14 sm:w-14"
                  />
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 sm:mt-5">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/50">Titulaire</p>
                    <p className="text-xs font-bold text-white sm:text-sm">Membre Rewardly</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[0.14em] text-white/50">Compte</p>
                    <p className="text-xs font-bold text-[#F7CB57] sm:text-sm">✓ Vérifié</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-7 rounded-md bg-gradient-to-br from-[#F7CB57] to-[#C79A28] sm:h-7 sm:w-10" />
                    <p className="font-mono text-[11px] font-bold tracking-[0.16em] text-white sm:text-base">
                      •••• •••• •••• 5080
                    </p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/payment-methods/mastercard.jfif"
                    alt=""
                    className="h-5 w-auto rounded sm:h-7"
                  />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { l: "Gains", v: formatCurrency(MONTANT_AFFICHE) },
                    { l: "Investi", v: formatCurrency(20000) },
                    { l: "Retirable", v: formatCurrency(MONTANT_AFFICHE - 20000) },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-xl bg-white/10 px-2 py-2 text-center backdrop-blur"
                    >
                      <p className="text-[8.5px] uppercase tracking-wide text-white/60 sm:text-[10px]">
                        {s.l}
                      </p>
                      <p className="text-[10px] font-bold text-white sm:text-sm">{s.v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 shadow-lg shadow-black/10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
                      <ArrowDownLeft className="h-4 w-4 text-green-600" />
                    </span>
                    <span className="text-xs font-bold text-[#111111] sm:text-sm">Déposer</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 shadow-lg shadow-black/10">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                      <ArrowUpRight className="h-4 w-4 text-blue-600" />
                    </span>
                    <span className="text-xs font-bold text-[#111111] sm:text-sm">Retirer</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------- PAYS SUPPORTÉS (drapeaux réels de la plateforme) ---------- */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:mt-8 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F7CB57] sm:text-xs">
                  Disponible dans {COUNTRIES.length} pays
                </p>
                <Wallet className="h-4 w-4 text-white/40" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COUNTRIES.map((c) => (
                  <div
                    key={c.code}
                    className="flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2"
                  >
                    <span className="text-base leading-none sm:text-xl">{c.flag}</span>
                    <span className="truncate text-[10px] font-semibold text-white/85 sm:text-xs">
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ---------- COMMENT ÇA MARCHE (3 étapes) ---------- */}
            <div className="mt-6 grid gap-2.5 sm:mt-7 sm:grid-cols-3">
              {ETAPES.map((e) => (
                <div
                  key={e.n}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F7CB57] text-sm font-black text-[#241A00]">
                    {e.n}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white sm:text-sm">{e.titre}</p>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-white/60 sm:text-xs">
                      {e.texte}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ---------- AVANTAGES ---------- */}
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {AVANTAGES.map((a) => (
                <div
                  key={a.titre}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#9D3FE7]/25">
                    <a.icon className="h-[18px] w-[18px] text-[#C08CF5]" />
                  </span>
                  <p className="mt-2 text-[12px] font-bold text-white sm:text-sm">{a.titre}</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-white/60 sm:text-xs">
                    {a.texte}
                  </p>
                </div>
              ))}
            </div>

            {/* ---------- MOYENS DE PAIEMENT RÉELS ---------- */}
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                Dépôts &amp; retraits Mobile Money
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
                {MOMO_LOGOS.map((logo) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={logo}
                    src={logo}
                    alt=""
                    className="h-9 w-14 rounded-lg bg-white object-contain p-1 sm:h-11 sm:w-16"
                  />
                ))}
              </div>
            </div>

            {/* ---------- APPEL À L'ACTION ---------- */}
            <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl bg-[#F7CB57] p-5 sm:flex-row sm:justify-between sm:p-6">
              <div className="text-center sm:text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5A4200]">
                  Inscrivez-vous gratuitement
                </p>
                <p className="mt-1 text-2xl font-black leading-none text-[#241A00] sm:text-3xl">
                  rewardly.website
                </p>
                <p className="mt-2 text-[11px] font-semibold text-[#5A4200] sm:text-xs">
                  Scannez le QR code — ou tapez le lien dans votre navigateur
                </p>
                <p className="mt-1 text-[10.5px] font-medium text-[#5A4200]/80">
                  Parrainage : 10 % des investissements de vos filleuls
                </p>
              </div>
              <div className="rounded-2xl bg-white p-2.5 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc}
                  alt="QR code Rewardly"
                  crossOrigin="anonymous"
                  className="h-28 w-28 sm:h-32 sm:w-32"
                />
              </div>
            </div>

            {/* ---------- MENTIONS ---------- */}
            <div className="mt-5 space-y-1.5 text-center">
              <p className="text-[9.5px] leading-snug text-white/45 sm:text-[10.5px]">
                *Exemple illustratif de gains cumulés : les revenus dépendent du pack activé, des tâches
                réalisées et de l&apos;assiduité. Aucun revenu n&apos;est garanti.
              </p>
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35 sm:text-[10px]">
                © Rewardly — {baseUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
