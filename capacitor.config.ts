import type { CapacitorConfig } from "@capacitor/cli";
import { APP_ID, APP_NAME, APP_URL, WEB_DIR } from "./wrapper.config.mjs";

// Défaut robuste : si APP_URL est un placeholder ou vide, on retombe sur le
// domaine de production réel. Évite une WebView chargée avec une URL invalide.
const RESOLVED_URL =
  !APP_URL || APP_URL.startsWith("https://placeholder") || APP_URL.startsWith("http://localhost")
    ? "https://rewardly.website"
    : APP_URL;

// Tous les domaines que la WebView doit garder EN INTERNE.
// Important après un CHANGEMENT DE NOM DE DOMAINE : l'ancien domaine
// (Vercel) et le nouveau (rewardly.website) sont tous deux considérés
// comme "internes" à l'app → aucune délégation à Chrome.
const APP_HOSTS = (() => {
  const hosts = new Set<string>();
  for (const url of [RESOLVED_URL, APP_URL, "https://rewardly.website", "https://rewardlyfree.vercel.app"]) {
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      /* URL invalide : ignorée */
    }
  }
  return [...hosts];
})();

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: WEB_DIR,
  server: {
    url: RESOLVED_URL,
    androidScheme: "https",
    // La WebView gère elle-même toute navigation sur ces domaines au lieu
    // de la déléguer au navigateur système (empêche l'ouverture de Chrome).
    allowNavigation: APP_HOSTS,
    cleartext: process.env.WRAPPER_ALLOW_HTTP === "true",
  },
  android: {
    allowMixedContent: process.env.WRAPPER_ALLOW_HTTP === "true",
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;