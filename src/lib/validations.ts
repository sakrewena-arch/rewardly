import { z } from "zod";

// ============================================================
// AUTH VALIDATIONS
// ============================================================

export const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, "Le nom complet doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email invalide"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// ============================================================
// FINANCIAL VALIDATIONS
// ============================================================

export const withdrawalSchema = z.object({
  amount: z.number().min(5000, "Le montant minimum de retrait est de 5 000 FCFA"),
  method: z.string().min(1, "Veuillez choisir une méthode de retrait"),
  accountInfo: z.string().min(3, "Veuillez entrer vos informations de compte"),
});

// ============================================================
// TASK VALIDATIONS
// ============================================================

export const createTaskSchema = z.object({
  title: z.string().min(3, "Le titre doit contenir au moins 3 caractères"),
  description: z.string().optional(),
  amount: z.number().positive("La récompense doit être positive"),
  amount_label: z.string().optional(),
  plan_id: z.string().nullable(),
  category_id: z.string().optional(),
  icon: z.string().optional(),
  estimated_time: z.number().optional(),
  instructions: z.string().optional(),
  link: z.string().url("Lien invalide").optional().or(z.literal("")),
  max_completions: z.number().optional(),
  duration_minutes: z.number().optional(),
  deadline: z.string().optional(),
  validation_type: z.enum(["auto", "manual"]),
  fields: z.array(z.object({
    title: z.string().min(1, "Le titre du champ est requis"),
    description: z.string().optional(),
    field_type: z.enum(["text", "number", "email", "url", "image", "screenshot", "video", "file", "telegram", "whatsapp"]),
    is_required: z.boolean().default(true),
    placeholder: z.string().optional(),
    max_size: z.number().optional(),
    sort_order: z.number().optional(),
  })).optional(),
});

export const submitTaskSchema = z.object({
  taskId: z.string().uuid("Tâche invalide"),
  answers: z.record(z.string(), z.string()),
});

// ============================================================
// SETTINGS VALIDATIONS
// ============================================================

export const systemSettingsSchema = z.object({
  platform_name: z.string().min(1),
  min_withdrawal: z.string().regex(/^\d+$/, "Nombre requis"),
  referral_commission_fixed: z.string().regex(/^\d+$/, "Nombre requis"),
  referral_commission_percent: z.string().regex(/^\d+$/, "Nombre requis"),
  max_referrals: z.string().regex(/^\d+$/, "Nombre requis"),
  maintenance_mode: z.enum(["true", "false"]),
});

// ============================================================
// PROFILE VALIDATIONS
// ============================================================

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/, "Username invalide").optional(),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, "Numéro de téléphone invalide").optional(),
  avatarUrl: z.string().url().optional(),
});

// ============================================================
// TYPE EXPORTS
// ============================================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;