"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, BadgeCheck, ShieldAlert, Award, X, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

// Une seule clé par campagne d'annonce — incrémentez le suffixe pour
// afficher une nouvelle annonce aux utilisateurs (ex: rewardly_announcement_v2).
const STORAGE_KEY = "rewardly_announcement_v1";

export default function AnnouncementPopup() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  // Si le pop-up de bienvenue n'a pas encore été accepté, il s'affiche aussi :
  // on lui laisse la gestion du scroll (il est ouvert juste en dessous).
  const [welcomePending, setWelcomePending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    setWelcomePending(!localStorage.getItem("rewardly_welcome_accepted"));

    // Petit délai → toujours par-dessus le pop-up de bienvenue.
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (welcomePending) return; // le pop-up de bienvenue gère le scroll
    document.body.style.overflow = show ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [show, welcomePending]);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          key="announcement-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[95]"
          onClick={handleClose}
        >
          <motion.div
            key="announcement-sheet"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            className="w-full max-w-md bg-white dark:bg-[#161616] rounded-3xl overflow-hidden shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ======= HEADER URGENCE ======= */}
            <div className="card-gradient p-6 text-center relative">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex mx-auto justify-center items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold mb-4 w-fit">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
                Information importante — À lire
              </div>

              <img
                src="/images/logo.png"
                alt="Rewardly Logo"
                className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur object-contain mx-auto mb-3"
              />
              <h1 className="text-2xl font-bold text-white">Annonce officielle</h1>
              <p className="text-white/70 text-sm mt-1">À tous les membres Rewardly</p>
            </div>

            {/* ======= CORPS DE L'ANNONCE ======= */}
            <div className="p-6 space-y-4">
              {/* 1 · GRATUITÉ */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <BadgeCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">1. Rewardly reste 100&nbsp;% gratuit</p>
                  <p className="text-xs text-[#8A8A8A] mt-1 leading-relaxed">
                    Rien ne change : aucun pack à acheter, aucun dépôt ni investissement. Vous
                    n&rsquo;aurez <strong>jamais à payer</strong> pour créer votre compte,
                    accomplir vos tâches ou retirer vos gains.
                  </p>
                </div>
              </div>

              {/* 2 · ALERTE ESCROQUERIE */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">2. Alerte — méfiez-vous des fausses plateformes</p>
                  <p className="text-xs text-[#8A8A8A] mt-1 leading-relaxed">
                    Certains sites utilisent abusivement le nom « Rewardly » pour faire payer les
                    gens. <strong>Ces sites ne nous appartiennent pas.</strong> Rewardly ne vous
                    demandera <strong>jamais d&rsquo;argent</strong>, ni pour gagner, ni pour
                    retirer vos gains. En cas de doute, signalez-le-nous immédiatement.
                  </p>
                </div>
              </div>

              {/* 3 · EXCLUSIVITÉ */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">3. Exclusivité — des missions sur-mesure arrivent</p>
                  <p className="text-xs text-[#8A8A8A] mt-1 leading-relaxed">
                    Rewardly est désormais en partenariat <strong>exclusif</strong> avec plusieurs
                    entreprises. Elles publieront bientôt chez nous des missions
                    <strong>spécifiques, conçues sur demande et mieux rémunérées</strong> que les
                    tâches classiques. Ces opportunités seront réservées en priorité à nos membres
                    — restez connectés&nbsp;!
                  </p>
                </div>
              </div>
            </div>

            {/* ======= ACTIONS ======= */}
            <div className="px-6 pb-6 space-y-3">
              {/* Bouton principal : J'ai compris */}
              <button
                onClick={handleClose}
                className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.98] shadow-lg transition-all"
              >
                J&rsquo;ai compris
              </button>

              {/* Bouton secondaire : signaler une fraude */}
              <button
                onClick={() => router.push("/contact")}
                className="w-full py-3 rounded-xl border-2 border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 hover:border-red-500 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <ShieldAlert className="w-4 h-4" />
                Signaler une fraude
              </button>

              {/* Lien : voir les missions */}
              <button
                onClick={() => router.push("/tasks")}
                className="w-full text-purple-600 text-sm font-medium flex items-center justify-center gap-1 hover:underline py-2"
              >
                Voir les missions disponibles
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}