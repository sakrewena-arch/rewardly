"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Home, CheckSquare, BarChart3, User, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNav } from "@/context/NavContext";

const navItems = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/tasks", label: "Tâches", icon: CheckSquare },
  { href: "/history", label: "Historique", icon: Clock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/profile", label: "Profil", icon: User },
];

// Seuil de réduction de la viewport indiquant qu'un clavier virtuel est ouvert.
// Sur mobile le clavier réduit visualViewport.height d'environ 40%+ de l'écran.
const KEYBOARD_SHRINK_PX = 120;

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { navHidden, navAutoHidden, showNav, hideNav, toggleNav } = useNav();
  // État dédié au clavier : la barre est masquée tant que le clavier est ouvert,
  // indépendamment du masquage manuel/auto (popups). À la fermeture du clavier,
  // la barre revient à son état précédent.
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // S'assurer que la barre réapparaît à chaque changement de page
  // (au cas où elle serait restée masquée après la fermeture d'un popup).
  useEffect(() => {
    showNav();
  }, [pathname, showNav]);

  // 📱 Détection du clavier virtuel via visualViewport :
  // quand le clavier s'ouvre, la hauteur utile de la fenêtre diminue fortement.
  // On masque la barre de navigation sinon elle flotte au-dessus du clavier.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Hauteur de référence : la PLUS GRANDE valeur observée. Quand la fenêtre
    // s'agrandit (clavier fermé / rotation), la référence suit ; quand elle
    // rétrécit fortement, c'est que le clavier est ouvert.
    let maxHeight = vv.height;

    const onResize = () => {
      if (vv.height > maxHeight) maxHeight = vv.height;
      setKeyboardOpen(maxHeight - vv.height > KEYBOARD_SHRINK_PX);
    };

    const onScroll = () => onResize();

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onScroll);

    // Si l'utilisateur tape dans un input, le clavier est probablement ouvert :
    // fallback pour les navigateurs sans visualViewport fiable.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        setKeyboardOpen(true);
      }
    };
    const onFocusOut = () => {
      // Laisse resize (plus fiable) décider ; petit délai pour laisser le clavier se fermer.
      setTimeout(() => setKeyboardOpen(false), 150);
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onScroll);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  // Combiner : la barre est invisible si masquée manuellement/auto OU si le clavier est ouvert.
  const isHidden = navHidden || keyboardOpen;

  return (
    <>
      {/* Barre de navigation (animee : glisse vers le bas quand masquee) */}
      <motion.div
        initial={false}
        animate={{ x: "-50%", y: isHidden ? 190 : 0, opacity: isHidden ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{ pointerEvents: isHidden ? "none" : "auto" }}
        className="fixed bottom-6 left-1/2 z-50"
      >
        <div className="flex items-center gap-1 bg-black dark:bg-black rounded-[100px] px-2 py-2 shadow-lg shadow-black/20 relative">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 active:scale-[0.9]",
                  isActive ? "bg-white" : "hover:bg-white/10"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-white rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors duration-200",
                      isActive ? "text-black" : "text-white/70"
                    )}
                  />
                </span>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    className="relative z-10 text-sm font-medium text-black whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}

          {/* Poignée pour masquer manuellement la barre de navigation */}
          <button
            onClick={toggleNav}
            aria-label="Masquer la navigation"
            title="Masquer la navigation"
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform z-10"
          >
            <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </motion.div>

      {/* Bouton flottant qui fait remonter la barre (masquage manuel uniquement,
          JAMAIS quand le clavier est ouvert ni en masquage auto de popup) */}
      {navHidden && !navAutoHidden && !keyboardOpen && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={showNav}
          aria-label="Afficher la navigation"
          title="Afficher la navigation"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-12 h-12 rounded-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-700 shadow-xl flex items-center justify-center"
        >
          <ChevronUp className="w-5 h-5 text-black dark:text-white" />
        </motion.button>
      )}
    </>
  );
}