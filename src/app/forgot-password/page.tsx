"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, ArrowLeft, Check, AlertCircle } from "lucide-react";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth-actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resetPasswordAction(email);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
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
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg"
          >
            <span className="text-white text-2xl font-bold">R</span>
          </motion.div>
          <h1 className="text-2xl font-bold">Mot de passe oublié</h1>
          <p className="text-[#8A8A8A] text-sm mt-1">
            {sent
              ? "Un email de réinitialisation vous a été envoyé"
              : "Entrez votre email pour réinitialiser votre mot de passe"}
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            {!sent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {error && (
                  <p className="text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Envoyer"
                  )}
                </Button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm text-[#8A8A8A] hover:text-[#111111] dark:hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour à la connexion
                </Link>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-sm text-[#8A8A8A] mb-6">
                  Si un compte existe avec cette adresse, vous recevrez un email de réinitialisation.
                </p>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}