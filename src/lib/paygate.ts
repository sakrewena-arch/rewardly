// ============================================================
// SERVICE PAYGATEGLOBAL — Intégration API v1 / v2
// Documentation : guide d'intégration PayGateGlobal (FLOOZ, TMONEY)
//
// ⚠️ MODULE SERVEUR UNIQUEMENT : il lit PAYGATE_AUTH_TOKEN (secret).
//    Ne jamais l'importer depuis un composant "use client".
//
// Flux dépôt :
//   1. POST /api/v1/pay          → enregistre la transaction (push USSD)
//   2. POST /api/v2/status       → état par `identifier` (le nôtre)
//      POST /api/v1/status       → état par `tx_reference` (PayGate)
//   3. Callback HTTP POST        → confirmation poussée par PayGate
//
// ⚠️ PayGateGlobal n'expose AUCUN endpoint de payout (reversement) :
//    les retraits sont donc payés MANUELLEMENT par l'admin depuis le
//    tableau de bord PayGate. Voir validateWithdrawalAction().
// ============================================================

const PAYGATE_BASE_URL = "https://paygateglobal.com";

/** Réseaux Mobile Money acceptés par PayGateGlobal. */
export type PayGateNetwork = "FLOOZ" | "TMONEY";

/** Statut normalisé, aligné sur le vocabulaire historique de l'application. */
export type PayGateStatus = "PENDING" | "SUCCESSFUL" | "FAILED";

// ============================================================
// CODES D'ÉTAT
// ============================================================

/** Réponse de POST /api/v1/pay (enregistrement de la demande de paiement). */
export const PAY_REQUEST_STATUS: Record<number, string> = {
  0: "Transaction enregistrée avec succès",
  2: "Jeton d'authentification invalide",
  4: "Paramètres invalides",
  6: "Doublon détecté : un paiement avec cet identifiant existe déjà",
};

/** Réponse de /api/v1/status, /api/v2/status et du callback. */
export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  0: "Paiement réussi",
  2: "Paiement en cours",
  4: "Paiement expiré",
  6: "Paiement annulé",
};

/**
 * Convertit le code d'état PayGate en statut applicatif.
 *   0 → SUCCESSFUL · 2 → PENDING · 4/6 → FAILED
 * Tout code inconnu est traité comme FAILED (jamais crédité par erreur).
 */
export function mapPaymentStatus(code: number | string | null | undefined): PayGateStatus {
  // ⚠️ Une valeur absente/vide ne doit JAMAIS être interprétée comme un succès
  // (Number(null) vaut 0, ce qui créditerait un dépôt à tort).
  if (code === null || code === undefined || code === "") return "FAILED";
  const n = Number(code);
  if (!Number.isFinite(n)) return "FAILED";
  if (n === 0) return "SUCCESSFUL";
  if (n === 2) return "PENDING";
  return "FAILED";
}

/** Libellé lisible d'un code d'état de paiement. */
export function paymentStatusLabel(code: number | string | null | undefined): string {
  if (code === null || code === undefined || code === "") return "État inconnu (?)";
  const n = Number(code);
  return PAYMENT_STATUS_LABELS[n] || `État inconnu (${code})`;
}

// ============================================================
// RÉSEAUX
// ============================================================

/**
 * Alias → réseau PayGate. Les clés sont normalisées (majuscules, espaces).
 * Codes internes de l'app (geo.ts) → FLOOZ / TMONEY.
 */
const NETWORK_ALIASES: Record<string, PayGateNetwork> = {
  FLOOZ: "FLOOZ",
  "MOOV TG": "FLOOZ",
  "MOOV TOGO": "FLOOZ",
  MOOV: "FLOOZ",
  TMONEY: "TMONEY",
  "T MONEY": "TMONEY",
  TOGOCOM: "TMONEY",
  "TOGOCOM TG": "TMONEY",
  YAS: "TMONEY",
  "MIXX BY YAS": "TMONEY",
  MIXX: "TMONEY",
};

/** Normalise une valeur quelconque ("MOOV TG", "t-money", "Flooz"…) en réseau PayGate. */
export function normalizeNetwork(network: string | null | undefined): PayGateNetwork | null {
  const key = String(network ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  if (!key) return null;
  return NETWORK_ALIASES[key] || null;
}

/** Retire tout caractère non numérique (PayGate attend un numéro sans "+"). */
export function normalizePhoneNumber(phoneNumber: string | null | undefined): string {
  return String(phoneNumber ?? "").replace(/\D/g, "");
}

// ============================================================
// CONFIGURATION
// ============================================================

function getAuthToken(): string {
  const token = process.env.PAYGATE_AUTH_TOKEN;
  if (!token) {
    throw new Error("PAYGATE_AUTH_TOKEN n'est pas configuré (voir .env.example)");
  }
  return token;
}

// ============================================================
// APPEL HTTP BAS NIVEAU
// ============================================================
async function payGateRequest(path: string, payload: Record<string, unknown>): Promise<any> {
  const response = await fetch(`${PAYGATE_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auth_token: getAuthToken(), ...payload }),
    cache: "no-store",
  });

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok && (!data || data.status === undefined)) {
    throw new Error(
      `PayGateGlobal ${path} → HTTP ${response.status}${raw ? ` : ${raw.slice(0, 200)}` : ""}`
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error(`PayGateGlobal ${path} → réponse invalide`);
  }
  return data;
}

// ============================================================
// PAYIN — Demander un paiement (Méthode 1 : API)
// ============================================================
export interface PayinRequest {
  /** Code réseau interne ("TMONEY", "MOOV TG"…) ou déjà PayGate ("FLOOZ"). */
  network: string;
  /** Numéro complet avec indicatif, sans "+" (ex. "22890123456"). */
  phoneNumber: string;
  amount: number;
  /** Identifiant interne UNIQUE de la transaction (notre `deposits.reference`). */
  identifier: string;
  description?: string;
}

export interface PayinResponse {
  /** true si PayGate a enregistré la demande (code 0) — le paiement reste à confirmer. */
  success: boolean;
  txReference: string | null;
  statusCode: number;
  status: PayGateStatus;
  message: string;
}

export async function initiatePayin(input: PayinRequest): Promise<PayinResponse> {
  const network = normalizeNetwork(input.network);
  if (!network) {
    throw new Error(
      `Réseau non supporté par PayGateGlobal : « ${input.network} » (attendu : FLOOZ ou TMONEY)`
    );
  }
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  if (phoneNumber.length < 8) {
    throw new Error("Numéro de téléphone invalide");
  }
  const amount = Math.round(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Montant invalide");
  }

  const data = await payGateRequest("/api/v1/pay", {
    phone_number: phoneNumber,
    amount,
    description: input.description || `Depot Rewardly ${amount}`,
    identifier: input.identifier,
    network,
  });

  const statusCode = Number(data.status);
  return {
    success: statusCode === 0,
    txReference: data.tx_reference ?? null,
    statusCode,
    // Code 0 = demande envoyée au client : le paiement n'est pas encore confirmé.
    status: statusCode === 0 ? "PENDING" : "FAILED",
    message: PAY_REQUEST_STATUS[statusCode] || `Code d'état inconnu (${data.status ?? "?"})`,
  };
}

// ============================================================
// CONSULTER L'ÉTAT D'UN PAIEMENT
// ============================================================
export interface PayinStatus {
  statusCode: number;
  status: PayGateStatus;
  /** Référence unique générée par PayGateGlobal. */
  txReference: string | null;
  /** Référence interne renvoyée par PayGate (notre `identifier`). */
  identifier: string | null;
  /** Code de référence opérateur (Flooz/T-Money) — utile en cas de réclamation. */
  paymentReference: string | null;
  paymentMethod: string | null;
  datetime: string | null;
  message?: string;
  reason?: string;
}

function toPayinStatus(identifier: string, data: any): PayinStatus {
  const statusCode = Number(data.status);
  const status = mapPaymentStatus(statusCode);
  return {
    statusCode,
    status,
    txReference: data.tx_reference ?? null,
    identifier: data.identifier ?? identifier,
    paymentReference: data.payment_reference ?? null,
    paymentMethod: data.payment_method ?? null,
    datetime: data.datetime ?? null,
    message: paymentStatusLabel(statusCode),
    ...(status === "FAILED" ? { reason: paymentStatusLabel(statusCode) } : {}),
  };
}

/** Méthode alternative : état par l'identifiant interne de l'e-commerce (recommandée). */
export async function checkPayinStatus(identifier: string): Promise<PayinStatus> {
  if (!identifier) throw new Error("Identifiant de transaction manquant");
  const data = await payGateRequest("/api/v2/status", { identifier });
  return toPayinStatus(identifier, data);
}

/** État par la référence unique générée par PayGateGlobal (`tx_reference`). */
export async function checkPayinStatusByReference(txReference: string): Promise<PayinStatus> {
  if (!txReference) throw new Error("Référence de transaction manquante");
  const data = await payGateRequest("/api/v1/status", { tx_reference: txReference });
  return toPayinStatus("", data);
}

// ============================================================
// CONFIRMATION DE PAIEMENT (callback PayGate → notre webhook)
// ============================================================
export interface PayGateCallbackPayload {
  tx_reference?: string;
  identifier?: string;
  payment_reference?: string;
  amount?: number | string;
  datetime?: string;
  payment_method?: string;
  phone_number?: string;
}

/**
 * Valide grossièrement la charge utile du callback.
 * Retourne null si aucune référence exploitable n'est présente.
 */
export function parseCallbackPayload(body: any): PayGateCallbackPayload | null {
  if (!body || typeof body !== "object") return null;
  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  const txReference = typeof body.tx_reference === "string" ? body.tx_reference.trim() : "";
  if (!identifier && !txReference) return null;
  return body as PayGateCallbackPayload;
}

/** Indique si la clé API PayGateGlobal est présente. */
export function isPayGateConfigured(): boolean {
  return Boolean(process.env.PAYGATE_AUTH_TOKEN);
}