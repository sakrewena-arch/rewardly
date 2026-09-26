import type { Metadata } from "next";
import AfficheClient from "./AfficheClient";

export const metadata: Metadata = {
  title: "Affiche publicitaire — Rewardly | Tâches rémunérées & Mobile Money",
  description:
    "Affiche publicitaire officielle Rewardly : gagnez de l'argent en accomplissant des tâches simples. Paiement Mobile Money dans 8 pays.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Rewardly — Gagnez de l'argent avec des tâches simples",
    description:
      "Disponible dans 8 pays. Retrait Mobile Money dès 5 000 FCFA. Parrainage : 10 % des investissements.",
    images: ["/images/logo.png"],
    type: "website",
  },
};

export default function AffichePage() {
  return <AfficheClient />;
}
