import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerSchema,
  depositSchema,
  withdrawalSchema,
  createTaskSchema,
  createPlanSchema,
  systemSettingsSchema,
} from "../validations";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      fullName: "Jean Dupont",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short full name", () => {
    const result = registerSchema.safeParse({
      fullName: "J",
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });
});

describe("depositSchema", () => {
  it("accepts valid deposit", () => {
    const result = depositSchema.safeParse({
      amount: 5000,
      method: "orange",
    });
    expect(result.success).toBe(true);
  });

  it("rejects amount below minimum", () => {
    const result = depositSchema.safeParse({
      amount: 50,
      method: "orange",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing method", () => {
    const result = depositSchema.safeParse({
      amount: 5000,
    });
    expect(result.success).toBe(false);
  });
});

describe("withdrawalSchema", () => {
  it("accepts valid withdrawal", () => {
    const result = withdrawalSchema.safeParse({
      amount: 10000,
      method: "orange",
      accountInfo: "+2250102030405",
    });
    expect(result.success).toBe(true);
  });

  it("rejects amount below minimum", () => {
    const result = withdrawalSchema.safeParse({
      amount: 1000,
      method: "orange",
      accountInfo: "+2250102030405",
    });
    expect(result.success).toBe(false);
  });
});

describe("createTaskSchema", () => {
  it("accepts valid task", () => {
    const result = createTaskSchema.safeParse({
      title: "Rejoindre le canal Telegram",
      amount: 500,
      plan_id: null,
      validation_type: "auto",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short title", () => {
    const result = createTaskSchema.safeParse({
      title: "Ab",
      amount: 500,
      plan_id: null,
      validation_type: "auto",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = createTaskSchema.safeParse({
      title: "Tâche valide",
      amount: -100,
      plan_id: null,
      validation_type: "auto",
    });
    expect(result.success).toBe(false);
  });
});

describe("createPlanSchema", () => {
  it("accepts valid plan", () => {
    const result = createPlanSchema.safeParse({
      name: "Bronze",
      slug: "bronze",
      price: 5000,
      daily_tasks: 1,
      min_profitability: 10,
      max_profitability: 20,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid slug", () => {
    const result = createPlanSchema.safeParse({
      name: "Bronze",
      slug: "Bronze!",
      price: 5000,
      daily_tasks: 1,
      min_profitability: 10,
      max_profitability: 20,
    });
    expect(result.success).toBe(false);
  });
});

describe("systemSettingsSchema", () => {
  it("accepts valid settings", () => {
    const result = systemSettingsSchema.safeParse({
      platform_name: "Rewardly",
      min_withdrawal: "5000",
      withdrawal_day: "5",
      investment_duration_days: "7",
      referral_commission_fixed: "500",
      referral_commission_percent: "5",
      max_referrals: "50",
      maintenance_mode: "false",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid withdrawal day", () => {
    const result = systemSettingsSchema.safeParse({
      platform_name: "Rewardly",
      min_withdrawal: "5000",
      withdrawal_day: "9",
      investment_duration_days: "7",
      referral_commission_fixed: "500",
      referral_commission_percent: "5",
      max_referrals: "50",
      maintenance_mode: "false",
    });
    expect(result.success).toBe(false);
  });
});