// ============================================================
// SOURCE DE VÉRITÉ POUR LES WRAPPERS (Capacitor + Electron)
// ============================================================
// ⚠️ 1 SEUL ENDROIT À MODIFIER : remplacez APP_URL par l'URL HTTPS
//    publique de votre application Next.js DÉPLOYÉE (Vercel).
//    Les APK / exe / dmg chargent cette URL — le site doit être en ligne.
//
//    Vous pouvez aussi passer la variable d'environnement WRAPPER_APP_URL
//    au moment du build :  $env:WRAPPER_APP_URL="https://rewardlyfree.vercel.app"
// ============================================================

export const APP_NAME = "Rewardly";
export const APP_ID = "com.rewardly.app";
export const APP_URL = process.env.WRAPPER_APP_URL || "https://rewardly.website";

// Dossier de sortie web pour Capacitor (fallback local de chargement/offline)
export const WEB_DIR = "dist";