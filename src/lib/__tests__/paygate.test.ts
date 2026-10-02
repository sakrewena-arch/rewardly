import { describe, it, expect } from "vitest";
import {
  PAY_REQUEST_STATUS,
  PAYMENT_STATUS_LABELS,
  mapPaymentStatus,
  paymentStatusLabel,
  normalizeNetwork,
  normalizePhoneNumber,
  parseCallbackPayload,
} from "../paygate";

describe("paygate — réseaux PayGateGlobal (FLOOZ / TMONEY)", () => {
  it("accepte directement les codes PayGate", () => {
    expect(normalizeNetwork("FLOOZ")).toBe("FLOOZ");
    expect(normalizeNetwork("TMONEY")).toBe("TMONEY");
  });

  it("traduit les codes opérateurs de l'app vers PayGate", () => {
    expect(normalizeNetwork("MOOV TG")).toBe("FLOOZ");
    expect(normalizeNetwork("TOGOCOM TG")).toBe("TMONEY");
    expect(normalizeNetwork("Mixx by Yas")).toBe("TMONEY");
    expect(normalizeNetwork("yas")).toBe("TMONEY");
  });

  it("tolère la casse et les séparateurs", () => {
    expect(normalizeNetwork("t-money")).toBe("TMONEY");
    expect(normalizeNetwork("  tmoney ")).toBe("TMONEY");
    expect(normalizeNetwork("moov_togo")).toBe("FLOOZ");
  });

  it("rejette les réseaux non supportés par PayGate", () => {
    expect(normalizeNetwork("MTN")).toBeNull();
    expect(normalizeNetwork("WAVE CI")).toBeNull();
    expect(normalizeNetwork("")).toBeNull();
    expect(normalizeNetwork(null)).toBeNull();
    expect(normalizeNetwork(undefined)).toBeNull();
  });
});

describe("paygate — statuts de paiement", () => {
  it("0 = réussi, 2 = en cours, 4/6 = échec", () => {
    expect(mapPaymentStatus(0)).toBe("SUCCESSFUL");
    expect(mapPaymentStatus(2)).toBe("PENDING");
    expect(mapPaymentStatus(4)).toBe("FAILED"); // expiré
    expect(mapPaymentStatus(6)).toBe("FAILED"); // annulé
  });

  it("accepte les codes sous forme de chaîne", () => {
    expect(mapPaymentStatus("0")).toBe("SUCCESSFUL");
    expect(mapPaymentStatus("2")).toBe("PENDING");
  });

  it("ne crédite jamais un code inconnu (FAILED par défaut)", () => {
    expect(mapPaymentStatus(7)).toBe("FAILED");
    expect(mapPaymentStatus(undefined)).toBe("FAILED");
    expect(mapPaymentStatus(null)).toBe("FAILED");
  });

  it("expose des libellés lisibles", () => {
    expect(paymentStatusLabel(0)).toBe("Paiement réussi");
    expect(paymentStatusLabel(4)).toBe("Paiement expiré");
    expect(paymentStatusLabel(99)).toContain("inconnu");
  });
});

describe("paygate — numéros de téléphone", () => {
  it("retire les caractères non numériques", () => {
    expect(normalizePhoneNumber("+228 90 12 34 56")).toBe("22890123456");
    expect(normalizePhoneNumber("228-90123456")).toBe("22890123456");
    expect(normalizePhoneNumber(null)).toBe("");
  });
});

describe("paygate — codes d'état de la demande de paiement", () => {
  it("documente les 4 codes de /api/v1/pay", () => {
    expect(PAY_REQUEST_STATUS[0]).toContain("succès");
    expect(PAY_REQUEST_STATUS[2]).toContain("Jeton");
    expect(PAY_REQUEST_STATUS[4]).toContain("Paramètres");
    expect(PAY_REQUEST_STATUS[6]).toContain("Doublon");
    expect(PAYMENT_STATUS_LABELS[6]).toBe("Paiement annulé");
  });
});

describe("paygate — callback de confirmation", () => {
  it("accepte un payload complet", () => {
    const parsed = parseCallbackPayload({
      tx_reference: "PG-123",
      identifier: "DEP-abc",
      amount: 20000,
    });
    expect(parsed?.identifier).toBe("DEP-abc");
    expect(parsed?.tx_reference).toBe("PG-123");
  });

  it("accepte un payload ne contenant que la référence PayGate", () => {
    expect(parseCallbackPayload({ tx_reference: "PG-9" })).not.toBeNull();
  });

  it("rejette les payloads sans référence", () => {
    expect(parseCallbackPayload({ amount: 20000 })).toBeNull();
    expect(parseCallbackPayload({ identifier: "   " })).toBeNull();
    expect(parseCallbackPayload(null)).toBeNull();
    expect(parseCallbackPayload("texte")).toBeNull();
  });
});