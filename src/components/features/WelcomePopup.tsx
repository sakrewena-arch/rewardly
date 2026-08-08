"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Megaphone, Coins, CheckCircle, FileText, Shield, X } from "lucide-react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "rewardly_welcome_accepted";

export default function WelcomePopup() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<"accept" | "options">("accept");

  useEffect(() => {
    // Afficher le popup UNIQUEMENT à la première visite
    if (typeof window === "undefined") return;
    const acceptedDone = localStorage.getItem(STORAGE_KEY);
    if (!acceptedDone) {
      setShow(true);
    }
  }, []);

  // Bloquer le scroll de l'arrière-plan quand le popup est ouvert
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  const handleAccept = () => {
    setStep("options");
    localStorage.setItem(STORAGE_KEY, "true");
    setAccepted(true);
  };

  const handleClose = () => {
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        >
          <motion.div
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 30 }}
            className="w-full max-w-md bg-white dark:bg-[#161616] rounded-3xl overflow-hidden shadow-2xl my-auto"
          >
            {/* Logo + Header */}
            <div className="card-gradient p-6 text-center relative">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src="/images/logo.png"
                alt="Rewardly Logo"
                className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur object-contain mx-auto mb-3"
              />
              <h1 className="text-2xl font-bold text-white">Bienvenue sur Rewardly</h1>
              <p className="text-white/70 text-sm mt-1">La plateforme de micro-tâches rémunérées</p>
            </div>

            {step === "accept" ? (
              /* ======= ÉTAPE 1 : Conditions d'utilisation ======= */
              <div className="p-6 space-y-4">
                <h2 className="font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-500" /> Conditions d'utilisation
                </h2>

                {/* Conditions scrollables */}
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 max-h-56 overflow-y-auto text-sm space-y-3">
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">1. Comment Rewardly fonctionne</strong><br />
                    Rewardly est une plateforme de micro-tâches rémunérées. Des <strong>entreprises et des annonceurs paient Rewardly</strong> pour diffuser leurs publicités (visites de sites, sondages, tests d'applications, de jeux, d'IA, partages). C'est grâce à ces revenus publicitaires que nous pouvons <strong>rémunérer les utilisateurs</strong> qui accomplissent ces tâches.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">2. Pourquoi payer pour activer un pack ?</strong><br />
                    L'activation d'un pack (Bronze, Silver, Gold) est un <strong>engagement de motivation</strong>. Elle garantit que seuls les utilisateurs sérieux et actifs participent aux campagnes publicitaires. Les entreprises paient pour des résultats réels — un utilisateur qui a investi est plus susceptible d'accomplir ses tâches sérieusement. Le montant du pack est <strong>réinvesti dans votre propre récompense</strong> : plus le pack est élevé, plus les tâches sont rémunératrices et nombreuses.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">3. Tâches rémunérées</strong><br />
                    Rewardly propose des micro-tâches rémunérées (visites, sondages, tests, partages). Chaque tâche accomplie selon les instructions vous crédite le montant indiqué. Les gains proviennent directement des budgets publicitaires des entreprises.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">4. Retraits</strong><br />
                    Les gains sont versés sur votre wallet. Les retraits sont soumis à un montant minimum et aux conditions de la plateforme. Vous pouvez retirer vos gains via mobile money (MTN, Orange, Wave, etc.).
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">5. Fraude</strong><br />
                    Toute tentative de fraude (multi-comptes, exploitation de bugs, fausses preuves) entraîne le bannissement définitif et la confiscation des gains.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong className="text-[#111111] dark:text-white">6. Responsabilité</strong><br />
                    Rewardly n'est pas responsable des pertes liées aux investissements. Investissez prudemment et uniquement ce que vous pouvez vous permettre.
                  </p>
                </div>

                {/* Politique de confidentialité */}
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm">
                  <p className="flex items-center gap-2 font-medium mb-2">
                    <Shield className="w-4 h-4 text-purple-500" /> Politique de confidentialité
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed">
                    <strong>1. Données collectées</strong> : Nous collectons vos informations personnelles (nom, email, téléphone) pour gérer votre compte, vos gains et vos retraits.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed mt-2">
                    <strong>2. Utilisation des données</strong> : Vos données servent uniquement au fonctionnement de la plateforme (authentification, paiements, notifications). Nous ne vendons jamais vos données personnelles à des tiers.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed mt-2">
                    <strong>3. Données des campagnes</strong> : Lorsque vous accomplissez une tâche publicitaire, certaines informations (comme votre participation) peuvent être partagées avec l'annonceur pour valider la campagne, sans jamais révéler vos coordonnées personnelles.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed mt-2">
                    <strong>4. Sécurité</strong> : Vos données sont protégées par un chiffrement et des mesures de sécurité avancées. Seuls les administrateurs autorisés y ont accès.
                  </p>
                  <p className="text-[#8A8A8A] leading-relaxed mt-2">
                    <strong>5. Vos droits</strong> : Vous pouvez demander la suppression de votre compte et de vos données à tout moment en nous contactant.
                  </p>
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-gray-300 accent-purple-600"
                  />
                  <span className="text-sm">
                    J'ai lu et j'accepte les <strong>conditions d'utilisation</strong> et la <strong>politique de confidentialité</strong>
                  </span>
                </label>

                <button
                  onClick={handleAccept}
                  disabled={!accepted}
                  className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  J'accepte et je continue
                </button>
              </div>
            ) : (
              /* ======= ÉTAPE 2 : 3 options ======= */
              <div className="p-6 space-y-3">
                <h2 className="font-semibold text-center mb-2">Que voulez-vous faire ?</h2>

                {/* Bouton 1 - Télécharger l'app */}
                <button
                  onClick={() => router.push("/")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-purple-200 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-500/10 hover:border-purple-500 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Download className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Télécharger notre application mobile</p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5">Android • iOS • Windows</p>
                  </div>
                </button>

                {/* Bouton 2 - Nous contacter pour publicités */}
                <button
                  onClick={() => router.push("/services")}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 hover:border-rose-500 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Nous contacter pour vos publicités</p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5">Promouvez votre entreprise, site web, application</p>
                  </div>
                </button>

                {/* Bouton 3 - Commencer à gagner */}
                <button
                  onClick={handleClose}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 hover:border-green-500 transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Coins className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Commencer à gagner de l'argent</p>
                    <p className="text-xs text-[#8A8A8A] mt-0.5">Accéder aux tâches rémunérées</p>
                  </div>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}