"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, Shield, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 🔒 Utiliser une route API au lieu d'une Server Action
      // pour éviter que Next.js ne log les credentials en développement
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erreur lors de la connexion");
        setLoading(false);
        return;
      }

      // Succès → redirection complète vers l'admin
      // (window.location.href force une navigation complète qui envoie le cookie)
      window.location.href = "/admin";
    } catch (err) {
      setError("Erreur lors de la connexion");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/30">
            <Shield className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Administration</h1>
          <p className="text-white/60 text-sm mt-1">Espace réservé aux administrateurs</p>
        </div>
        <div className="bg-white dark:bg-[#161616] rounded-2xl shadow-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <Input type="email" placeholder="admin@rewardly.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>
            {error && (
              <p className="text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </p>
            )}
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" size="lg" disabled={loading}>
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Accéder à l'administration"}
            </Button>
          </form>
        </div>
        <button onClick={() => router.push("/dashboard")} className="mt-6 mx-auto flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Retour au site
        </button>
      </motion.div>
    </div>
  );
}