import { describe, it, expect } from "vitest";
import { computeWithdrawableAmount } from "../utils";

// ============================================================
// LOGIQUE FINANCIÈRE — MONTANT RETIRABLE
// Règle : seuls les GAINS (total_earnings) sont retirables.
// Le montant retirable = gains bruts - retraits en attente - services,
// jamais négatif.
// ============================================================
describe("computeWithdrawableAmount", () => {
  it("retourne les gains bruts quand rien n'est à déduire", () => {
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 5000,
        pendingWithdrawals: 0,
        servicePayments: 0,
      })
    ).toBe(5000);
  });

  it("déduit les retraits en attente", () => {
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 5000,
        pendingWithdrawals: 2000,
        servicePayments: 0,
      })
    ).toBe(3000);
  });

  it("déduit les paiements de services", () => {
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 5000,
        pendingWithdrawals: 0,
        servicePayments: 1500,
      })
    ).toBe(3500);
  });

  it("n'est jamais négatif", () => {
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 1000,
        pendingWithdrawals: 2000,
        servicePayments: 500,
      })
    ).toBe(0);
  });

  it("gère les valeurs manquantes ou NaN en tant que 0", () => {
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: NaN,
        pendingWithdrawals: undefined as unknown as number,
        servicePayments: 100,
      })
    ).toBe(0);
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 1000,
        pendingWithdrawals: 300,
        servicePayments: undefined as unknown as number,
      })
    ).toBe(700);
  });

  it("les dépôts ne sont PAS retirables tant qu'il n'y a pas de gains", () => {
    // Un utilisateur ayant déposé 10000 mais aucun gain ne peut retirer 0.
    expect(
      computeWithdrawableAmount({
        rawWithdrawable: 0,
        pendingWithdrawals: 0,
        servicePayments: 0,
      })
    ).toBe(0);
  });
});