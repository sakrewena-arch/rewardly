import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, generateReferralCode, maskCardNumber, getStatusColor, getStatusLabel } from "../utils";

describe("formatCurrency", () => {
  it("formats XOF currency", () => {
    expect(formatCurrency(5000)).toContain("5");
    expect(formatCurrency(5000)).toContain("000");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0");
  });
});

describe("formatDate", () => {
  it("formats short date", () => {
    const date = new Date("2024-01-15");
    expect(formatDate(date)).toContain("2024");
  });

  it("formats relative date for today", () => {
    const today = new Date();
    expect(formatDate(today, "relative")).toBe("Aujourd'hui");
  });

  it("formats relative date for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDate(yesterday, "relative")).toBe("Hier");
  });
});

describe("generateReferralCode", () => {
  it("generates 8-character code", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it("generates unique codes", () => {
    const code1 = generateReferralCode();
    const code2 = generateReferralCode();
    expect(code1).not.toBe(code2);
  });
});

describe("maskCardNumber", () => {
  it("masks card number", () => {
    expect(maskCardNumber("1234 5678 9012 3456")).toBe("**** **** **** 3456");
  });
});

describe("getStatusColor", () => {
  it("returns color for pending", () => {
    expect(getStatusColor("pending")).toContain("yellow");
  });

  it("returns color for approved", () => {
    expect(getStatusColor("approved")).toContain("green");
  });

  it("returns default color for unknown status", () => {
    expect(getStatusColor("unknown")).toContain("gray");
  });
});

describe("getStatusLabel", () => {
  it("returns French label for pending", () => {
    expect(getStatusLabel("pending")).toBe("En attente");
  });

  it("returns French label for approved", () => {
    expect(getStatusLabel("approved")).toBe("Approuvé");
  });

  it("returns original for unknown status", () => {
    expect(getStatusLabel("unknown")).toBe("unknown");
  });
});