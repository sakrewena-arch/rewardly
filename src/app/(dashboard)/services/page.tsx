"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Megaphone, Wallet, Check, AlertCircle, Building2, Mail, Phone, FileText, Users, Clock, Crown, Star, Sparkles, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { createClient } from "@/lib/supabase/client";
import { ServicesAuth } from "@/components/features/AuthRequiredPages";

const serviceTypes = [
  { value: "sondage", label: "Sondage", icon: "📊" },
  { value: "visite", label: "Visite de site", icon: "🌐" },
  { value: "test_jeu", label: "Test de jeu", icon: "🎮" },
  { value: "test_app", label: "Test d'application", icon: "📱" },
  { value: "test_site", label: "Test de site web", icon: "💻" },
  { value: "test_ia", label: "Test d'IA", icon: "🤖" },
  { value: "autre", label: "Autre", icon: "✨" },
];

const packs = [
  {
    id: "500k",
    name: "Pack Starter",
    price: 500000,
    duration: "30 jours",
    users: "5 000 utilisateurs",
    color: "from-amber-500 to-amber-600",
    badge: "Bronze",
    icon: Star,
    features: ["1 type de publicité", "30 jours de campagne", "5 000 utilisateurs ciblés", "Rapport de performance"],
  },
  {
    id: "1m",
    name: "Pack Pro",
    price: 1000000,
    duration: "60 jours",
    users: "15 000 utilisateurs",
    color: "from-purple-500 to-purple-600",
    badge: "Populaire",
    icon: Crown,
    features: ["2 types de publicité", "60 jours de campagne", "15 000 utilisateurs ciblés", "Rapport détaillé", "Support prioritaire"],
  },
  {
    id: "2m",
    name: "Pack Premium",
    price: 2000000,
    duration: "Illimité",
    users: "Illimité",
    color: "from-yellow-500 to-yellow-600",
    badge: "Premium",
    icon: Sparkles,
    features: ["Tous les types de publicité", "Durée illimitée", "Utilisateurs illimités", "Rapport en temps réel", "Support dédié 24/7", "Mission prioritaire"],
  },
];

export default function ServicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { wallet, refreshWallet } = useWallet();
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [serviceType, setServiceType] = useState("sondage");
  const [description, setDescription] = useState("");
  const [selectedPack, setSelectedPack] = useState("500k");
  const [duration, setDuration] = useState("30j");
  const [targetUsers, setTargetUsers] = useState("5000");
  const [url, setUrl] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [questions, setQuestions] = useState("");
  const [iaUrl, setIaUrl] = useState("");
  const [appName, setAppName] = useState("");
  const [gameName, setGameName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  // Charger les commandes de l'utilisateur
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const loadOrders = async () => {
      const { data } = await supabase
        .from("service_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setOrders(data || []);
    };
    loadOrders();
  }, [user]);

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <ServicesAuth />;
  }

  const selectedPackData = packs.find((p) => p.id === selectedPack)!;

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!companyName.trim() || !contactEmail.trim() || !contactPhone.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase non configuré");
      setSubmitting(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("create_service_order", {
      p_company_name: companyName.trim(),
      p_contact_email: contactEmail.trim(),
      p_contact_phone: contactPhone.trim(),
      p_service_type: serviceType,
      p_description: description.trim() || null,
      p_pack: selectedPack,
      p_pack_amount: selectedPackData.price,
      p_duration: duration,
      p_target_users: parseInt(targetUsers, 10) || null,
      p_url: url.trim() || null,
      p_download_url: downloadUrl.trim() || null,
      p_questions: questions.trim() || null,
      p_ia_url: iaUrl.trim() || null,
      p_app_name: appName.trim() || null,
      p_game_name: gameName.trim() || null,
      p_site_name: siteName.trim() || null,
      p_instructions: instructions.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSubmitting(false);
      return;
    }

    if (data?.success) {
      setSuccess(`Commande envoyée ! Votre wallet a été débité de ${formatCurrency(selectedPackData.price)}. Nous vous contacterons bientôt.`);
      setCompanyName("");
      setContactEmail("");
      setContactPhone("");
      setDescription("");
      setUrl("");
      setDownloadUrl("");
      setQuestions("");
      setIaUrl("");
      setAppName("");
      setGameName("");
      setSiteName("");
      setInstructions("");
      refreshWallet();
      // Recharger les commandes
      const { data: ordersData } = await supabase
        .from("service_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setOrders(ordersData || []);
    } else {
      setError(data?.error || "Erreur lors de la commande");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6 overflow-guard">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Nos services</h1>
          <p className="text-[#8A8A8A] text-sm">Promouvez votre entreprise</p>
        </div>
      </div>

      {/* Wallet */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="card-gradient rounded-2xl p-5 text-white flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs">Votre solde</p>
            <p className="text-2xl font-bold">{formatCurrency(wallet?.balance || 0)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-white/80" />
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white" onClick={() => router.push("/deposit")}>
              Recharger
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Packs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h2 className="text-lg font-semibold mb-3">Choisissez votre pack</h2>
        <div className="space-y-3">
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => {
                setSelectedPack(pack.id);
                setDuration(pack.id === "2m" ? "illimite" : pack.id === "1m" ? "60j" : "30j");
                setTargetUsers(pack.id === "2m" ? "99999" : pack.id === "1m" ? "15000" : "5000");
              }}
              className={`w-full text-left rounded-2xl border-2 transition-all ${selectedPack === pack.id ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}
            >
              <div className={`h-2 rounded-t-2xl bg-gradient-to-r ${pack.color}`} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <pack.icon className="w-5 h-5 text-purple-500" />
                    <h3 className="font-semibold">{pack.name}</h3>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${pack.id === "2m" ? "bg-yellow-100 text-yellow-700" : pack.id === "1m" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                    {pack.badge}
                  </span>
                </div>
                <p className="text-2xl font-bold mb-2">{formatCurrency(pack.price)}</p>
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-[#8A8A8A] flex items-center gap-1"><Clock className="w-3 h-3" /> {pack.duration}</p>
                  <p className="text-xs text-[#8A8A8A] flex items-center gap-1"><Users className="w-3 h-3" /> {pack.users}</p>
                </div>
                <div className="space-y-1">
                  {pack.features.map((feature) => (
                    <p key={feature} className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {feature}
                    </p>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Formulaire */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Megaphone className="w-4 h-4" /> Décrivez votre besoin</h2>

            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de l'entreprise / du particulier</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <Input placeholder="Ex: Ma Société SARL" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email de contact</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <Input type="email" placeholder="contact@entreprise.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Numéro de téléphone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                <Input placeholder="+225 numero de telephone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Type de publicité</label>
              <div className="grid grid-cols-2 gap-2">
                {serviceTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setServiceType(type.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${serviceType === type.value ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10" : "border-gray-200 dark:border-gray-700"}`}
                  >
                    <span className="text-xl">{type.icon}</span>
                    <p className="text-xs font-medium mt-1">{type.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Champs dynamiques selon le type de publicité */}
            {serviceType === "visite" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">URL du site à visiter</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input placeholder="https://mon-site.com" value={url} onChange={(e) => setUrl(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs visiteront ce site et devront y rester quelques minutes.</p>
              </div>
            )}

            {serviceType === "test_jeu" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom du jeu</label>
                <Input placeholder="Ex: Mon Super Jeu" value={gameName} onChange={(e) => setGameName(e.target.value)} />
                <label className="text-sm font-medium">URL de téléchargement du jeu</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input placeholder="https://play.google.com/... ou https://mon-jeu.com" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs téléchargeront et testeront votre jeu.</p>
              </div>
            )}

            {serviceType === "test_app" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom de l'application</label>
                <Input placeholder="Ex: Mon App" value={appName} onChange={(e) => setAppName(e.target.value)} />
                <label className="text-sm font-medium">URL de téléchargement de l'application</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input placeholder="https://play.google.com/... ou https://apps.apple.com/..." value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs téléchargeront et testeront votre application.</p>
              </div>
            )}

            {serviceType === "test_site" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom du site web</label>
                <Input placeholder="Ex: Mon Site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                <label className="text-sm font-medium">URL du site à tester</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input placeholder="https://mon-site.com" value={url} onChange={(e) => setUrl(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs testeront la navigation et les fonctionnalités de votre site.</p>
              </div>
            )}

            {serviceType === "test_ia" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom de l'IA</label>
                <Input placeholder="Ex: Mon Assistant IA" value={appName} onChange={(e) => setAppName(e.target.value)} />
                <label className="text-sm font-medium">URL de l'IA à tester</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8A8A]" />
                  <Input placeholder="https://mon-ia.com" value={iaUrl} onChange={(e) => setIaUrl(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs testeront votre IA et donneront leur avis.</p>
              </div>
            )}

            {serviceType === "sondage" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Questions du sondage</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-[#8A8A8A]" />
                  <textarea
                    className="w-full min-h-[100px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent pl-10 pr-3 py-2 text-sm"
                    placeholder={"1. Quelle est votre opinion sur...\n2. Avez-vous déjà utilisé...\n3. Recommanderiez-vous..."}
                    value={questions}
                    onChange={(e) => setQuestions(e.target.value)}
                  />
                </div>
                <p className="text-xs text-[#8A8A8A]">Les utilisateurs répondront à ces questions.</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Description du projet</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-[#8A8A8A]" />
                <textarea
                  className="w-full min-h-[80px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent pl-10 pr-3 py-2 text-sm"
                  placeholder="Décrivez ce que vous voulez promouvoir (site web, application, jeu, IA...)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Instructions pour les utilisateurs</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-[#8A8A8A]" />
                <textarea
                  className="w-full min-h-[60px] rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent pl-10 pr-3 py-2 text-sm"
                  placeholder="Instructions précises : s'inscrire, tester, donner un avis, partager..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#8A8A8A]">Durée</label>
                <select
                  className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="30j">30 jours</option>
                  <option value="60j">60 jours</option>
                  <option value="90j">90 jours</option>
                  <option value="illimite">Illimité</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#8A8A8A]">Utilisateurs visés</label>
                <Input type="number" placeholder="5000" value={targetUsers} onChange={(e) => setTargetUsers(e.target.value)} />
              </div>
            </div>

            {error && (
              <p className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </p>
            )}
            {success && (
              <p className="flex items-center gap-2 text-sm text-green-500 bg-green-50 dark:bg-green-500/10 p-3 rounded-xl">
                <Check className="w-4 h-4 flex-shrink-0" /> {success}
              </p>
            )}

            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Traitement..." : `Payer ${formatCurrency(selectedPackData.price)} avec mon wallet`}
            </Button>
            <p className="text-xs text-[#8A8A8A] text-center">
              Le montant sera débité de votre wallet. Nous vous contacterons pour lancer votre campagne.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Historique des commandes */}
      {orders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold mb-3">Mes commandes</h3>
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                    <div>
                      <p className="text-sm font-medium">{order.company_name}</p>
                      <p className="text-xs text-[#8A8A8A]">{order.service_type} • {order.pack}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${order.status === "pending" ? "bg-yellow-100 text-yellow-700" : order.status === "approved" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {order.status === "pending" ? "En attente" : order.status === "approved" ? "Approuvée" : "Refusée"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}