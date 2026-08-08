"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Info, AlertCircle, MapPin, Loader2, Phone, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useRouter } from "next/navigation";
import { getSystemSettingsFromDB } from "@/actions/settings-actions";
import { useAuth } from "@/context/AuthContext";
import { WithdrawAuth } from "@/components/features/AuthRequiredPages";
import { detectCountry, getCountryConfig, type CountryConfig, type PaymentMethod } from "@/lib/geo";

export default function WithdrawPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const { wallet, isLoading, withdrawableAmount } = useWallet();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [minWithdrawal, setMinWithdrawal] = useState(5000);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countryConfig, setCountryConfig] = useState<CountryConfig | null>(null);
  const [detecting, setDetecting] = useState(true);

  // Détecter le pays de l'utilisateur
  useEffect(() => {
    const detect = async () => {
      setDetecting(true);
      const country = await detectCountry();
      const config = getCountryConfig(country?.countryCode);
      setCountryConfig(config);
      setDetecting(false);
    };
    detect();
  }, []);

  // Récupérer le montant minimum de retrait
  useEffect(() => {
    getSystemSettingsFromDB().then((settings) => {
      if (settings?.min_withdrawal) {
        const min = Number(String(settings.min_withdrawal).replace(/"/g, ""));
        if (!isNaN(min)) setMinWithdrawal(min);
      }
    });
  }, []);

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return <WithdrawAuth />;
  }

  const paymentMethods = countryConfig?.paymentMethods || [];
  const currencySymbol = countryConfig?.currencySymbol || "FCFA";
  const phoneCode = countryConfig?.phoneCode || "+225";

  // Initier le retrait FeeXPay
  const handleInitiateWithdrawal = async () => {
    if (!selectedMethod || !phoneNumber || !amount) return;
    const numAmount = Number(amount);
    if (numAmount < minWithdrawal) {
      setError(`Le montant minimum de retrait est de ${formatCurrency(minWithdrawal)} ${currencySymbol}`);
      return;
    }
    if (numAmount > withdrawableAmount) {
      setError("Montant insuffisant. Vous ne pouvez retirer que " + formatCurrency(withdrawableAmount) + " " + currencySymbol);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/feexpay/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          network: selectedMethod.code,
          phoneNumber: `${phoneCode.replace("+", "")}${phoneNumber.replace(/\D/g, "")}`,
          amount: numAmount,
          userId: user.id,
          motif: `Retrait Rewardly ${numAmount} ${currencySymbol}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors du retrait");
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Erreur lors du retrait");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white dark:bg-[#161616] flex items-center justify-center shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Retrait</h1>
          <p className="text-[#8A8A8A] text-sm">Retirez vos gains</p>
        </div>
      </div>

      {/* Bannière pays détecté */}
      {detecting ? (
        <div className="flex items-center gap-2 text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin" />
          Détection de votre pays...
        </div>
      ) : countryConfig && (
        <div className="flex items-center gap-2 text-sm bg-purple-50 dark:bg-purple-500/10 p-3 rounded-xl border border-purple-200 dark:border-purple-500/20">
          <MapPin className="w-4 h-4 text-purple-500" />
          <span className="text-purple-700 dark:text-purple-300">
            Pays détecté : <strong>{countryConfig.flag} {countryConfig.name}</strong> — Devise : {currencySymbol}
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-500/10 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ÉTAPE 1 : Montant + Opérateur */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          {/* Info banner */}
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Conditions de retrait</p>
              <ul className="mt-1 space-y-0.5">
                <li>• Retraits disponibles le vendredi uniquement</li>
                <li>• Minimum : {formatCurrency(minWithdrawal)} {currencySymbol}</li>
                <li>• Attendre 7 jours après l'investissement</li>
                <li>• Seuls les gains de tâches sont retirables (pas le capital investi)</li>
                <li>• Délai de traitement : 24-48h</li>
              </ul>
            </div>
          </div>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4">Montant à retirer</h2>
              <div className="relative mb-3">
                <Input
                  type="number"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-2xl font-bold h-14 text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] font-medium">{currencySymbol}</span>
              </div>
              <p className="text-xs text-[#8A8A8A]">
                Montant disponible : <span className="font-medium text-green-500">{formatCurrency(withdrawableAmount)} {currencySymbol}</span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4">Choisissez votre opérateur</h2>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-[#8A8A8A] text-center py-4">
                  Aucun moyen de retrait disponible pour votre pays.
                </p>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((method: PaymentMethod) => (
                    <button
                      key={method.id}
                      onClick={() => {
                        setSelectedMethod(method);
                        setStep(2);
                      }}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                        selectedMethod?.id === method.id
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10"
                          : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${method.color}`}>
                        <img src={method.logo} alt={method.name} className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-medium text-sm block">{method.name}</span>
                        <span className="text-xs text-[#8A8A8A]">
                          Min {method.minAmount} {currencySymbol} • {method.processingTime}
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-[#8A8A8A]" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ÉTAPE 2 : Numéro de téléphone */}
      {step === 2 && selectedMethod && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${selectedMethod.color}`}>
                    {selectedMethod.icon}
                  </div>
                  <div>
                    <h2 className="font-semibold">{selectedMethod.name}</h2>
                    <p className="text-xs text-[#8A8A8A]">
                      Retrait de {formatCurrency(Number(amount))} {currencySymbol}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setStep(1); setSelectedMethod(null); }} className="text-xs text-purple-500">
                  Changer
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Numéro de téléphone</label>
                <div className="flex gap-2">
                  <div className="w-24 flex items-center justify-center bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium">
                    {phoneCode}
                  </div>
                  <Input
                    type="tel"
                    placeholder="numero de telephone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-[#8A8A8A]">
                  Le retrait sera envoyé sur ce numéro après validation.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!phoneNumber || phoneNumber.length < 8 || submitting}
                onClick={handleInitiateWithdrawal}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi de la demande...</>
                ) : (
                  <><Phone className="w-4 h-4 mr-2" /> Demander le retrait</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ÉTAPE 3 : Succès */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Demande envoyée</h2>
          <p className="text-[#8A8A8A] text-sm mb-6">
            Votre demande de retrait de {formatCurrency(Number(amount))} {currencySymbol} a été envoyée.<br />
            Elle sera validée sous 24-48h par un administrateur.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Retour à l'accueil
          </Button>
        </motion.div>
      )}
    </div>
  );
}