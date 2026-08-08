"use client";

import { AuthRequired } from "./AuthRequired";
import { Wallet, TrendingUp, User, Crown, ArrowUpRight, Bell, Share2, Settings, Shield, BarChart3, Clock, Megaphone } from "lucide-react";

// Pages protégées avec leur message personnalisé
export function DepositAuth() {
  return (
    <AuthRequired
      title="Dépôt"
      description="Pour plus de sécurité et éviter de perdre vos fonds, créez un compte ou connectez-vous avant de faire un dépôt."
      icon={<Wallet className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function WithdrawAuth() {
  return (
    <AuthRequired
      title="Retrait"
      description="Pour retirer vos gains en toute sécurité, créez un compte ou connectez-vous. Vos fonds sont protégés."
      icon={<ArrowUpRight className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function InvestAuth() {
  return (
    <AuthRequired
      title="Investissement"
      description="Pour activer un pack et commencer à gagner, créez un compte ou connectez-vous. Choisissez votre pack et débloquez vos tâches."
      icon={<Crown className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function HistoryAuth() {
  return (
    <AuthRequired
      title="Historique"
      description="Pour consulter l'historique de vos tâches et transactions, créez un compte ou connectez-vous."
      icon={<Clock className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function AnalyticsAuth() {
  return (
    <AuthRequired
      title="Analytics"
      description="Pour voir vos statistiques détaillées et suivre vos gains, créez un compte ou connectez-vous."
      icon={<BarChart3 className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function ProfileAuth() {
  return (
    <AuthRequired
      title="Profil"
      description="Pour gérer votre profil et vos informations personnelles, créez un compte ou connectez-vous."
      icon={<User className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function NotificationsAuth() {
  return (
    <AuthRequired
      title="Notifications"
      description="Pour recevoir vos notifications et rester informé, créez un compte ou connectez-vous."
      icon={<Bell className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function ReferralAuth() {
  return (
    <AuthRequired
      title="Parrainage"
      description="Pour inviter vos amis et gagner des commissions, créez un compte ou connectez-vous."
      icon={<Share2 className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function SettingsAuth() {
  return (
    <AuthRequired
      title="Paramètres"
      description="Pour personnaliser vos préférences, créez un compte ou connectez-vous."
      icon={<Settings className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function SecurityAuth() {
  return (
    <AuthRequired
      title="Sécurité"
      description="Pour sécuriser votre compte et changer votre mot de passe, créez un compte ou connectez-vous."
      icon={<Shield className="w-10 h-10 text-purple-600" />}
    />
  );
}

export function ServicesAuth() {
  return (
    <AuthRequired
      title="Nos services"
      description="Pour promouvoir votre entreprise et lancer vos campagnes publicitaires, créez un compte ou connectez-vous."
      icon={<Megaphone className="w-10 h-10 text-purple-600" />}
    />
  );
}
