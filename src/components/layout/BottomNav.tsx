"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
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

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { navHidden, navAutoHidden, showNav, toggleNav } = useNav();

  // S'assurer que la barre réapparaît à chaque changement de page
  // (au cas où elle serait restée masquée après la fermeture d'un popup).
  useEffect(() => {
    showNav();
  }, [pathname, showNav]);

  return (
    <>
      {/* Barre de navigation (animee : glisse vers le bas quand masquee) */}
      <motion.div
        initial={false}
        animate={{ x: "-50%", y: navHidden ? 190 : 0, opacity: navHidden ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        style={{ pointerEvents: navHidden ? "none" : "auto" }}
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
                  "relative flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300",
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

      {/* Bouton flottant qui fait remonter la barre (masquage manuel uniquement) */}
      {navHidden && !navAutoHidden && (
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