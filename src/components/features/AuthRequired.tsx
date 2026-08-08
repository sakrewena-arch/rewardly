"use client";

import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface AuthRequiredProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function AuthRequired({ title, description, icon }: AuthRequiredProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Si l'utilisateur est connecté, ne rien afficher (la page normale s'affiche)
  if (user) return null;

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
          {icon || <Lock className="w-10 h-10 text-purple-600" />}
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-[#8A8A8A] text-sm mb-8">{description}</p>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => router.push("/login")}>
            Se connecter <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={() => router.push("/register")}>
            Créer un compte
          </Button>
          <Button size="sm" variant="ghost" className="w-full text-[#8A8A8A]" onClick={() => router.push("/dashboard")}>
            Retour à l'accueil
          </Button>
        </div>
      </motion.div>
    </div>
  );
}