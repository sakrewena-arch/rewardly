"use client";

// ============================================================
// DÉTECTION DE PAYS - API gratuite et illimitée
// Utilise ip-api.com (gratuit, sans clé, 45 requêtes/min)
// ============================================================

export interface CountryInfo {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
}

// Réseaux de paiement PayGateGlobal (FLOOZ / TMONEY)
export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon: string; // Motif de couleur
  logo: string; // Chemin du logo officiel
  color: string;
  minAmount: number;
  maxAmount: number;
  processingTime: string;
  type: "momo" | "card";
}

export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  phoneCode: string;
  paymentMethods: PaymentMethod[];
}

// ============================================================
// LOGOS DES OPÉRATEURS
// ============================================================
// Logos officiels : URLs CDN pour les marques internationales,
// SVG locaux avec couleurs de marque pour les opérateurs africains.
const LOGOS = {
  // Marques internationales - vrais logos officiels via CDN
  visa: "https://logo.clearbit.com/visa.com",
  mastercard: "https://logo.clearbit.com/mastercard.com",
  paypal: "https://logo.clearbit.com/paypal.com",
  vodafone: "https://logo.clearbit.com/vodafone.com",
  // Opérateurs africains - logos locaux avec couleurs de marque
  mtn: "/images/payment-methods/mtn.jfif",
  orange: "/images/payment-methods/orange.jfif",
  wave: "/images/payment-methods/wave.jfif",
  moov: "/images/payment-methods/moov.jfif",
  togocom: "/images/payment-methods/yas.jfif",
  free: "/images/payment-methods/free.jfif",
  celtiis: "/images/payment-methods/celtiis.jfif",
  coris: "/images/payment-methods/coris.jfif",
  mobicash: "/images/payment-methods/mobicash.svg",
  mpesa: "/images/payment-methods/mpesa.svg",
  airtel: "/images/payment-methods/airtel.svg",
  ecocash: "/images/payment-methods/ecocash.svg",
  telebirr: "/images/payment-methods/telebirr.svg",
  opay: "/images/payment-methods/opay.svg",
  palmpay: "/images/payment-methods/palmpay.svg",
};

// ============================================================
// CONFIGURATION PAYS / MOYENS DE PAIEMENT — PayGateGlobal
// PayGateGlobal ne prend en charge que le TOGO :
//   • FLOOZ  → Moov Africa Togo
//   • TMONEY → Togocom (Mixx by Yas)
// Les codes opérateurs sont normalisés côté serveur par src/lib/paygate.ts.
// ============================================================
export const PAYGATE_COUNTRIES: Record<string, CountryConfig> = {
  TG: {
    code: "TG",
    name: "Togo",
    flag: "🇹🇬",
    currency: "XOF",
    currencySymbol: "FCFA",
    phoneCode: "+228",
    paymentMethods: [
      { id: "flooz_tg", name: "Flooz (Moov)", code: "FLOOZ", icon: "📱", logo: LOGOS.moov, color: "bg-blue-100 dark:bg-blue-500/20 text-blue-600", minAmount: 5000, maxAmount: 2000000, processingTime: "Instantané", type: "momo" },
      { id: "tmoney_tg", name: "T-Money (Togocom)", code: "TMONEY", icon: "📱", logo: LOGOS.togocom, color: "bg-green-100 dark:bg-green-500/20 text-green-600", minAmount: 5000, maxAmount: 2000000, processingTime: "Instantané", type: "momo" },
    ],
  },
};
// Pays par défaut (PayGateGlobal : seul le Togo est supporté)
export const DEFAULT_COUNTRY: CountryConfig = PAYGATE_COUNTRIES.TG;

// ============================================================
// DÉTECTION DU PAYS - Multi-API + persistance du choix manuel
// ============================================================

// Clé localStorage pour le pays choisi manuellement
const MANUAL_COUNTRY_KEY = "rewardly_manual_country";

// Liste des APIs de détection (dans l'ordre de fiabilité)
const GEO_APIS = [
  {
    url: "https://ipapi.co/json/",
    parse: (data: any): CountryInfo | null => {
      if (data.country_code) {
        return {
          country: data.country_name,
          countryCode: data.country_code,
          region: data.region,
          city: data.city,
          timezone: data.timezone,
          currency: data.currency || data.currency_name || "XOF",
          currencySymbol: getCurrencySymbol(data.currency || data.currency_name || "XOF"),
        };
      }
      return null;
    },
  },
  {
    url: "https://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,currency",
    parse: (data: any): CountryInfo | null => {
      if (data.status === "success") {
        return {
          country: data.country,
          countryCode: data.countryCode,
          region: data.regionName,
          city: data.city,
          timezone: data.timezone,
          currency: data.currency || "XOF",
          currencySymbol: getCurrencySymbol(data.currency || "XOF"),
        };
      }
      return null;
    },
  },
  {
    url: "https://ipwho.is/",
    parse: (data: any): CountryInfo | null => {
      if (data.success) {
        return {
          country: data.country,
          countryCode: data.country_code,
          region: data.region,
          city: data.city,
          timezone: data.timezone?.id,
          currency: data.currency?.code || "XOF",
          currencySymbol: getCurrencySymbol(data.currency?.code || "XOF"),
        };
      }
      return null;
    },
  },
];

// Détecter le pays via les APIs
export async function detectCountry(): Promise<CountryInfo | null> {
  for (const api of GEO_APIS) {
    try {
      const response = await fetch(api.url);
      if (response.ok) {
        const data = await response.json();
        const result = api.parse(data);
        if (result) return result;
      }
    } catch (e) {}
  }
  return null;
}

// Obtenir le pays détecté (ou le choix manuel si défini)
export async function getDetectedCountry(): Promise<CountryInfo | null> {
  // 1. Vérifier si l'utilisateur a choisi un pays manuellement
  if (typeof window !== "undefined") {
    const manual = localStorage.getItem(MANUAL_COUNTRY_KEY);
    if (manual) {
      try {
        const parsed = JSON.parse(manual);
        if (parsed.countryCode) return parsed as CountryInfo;
      } catch (e) {}
    }
  }

  // 2. Sinon, détecter automatiquement
  const detected = await detectCountry();
  if (detected) {
    // Sauvegarder la détection pour éviter de re-détecter à chaque fois
    if (typeof window !== "undefined") {
      localStorage.setItem(MANUAL_COUNTRY_KEY, JSON.stringify(detected));
    }
  }
  return detected;
}

// Changer de pays manuellement
export function setManualCountry(countryCode: string): CountryInfo | null {
  const config = PAYGATE_COUNTRIES[countryCode.toUpperCase()];
  if (!config) return null;

  const info: CountryInfo = {
    country: config.name,
    countryCode: config.code,
    region: "",
    city: "",
    timezone: "",
    currency: config.currency,
    currencySymbol: config.currencySymbol,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(MANUAL_COUNTRY_KEY, JSON.stringify(info));
  }
  return info;
}

// Réinitialiser la détection automatique
export function resetManualCountry() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(MANUAL_COUNTRY_KEY);
  }
}

// Obtenir le symbole de la devise
export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    XOF: "FCFA",
    XAF: "FCFA",
    USD: "$",
    EUR: "€",
  };
  return symbols[currencyCode] || currencyCode;
}

// Obtenir la configuration du pays (PayGateGlobal = Togo uniquement)
export function getCountryConfig(countryCode: string | null | undefined): CountryConfig {
  if (!countryCode) return DEFAULT_COUNTRY;
  return PAYGATE_COUNTRIES[countryCode.toUpperCase()] || DEFAULT_COUNTRY;
}