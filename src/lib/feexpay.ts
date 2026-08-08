"use server";

// ============================================================
// SERVICE FEEXPAY - Intégration API v2
// Documentation : https://docs.feexpay.me/
// ============================================================

const FEEXPAY_API_URL = "https://api-v2.feexpay.me";
const FEEXPAY_API_KEY = process.env.FEEXPAY_API_KEY;
const FEEXPAY_SHOP_ID = process.env.FEEXPAY_SHOP_ID;

// ============================================================
// TYPES
// ============================================================
export interface PayinRequest {
  network: string; // Code réseau ex: "MTN", "MOOV", "ORANGE", "WAVE", "CELTIIS BJ", "CORIS"
  phoneNumber: string; // Numéro avec indicatif ex: "2250700000000"
  amount: number;
  firstName?: string;
  lastName?: string;
  description?: string;
  callbackInfo?: string;
}

export interface PayinResponse {
  reference: string;
  message: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  amount: number;
  description?: string;
  callback_info?: string;
  phoneNumber?: string;
  payment_url?: string;
  responsemsg?: string;
  transref?: string;
  statusCode?: number;
}

export interface PayoutRequest {
  network: string;
  phoneNumber: string;
  amount: number;
  motif: string;
  callbackInfo?: string;
  email?: string;
}

export interface PayoutResponse {
  reference: string;
  status: string;
  message: string;
  description?: string;
  phone_number?: string;
  amount: number;
  callback_info?: string;
}

export interface TransactionStatus {
  reference: string;
  amount: number;
  phoneNumber?: string;
  status: "PENDING" | "SUCCESSFUL" | "FAILED";
  callback_info?: string;
  responsecode?: string;
  responsemsg?: string;
  transref?: string;
  reason?: string;
  description?: string;
  date?: string;
  serviceref?: string;
  operator_id?: string;
}

// ============================================================
// AUTH HEADERS
// ============================================================
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (FEEXPAY_API_KEY) {
    headers["Authorization"] = `Bearer ${FEEXPAY_API_KEY}`;
  }
  return headers;
}

// ============================================================
// PAYIN - Initier un dépôt
// ============================================================
export async function initiatePayin(input: PayinRequest): Promise<PayinResponse> {
  if (!FEEXPAY_API_KEY || !FEEXPAY_SHOP_ID) {
    throw new Error("FEEXPAY_API_KEY et FEEXPAY_SHOP_ID doivent être configurés");
  }

  const endpoint = getPayinEndpoint(input.network);
  const response = await fetch(`${FEEXPAY_API_URL}/api/transactions/public/requesttopay/${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      shop: FEEXPAY_SHOP_ID,
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      first_name: input.firstName,
      last_name: input.lastName,
      description: input.description,
      callback_info: input.callbackInfo,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || "Erreur FeexPay");
  }

  return response.json();
}

// ============================================================
// PAYIN STATUS - Vérifier le statut d'un dépôt
// ============================================================
export async function checkPayinStatus(reference: string): Promise<TransactionStatus> {
  const response = await fetch(
    `${FEEXPAY_API_URL}/api/transactions/public/single/status/${reference}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || "Erreur FeexPay");
  }

  return response.json();
}

// ============================================================
// PAYOUT - Initier un retrait
// ============================================================
export async function initiatePayout(input: PayoutRequest): Promise<PayoutResponse> {
  if (!FEEXPAY_API_KEY || !FEEXPAY_SHOP_ID) {
    throw new Error("FEEXPAY_API_KEY et FEEXPAY_SHOP_ID doivent être configurés");
  }

  const endpoint = getPayoutEndpoint(input.network);
  const response = await fetch(`${FEEXPAY_API_URL}/api/payouts/public/${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      shop: FEEXPAY_SHOP_ID,
      phoneNumber: input.phoneNumber,
      amount: input.amount,
      network: getPayoutNetwork(input.network),
      motif: input.motif,
      email: input.email,
      callback_info: input.callbackInfo,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || "Erreur FeexPay");
  }

  return response.json();
}

// ============================================================
// PAYOUT STATUS - Vérifier le statut d'un retrait
// ============================================================
export async function checkPayoutStatus(reference: string): Promise<TransactionStatus> {
  const response = await fetch(
    `${FEEXPAY_API_URL}/api/payouts/status/public/${reference}`,
    { headers: getHeaders() }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(error.message || "Erreur FeexPay");
  }

  return response.json();
}

// ============================================================
// BALANCE DU SHOP
// ============================================================
export async function getShopBalance() {
  const response = await fetch(
    `${FEEXPAY_API_URL}/api/balance/public/getByShop/${FEEXPAY_SHOP_ID}`,
    { headers: getHeaders() }
  );
  if (!response.ok) throw new Error("Erreur FeexPay balance");
  return response.json();
}

// ============================================================
// ENDPOINTS PAR PAYS/OPÉRATEUR
// ============================================================

// Mapping des endpoints de paiement (payin) par réseau
const payinEndpoints: Record<string, string> = {
  // BÉNIN
  "MTN": "mtn",
  "MTN BENIN": "mtn",
  "MOOV": "moov",
  "MOOV BENIN": "moov",
  "CELTIIS BJ": "celtiis_bj",
  "CORIS": "coris",
  "CORIS BENIN": "coris",
  // TOGO
  "TOGOCOM TG": "togocom_tg",
  "MOOV TG": "moov_tg",
  // CÔTE D'IVOIRE
  "MTN CI": "mtn_ci",
  "MTN COTE D'IVOIRE": "mtn_ci",
  "MOOV CI": "moov_ci",
  "MOOV COTE D'IVOIRE": "moov_ci",
  "WAVE CI": "wave_ci",
  "WAVE COTE D'IVOIRE": "wave_ci",
  "ORANGE CI": "orange_ci",
  "ORANGE COTE D'IVOIRE": "orange_ci",
  // CONGO BRAZZAVILLE
  "MTN CG": "mtn_cg",
  "MTN CONGO": "mtn_cg",
  // SÉNÉGAL
  "ORANGE SN": "orange_sn",
  "ORANGE SENEGAL": "orange_sn",
  "WAVE SN": "wave_sn",
  "WAVE SENEGAL": "wave_sn",
  "FREE SN": "free_sn",
  "FREE SENEGAL": "free_sn",
  // BURKINA FASO
  "MOOV BF": "moov_bf",
  "MOOV BURKINA": "moov_bf",
  "ORANGE BF": "orange_bf",
  "ORANGE BURKINA": "orange_bf",
  "WAVE BF": "wave_bf",
  "WAVE BURKINA": "wave_bf",
  // MALI
  "ORANGE ML": "orange_ml",
  "ORANGE MALI": "orange_ml",
  "MOBICASH ML": "mobicash_ml",
  "MOBICASH MALI": "mobicash_ml",
};

// Mapping des endpoints de retrait (payout) par réseau
const payoutEndpoints: Record<string, string> = {
  // BÉNIN (global MTN/MOOV + CELTIIS)
  "MTN": "global",
  "MTN BENIN": "global",
  "MOOV": "global",
  "MOOV BENIN": "global",
  "CELTIIS BJ": "celtiis_bj",
  // CÔTE D'IVOIRE
  "MTN CI": "mtn_ci",
  "MTN COTE D'IVOIRE": "mtn_ci",
  "ORANGE CI": "orange_ci",
  "ORANGE COTE D'IVOIRE": "orange_ci",
  "MOOV CI": "moov_ci",
  "MOOV COTE D'IVOIRE": "moov_ci",
  "WAVE CI": "wave_ci",
  "WAVE COTE D'IVOIRE": "wave_ci",
  // TOGO (global)
  "TOGOCOM TG": "togo",
  "MOOV TG": "togo",
  // SÉNÉGAL
  "ORANGE SN": "orange_sn",
  "ORANGE SENEGAL": "orange_sn",
  "FREE SN": "free_sn",
  "FREE SENEGAL": "free_sn",
  "WAVE SN": "wave_sn",
  "WAVE SENEGAL": "wave_sn",
  // CONGO
  "MTN CG": "mtn_cg",
  "MTN CONGO": "mtn_cg",
  // BURKINA FASO
  "MOOV BF": "moov_bf",
  "MOOV BURKINA": "moov_bf",
  "ORANGE BF": "orange_bf",
  "ORANGE BURKINA": "orange_bf",
  "WAVE BF": "wave_bf",
  "WAVE BURKINA": "wave_bf",
  // MALI
  "ORANGE ML": "orange_ml",
  "ORANGE MALI": "orange_ml",
  "MOBICASH ML": "mobicash_ml",
  "MOBICASH MALI": "mobicash_ml",
};

// Pour les payout globaux (Benin, Togo), on passe le réseau dans le body
const payoutNetworkNames: Record<string, string | undefined> = {
  "MTN": "MTN",
  "MTN BENIN": "MTN",
  "MOOV": "MOOV",
  "MOOV BENIN": "MOOV",
  "TOGOCOM TG": "TOGOCOM TG",
  "MOOV TG": "MOOV TG",
};

function getPayinEndpoint(network: string): string {
  const normalized = network.toUpperCase().trim();
  const endpoint = payinEndpoints[normalized];
  if (endpoint) return endpoint;

  // Fallback: extraire le code principal
  const baseCode = normalized.split(" ")[0];
  return payinEndpoints[baseCode] || "mtn";
}

function getPayoutEndpoint(network: string): string {
  const normalized = network.toUpperCase().trim();
  const endpoint = payoutEndpoints[normalized];
  if (endpoint) return endpoint;

  // Fallback
  const baseCode = normalized.split(" ")[0];
  return payoutEndpoints[baseCode] || "global";
}

function getPayoutNetwork(network: string): string | undefined {
  const normalized = network.toUpperCase().trim();
  return payoutNetworkNames[normalized];
}