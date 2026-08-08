"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Share2, Users, Gift, Check, Link2, MessageCircle, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { ReferralAuth } from "@/components/features/AuthRequiredPages";

export default function ReferralPage() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !user) return;

    const fetchReferrals = async () => {
      if (!user) return;
      const { data: refData } = await supabase
        .from("referrals")
        .select("id, referred_id, commission, status, created_at")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (refData && refData.length > 0) {
        const referredIds = refData.map((r) => r.referred_id);
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, username")
          .in("user_id", referredIds);

        const merged = refData.map((ref) => {
          const profile = (profilesData || []).find((p) => p.user_id === ref.referred_id);
          return {
            ...ref,
            referred: {
              full_name: profile?.full_name || null,
              username: profile?.username || null,
            },
          };
        });
        setReferrals(merged);
        const total = merged.reduce((sum, r) => sum + (r.commission || 0), 0);
        setTotalCommission(total);
      } else {
        setReferrals([]);
        setTotalCommission(0);
      }
    };

    fetchReferrals();
  }, [user]);

  const referralCode = profile?.referral_code || "";
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?ref=${referralCode}`;

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <ReferralAuth />;
  }

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Rejoignez-moi sur Rewardly et gagnez de l'argent en accomplissant des tâches simples ! ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const shareViaTelegram = () => {
    const text = encodeURIComponent(`Rejoignez-moi sur Rewardly et gagnez de l'argent en accomplissant des tâches simples !`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, "_blank");
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Parrainage</h1>
          <p className="text-[#8A8A8A] text-sm">Invitez vos amis et gagnez</p>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-gradient rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Programme de parrainage</h2>
              <p className="text-white/70 text-sm">Gagnez des commissions sur vos filleuls</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-white/60 text-xs">Filleuls</p>
              <p className="text-2xl font-bold">{referrals.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
              <p className="text-white/60 text-xs">Commissions</p>
              <p className="text-2xl font-bold">{formatCurrency(totalCommission)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold">Votre code de parrainage</h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-center">
                <span className="text-2xl font-bold tracking-widest text-purple-600">{referralCode || "—"}</span>
              </div>
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-[#8A8A8A]">Votre lien de parrainage</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-gray-50 dark:bg-white/5 rounded-xl text-xs text-[#8A8A8A] truncate">
                  {referralLink}
                </div>
                <Button variant="outline" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold">Code QR de parrainage</h3>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(referralLink)}`}
                  alt="QR Code de parrainage"
                  className="w-48 h-48"
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(referralLink)}`;
                  link.download = `rewardly-parrainage-${referralCode}.png`;
                  link.target = "_blank";
                  link.click();
                }}
              >
                <Share2 className="w-4 h-4 mr-2" /> Télécharger le QR Code
              </Button>
              <p className="text-xs text-[#8A8A8A] text-center">
                Scannez ce QR code pour partager votre lien de parrainage
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card>
          <CardContent className="p-5 space-y-3">
            <h3 className="font-semibold">Partager</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-green-500 hover:bg-green-600" onClick={shareViaWhatsApp}>
                <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
              </Button>
              <Button className="bg-blue-500 hover:bg-blue-600" onClick={shareViaTelegram}>
                <Send className="w-4 h-4 mr-2" /> Telegram
              </Button>
            </div>
            <Button variant="outline" className="w-full" onClick={copyLink}>
              <Share2 className="w-4 h-4 mr-2" /> Copier le lien
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Mes filleuls</h3>
            {referrals.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-[#8A8A8A]">Aucun filleul pour le moment</p>
                <p className="text-xs text-[#8A8A8A] mt-1">Partagez votre lien pour commencer à gagner</p>
              </div>
            ) : (
              <div className="space-y-3">
                {referrals.map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 font-bold text-xs">
                        {(ref.referred?.full_name || ref.referred?.username || "U").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{ref.referred?.full_name || ref.referred?.username || "Utilisateur"}</p>
                        <p className="text-xs text-[#8A8A8A]">{ref.status === "paid" ? "Commission payée" : "En attente"}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${ref.status === "paid" ? "text-green-500" : "text-yellow-500"}`}>
                      +{formatCurrency(ref.commission)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}