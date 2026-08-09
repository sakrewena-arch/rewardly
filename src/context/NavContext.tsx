"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface NavContextType {
  navHidden: boolean;
  navAutoHidden: boolean;
  hideNav: (auto?: boolean) => void;
  showNav: () => void;
  toggleNav: () => void;
}

const NavContext = createContext<NavContextType | undefined>(undefined);

/**
 * Contrôle la visibilité de la barre de navigation mobile (BottomNav).
 *
 * - `hideNav(true)`  : la barre est masquée AUTOMATIQUEMENT (ex: popup de
 *   validation manuelle ouvert). Aucun bouton "restaurer" n'est affiché,
 *   la barre revient toute seule quand le popup se ferme.
 * - `hideNav(false)` / `toggleNav()` : masquage MANUEL. Un bouton flottant
 *   permet alors de faire remonter la barre.
 * - `showNav()` : affiche à nouveau la barre (même état manuel).
 */
export function NavProvider({ children }: { children: React.ReactNode }) {
  const [navHidden, setNavHidden] = useState(false);
  const [navAutoHidden, setNavAutoHidden] = useState(false);

  const hideNav = useCallback((auto = false) => {
    setNavAutoHidden(auto);
    setNavHidden(true);
  }, []);

  const showNav = useCallback(() => {
    setNavAutoHidden(false);
    setNavHidden(false);
  }, []);

  const toggleNav = useCallback(() => {
    setNavAutoHidden(false);
    setNavHidden((prev) => !prev);
  }, []);

  return (
    <NavContext.Provider value={{ navHidden, navAutoHidden, hideNav, showNav, toggleNav }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (context === undefined) {
    // Fallback inerte (pages rendues hors du NavProvider)
    return {
      navHidden: false,
      navAutoHidden: false,
      hideNav: () => {},
      showNav: () => {},
      toggleNav: () => {},
    };
  }
  return context;
}