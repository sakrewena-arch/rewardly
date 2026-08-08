"use client";

import { useState, Suspense } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Gift } from "lucide-react";

function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Pass referral code via user metadata
    const { error } = await signUp(email, password, fullName, referralCode);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      router.push("/login?registered=true");
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F8] dark:bg-[#090909] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 rounded-2xl bg-white dark:bg-[#161616] border border-gray-200 dark:border-gray-700 p-2 flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <img src="/images/logo.png" alt="Rewardly Logo" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-2xl font-bold">Inscription</h1>
          <p className="text-[#8A8A8A] text-sm mt-1">Créez votre compte Rewardly</p>
          {referralCode && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 text-xs font-medium">
              <Gift className="w-3 h-3" />
              Parrainé avec le code : <strong>{referralCode}</strong>
            </div>
          )}
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input
                    type="text"
                    placeholder="Jean Dupont"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input
                    type="email"
                    placeholder="exemple@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8A8A] hover:text-[#111111] dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Créer mon compte"
                )}
              </Button>

              <p className="text-center text-sm text-[#8A8A8A]">
                Déjà un compte ?{" "}
                <Link href="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                  Se connecter
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}