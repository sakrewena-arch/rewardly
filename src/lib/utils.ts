import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "XOF"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date, format: "short" | "long" | "relative" = "short"): string {
  const d = new Date(date);
  if (format === "relative") {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return "Hier";
    if (days < 7) return `Il y a ${days} jours`;
    if (days < 30) return `Il y a ${Math.floor(days / 7)} semaines`;
    return `Il y a ${Math.floor(days / 30)} mois`;
  }
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: format === "long" ? "long" : "short",
    year: "numeric",
  }).format(d);
}

export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function maskCardNumber(number: string): string {
  const cleaned = number.replace(/\s/g, "");
  const last4 = cleaned.slice(-4);
  return `**** **** **** ${last4}`;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "text-yellow-500 bg-yellow-500/10",
    approved: "text-green-500 bg-green-500/10",
    rejected: "text-red-500 bg-red-500/10",
    completed: "text-green-500 bg-green-500/10",
    active: "text-purple-500 bg-purple-500/10",
    inactive: "text-gray-500 bg-gray-500/10",
    suspended: "text-orange-500 bg-orange-500/10",
    banned: "text-red-500 bg-red-500/10",
    paid: "text-blue-500 bg-blue-500/10",
  };
  return colors[status] || "text-gray-500 bg-gray-500/10";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
    completed: "Terminé",
    active: "Actif",
    inactive: "Inactif",
    suspended: "Suspendu",
    banned: "Banni",
    processing: "En cours",
    paid: "Payé",
  };
  return labels[status] || status;
}