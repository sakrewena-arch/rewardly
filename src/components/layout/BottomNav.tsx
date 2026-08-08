"use client";

import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, CheckSquare, BarChart3, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 bg-black dark:bg-black rounded-[100px] px-2 py-2 shadow-lg shadow-black/20">
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
      </div>
    </nav>
  );
}