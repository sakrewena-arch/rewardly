import type { CapacitorConfig } from "@capacitor/cli";
import { APP_ID, APP_NAME, APP_URL, WEB_DIR } from "./wrapper.config.mjs";

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: WEB_DIR,
  server: {
    // L'app Next.js (SSR / Server Actions / Route Handlers) est hébergée en ligne :
    // la WebView native charge l'URL distante définie dans wrapper.config.mjs.
    url: APP_URL,
    // Mode test local : autorise http://localhost / LAN uniquement si WRAPPER_ALLOW_HTTP=true
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