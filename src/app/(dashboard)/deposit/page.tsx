"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, AlertCircle, Wallet, MapPin, Loader2, Phone, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AuthRequired } from "@/components/features/AuthRequired";
import { detectCountry, getDetectedCountry, getCountryConfig, setManualCountry, FEEXPAY_COUNTRIES, type CountryConfig, type PaymentMethod } from "@/lib/geo";

const presetAmounts = [5000, 10000, 20000, 50000];

export default function DepositPage() {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [amount, setAmount] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countryConfig, setCountryConfig] = useState<CountryConfig | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [reference, setReference] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<any>(null);

  // Détecter le pays de l'utilisateur (avec persistance)
  useEffect(() => {
    const detect = async () => {
      setDetecting(true);
      const country = await getDetectedCountry();
      setDetectedCountry(country);
      const config = getCountryConfig(country?.countryCode);
      setCountryConfig(config);
      setDetecting(false);
    };
    detect();
  }, []);

  // Changer de pays manuellement
  const handleChangeCountry = (code: string) => {
    const info = setManualCountry(code);
    if (info) {
      setDetectedCountry(info);
      setCountryConfig(getCountryConfig(code));
      setShowCountryPicker(false);
      setSelectedMethod(null);
    }
  };

  // Poller le statut du dépôt
  useEffect(() => {
    if (!polling || !reference) return;
    let attempts = 0;
    const maxAttempts = 10; // 10 * 3s = 30s max
    let cancelled = false;

    const checkStatus = async () => {
      attempts++;
      try {
        const response = await fetch(`/api/feexpay/deposit-status?reference=${reference}`, {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        const data = await response.json();
        // Afficher le statut en temps réel
        if (data.status === "SUCCESSFUL") {
          setPolling(false);
          setStep(4);
          cancelled = true;
          return;
        } else if (data.status === "FAILED") {
          setPolling(false);
          const reason = data.reason || data.responsemsg || data.message || "";
          // Traduire les raisons connues
          if (reason.includes("LOW_BALANCE") || reason.toLowerCase().includes("balance")) {
            setError("Solde insuffisant sur votre compte. Veuillez recharger votre compte opérateur et réessayer.");
          } else {
            setError(`Le paiement a échoué : ${reason || "Veuillez réessayer."}`);
          }
          setStep(1);
          cancelled = true;
          return;
        }
      } catch (e) {
        // Continuer le polling
      }
      // Arrêter après maxAttempts
      if (attempts >= maxAttempts && !cancelled) {
        setPolling(false);
        setError("Le paiement n'a pas été confirmé. Vérifiez votre téléphone ou réessayez.");
        setStep(1);
        cancelled = true;
      }
    };

    // Vérification immédiate + intervalle
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => {
      clearInterval(interval);
      cancelled = true;
    };
  }, [polling, reference, accessToken]);

  // Si non connecté, afficher le message d'authentification
  if (!user) {
    return (
      <AuthRequired
        title="Dépôt"
        description="Pour plus de sécurité et éviter de perdre vos fonds, créez un compte ou connectez-vous avant de faire un dépôt."
        icon={<Wallet className="w-10 h-10 text-purple-600" />}
      />
    );
  }

  const paymentMethods = countryConfig?.paymentMethods || [];
  const currencySymbol = countryConfig?.currencySymbol || "FCFA";
  const phoneCode = countryConfig?.phoneCode || "+225";

  // Initier le dépôt FeeXPay
  const handleInitiateDeposit = async () => {
    if (!selectedMethod || !phoneNumber || !amount) return;
    setError(null);
    // Validation : montant minimum de 5000 FCFA
    if (Number(amount) < 5000) {
      setError("Le montant minimum de dépôt est de 5 000 FCFA.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/feexpay/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          network: selectedMethod.code,
          phoneNumber: `${phoneCode.replace("+", "")}${phoneNumber.replace(/\D/g, "")}`,
          amount: Number(amount),
          userId: user.id,
          description: `Dépôt Rewardly ${amount} ${currencySymbol}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erreur lors du dépôt");
      setReference(data.reference);
      setStep(3);
      // Commencer le polling du statut
      setPolling(true);
    } catch (err: any) {
      setError(err.message || "Erreur lors du dépôt");
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
          <h1 className="text-xl font-bold">Dépôt</h1>
          <p className="text-[#8A8A8A] text-sm">Ajouter des fonds à votre compte</p>
        </div>
      </div>

      {/* Bannière pays détecté + bouton changer */}
      {detecting ? (
        <div className="flex items-center gap-2 text-sm text-[#8A8A8A] bg-gray-50 dark:bg-white/5 p-3 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin" />
          Détection de votre pays...
        </div>
      ) : countryConfig && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm bg-purple-50 dark:bg-purple-500/10 p-3 rounded-xl border border-purple-200 dark:border-purple-500/20">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-500" />
              <span className="text-purple-700 dark:text-purple-300">
                Pays : <strong>{countryConfig.flag} {countryConfig.name}</strong> — {currencySymbol}
              </span>
            </div>
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showCountryPicker ? "rotate-180" : ""}`} />
              Changer
            </button>
          </div>

          {/* Sélecteur de pays */}
          {showCountryPicker && (
            <div className="bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-sm font-medium">Choisissez votre pays</p>
                <p className="text-xs text-[#8A8A8A] mt-0.5">Si la détection est incorrecte ou si vous utilisez un VPN</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {Object.values(FEEXPAY_COUNTRIES).map((country) => (
                  <button
                    key={country.code}
                    onClick={() => handleChangeCountry(country.code)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                      countryConfig.code === country.code ? "bg-purple-50 dark:bg-purple-500/10" : ""
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{country.name}</p>
                      <p className="text-xs text-[#8A8A8A]">{country.phoneCode} • {country.currencySymbol}</p>
                    </div>
                    {countryConfig.code === country.code && (
                      <Check className="w-4 h-4 text-purple-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4">Montant</h2>
              <div className="relative mb-4">
                <Input
                  type="number"
                  placeholder="5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-2xl font-bold h-14 text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8A8A8A] font-medium">{currencySymbol}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {presetAmounts.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAmount(preset.toString())}
                    className={`p-3 rounded-xl text-sm font-medium border transition-all ${
                      amount === preset.toString()
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-600"
                        : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
                    }`}
                  >
                    {formatCurrency(preset)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4">Choisissez votre opérateur</h2>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-[#8A8A8A] text-center py-4">
                  Aucun moyen de paiement disponible pour votre pays.
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${selectedMethod.color}`}>
                    <img src={selectedMethod.logo} alt={selectedMethod.name} className="w-8 h-8 object-contain" />
                  </div>
                  <div>
                    <h2 className="font-semibold">{selectedMethod.name}</h2>
                    <p className="text-xs text-[#8A8A8A]">
                      Dépôt de {formatCurrency(Number(amount))} {currencySymbol}
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
                  Vous recevrez une demande de paiement sur ce numéro.
                </p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!phoneNumber || phoneNumber.length < 8 || submitting}
                onClick={handleInitiateDeposit}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Initiation du paiement...</>
                ) : (
                  <><Phone className="w-4 h-4 mr-2" /> Payer {formatCurrency(Number(amount))} {currencySymbol}</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ÉTAPE 3 : En attente de confirmation */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
          </div>
          <h2 className="text-xl font-bold mb-2">En attente de paiement</h2>
          <p className="text-[#8A8A8A] text-sm mb-4">
            Une demande de paiement a été envoyée à votre numéro.<br />
            Confirmez le paiement sur votre téléphone.
          </p>
          <p className="text-sm font-medium text-purple-500">
            {formatCurrency(Number(amount))} {currencySymbol} via {selectedMethod?.name}
          </p>
        </motion.div>
      )}

      {/* ÉTAPE 4 : Succès */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Dépôt confirmé !</h2>
          <p className="text-[#8A8A8A] text-sm mb-6">
            Votre compte a été crédité de {formatCurrency(Number(amount))} {currencySymbol} automatiquement.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="w-full">
            Retour à l'accueil
          </Button>
        </motion.div>
      )}
    </div>
  );
}