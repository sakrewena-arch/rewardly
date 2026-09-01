"use client";

import { motion } from "framer-motion";
import { Mail, Phone, Calendar, Wallet, TrendingUp, Gift, ChevronRight, LogOut, Moon, Sun, Share2, Shield, Settings, Gift as GiftIcon, Check, AlertCircle, Megaphone, Download, Headphones } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useWallet } from "@/hooks/useWallet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ProfileAuth } from "@/components/features/AuthRequiredPages";
import { applyReferralCodeAction } from "@/actions/user-actions";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const menuItems = [
  { icon: Settings, label: "Paramètres", href: "/settings" },
  { icon: Share2, label: "Parrainage", href: "/referral" },
  { icon: Shield, label: "Sécurité", href: "/security" },
  { icon: Megaphone, label: "Nos services", href: "/services" },
  { icon: Download, label: "Télécharger l'application", href: "/download" },
  { icon: Headphones, label: "Nous contacter", href: "/contact" },
];

export default function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { wallet, isLoading, withdrawableAmount } = useWallet();
  const router = useRouter();
  const [referralCode, setReferralCode] = useState("");
  const [referrer, setReferrer] = useState<any>(null);
  const [referralMsg, setReferralMsg] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  // Charger le parrain de l'utilisateur (via referrals OU profiles.referred_by)
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const loadReferrer = async () => {
      let referrerId: string | null = null;

      // 1. Chercher dans la table referrals (relation parrain → filleul)
      const { data: ref } = await supabase
        .from("referrals")
        .select("referrer_id")
        .eq("referred_id", user.id)
        .maybeSingle();
      if (ref?.referrer_id) {
        referrerId = ref.referrer_id;
      } else {
        // 2. Fallback : profil de l'utilisateur → referred_by
        const { data: myProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("user_id", user.id)
          .maybeSingle();
        if (myProfile?.referred_by) referrerId = myProfile.referred_by;
      }

      if (referrerId) {
        const { data: refProfile } = await supabase
          .from("profiles")
          .select("full_name, username, referral_code")
          .eq("user_id", referrerId)
          .maybeSingle();
        setReferrer(refProfile);
      }
    };
    loadReferrer();
  }, [user]);

  const handleApplyReferral = async () => {
    setApplying(true);
    setReferralError(null);
    setReferralMsg(null);
    const result = await applyReferralCodeAction(referralCode);
    if (result?.success) {
      setReferralMsg(`Code appliqué ! Votre parrain a reçu ${formatCurrency(result.commission || 0)}.`);
      setReferralCode("");
      // Recharger le parrain
      const supabase = createClient();
      if (supabase && user) {
        const { data: ref } = await supabase
          .from("referrals")
          .select("referrer_id")
          .eq("referred_id", user.id)
          .maybeSingle();
        if (ref?.referrer_id) {
          const { data: refProfile } = await supabase
            .from("profiles")
            .select("full_name, username, referral_code")
            .eq("user_id", ref.referrer_id)
            .maybeSingle();
          setReferrer(refProfile);
        }
      }
    } else {
      setReferralError(result?.error || "Erreur lors de l'application du code");
    }
    setApplying(false);
  };

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <ProfileAuth />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="text-[#8A8A8A] text-sm mt-1">Gérez votre compte</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="overflow-hidden">
          <div className="card-gradient p-6 text-center">
            {/* Animation Lottie (avatar animé) à la place de l'initiale */}
            <div className="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden bg-white/20 backdrop-blur border-2 border-white/30 shadow-lg">
              <iframe
                src="https://lottie.host/embed/38d0fbfc-5e2d-4263-94fd-05151fa334a9/uQo3vwglRM.lottie"
                className="w-full h-full"
                title="Avatar animé"
                style={{ border: "none", pointerEvents: "none" }}
                allowFullScreen
              />
            </div>
            <h2 className="text-xl font-bold text-white">{profile?.full_name || "Utilisateur"}</h2>
            <p className="text-white/70 text-sm mt-1">
              {profile?.role === "admin" || profile?.role === "super_admin" ? "Administrateur" : "Membre"}
            </p>
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#8A8A8A]" />
              <span className="text-sm">{user?.email}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#8A8A8A]" />
                <span className="text-sm">{profile.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#8A8A8A]" />
              <span className="text-sm">Membre depuis {formatDate(profile?.created_at || new Date().toISOString())}</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Section Parrainage - entrer le code de son parrain */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><GiftIcon className="w-4 h-4 text-purple-500" /> Parrainage</h3>

            {referrer ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-500/10 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 font-bold">
                  {(referrer.full_name || referrer.username || "P").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">Votre parrain : {referrer.full_name || referrer.username || "Utilisateur"}</p>
                  <p className="text-xs text-[#8A8A8A]">Code : {referrer.referral_code}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#8A8A8A]">
                  Entrez le code de parrainage de votre parrain pour le remercier et gagner des avantages.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Code de parrainage"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    className="uppercase"
                  />
                  <Button onClick={handleApplyReferral} disabled={applying || !referralCode.trim()}>
                    {applying ? "..." : "Appliquer"}
                  </Button>
                </div>
                {referralMsg && (
                  <p className="flex items-center gap-2 text-sm text-green-500">
                    <Check className="w-4 h-4" /> {referralMsg}
                  </p>
                )}
                {referralError && (
                  <p className="flex items-center gap-2 text-sm text-red-500">
                    <AlertCircle className="w-4 h-4" /> {referralError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Wallet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-3 gap-3"
      >
        <Card className="p-3 text-center">
          <Wallet className="w-4 h-4 text-purple-500 mx-auto mb-1" />
          <p className="text-xs text-[#8A8A8A]">Balance</p>
          <p className="text-sm font-bold mt-0.5">{formatCurrency(wallet?.balance || 0)}</p>
        </Card>
        <Card className="p-3 text-center">
          <TrendingUp className="w-4 h-4 text-green-500 mx-auto mb-1" />
          <p className="text-xs text-[#8A8A8A]">Gains</p>
          <p className="text-sm font-bold mt-0.5">{formatCurrency(wallet?.total_earnings || 0)}</p>
        </Card>
        <Card className="p-3 text-center">
          <Gift className="w-4 h-4 text-blue-500 mx-auto mb-1" />
          <p className="text-xs text-[#8A8A8A]">Retirable</p>
          <p className="text-sm font-bold mt-0.5">{formatCurrency(withdrawableAmount)}</p>
        </Card>
      </motion.div>

      {/* Détails du wallet */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Détails du wallet</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Capital investi</span>
                <span className="font-medium">{formatCurrency(wallet?.invested_capital || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Montant bloqué</span>
                <span className="font-medium text-red-500">{formatCurrency(wallet?.locked_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8A8A8A]">Montant disponible</span>
                <span className="font-medium text-green-500">{formatCurrency(withdrawableAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Menu */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => router.push(item.href)}
            className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#161616] rounded-2xl border border-gray-100 dark:border-gray-800 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-[#8A8A8A]" />
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8A8A8A]" />
          </button>
        ))}
      </motion.div>

      {/* Thème */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardContent className="p-4">
            <button onClick={toggleTheme} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-purple-500" />
                )}
                <span className="text-sm font-medium">Mode {theme === "dark" ? "clair" : "sombre"}</span>
              </div>
              <div className={`w-12 h-6 rounded-full p-0.5 transition-colors ${theme === "dark" ? "bg-purple-600" : "bg-gray-200"}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${theme === "dark" ? "translate-x-6" : ""}`} />
              </div>
            </button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Déconnexion */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button variant="destructive" className="w-full" size="lg" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </motion.div>
    </div>
  );
}