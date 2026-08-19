/**
 * Génère la page de secours Capacitor (dist/index.html).
 * Usage : node scripts/generate-dist.mjs
 * Cette page est chargée par la WebView native pendant que l'URL distante
 * (wrapper.config.mjs → APP_URL) est rejointe, ou en cas d'offline.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "dist", "index.html");
mkdirSync(dirname(target), { recursive: true });
const appName = process.env.WRAPPER_APP_NAME || "Rewardly";

const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${appName}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: linear-gradient(160deg, #7c3aed 0%, #9d3fe7 45%, #6d28d9 100%);
        color: #fff;
        display: flex; align-items: center; justify-content: center; text-align: center;
        padding: 24px;
      }
      .wrap { max-width: 360px; }
      .logo {
        width: 96px; height: 96px; margin: 0 auto 20px; border-radius: 24px;
        background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        font-size: 48px; font-weight: 800; border: 1px solid rgba(255, 255, 255, 0.25);
      }
      h1 { font-size: 26px; margin-bottom: 8px; }
      p { font-size: 14px; opacity: 0.85; line-height: 1.5; }
      .spin {
        width: 28px; height: 28px; margin: 18px auto 0; border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff;
        animation: spin 0.9s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .err { display: none; margin-top: 18px; font-size: 13px; opacity: 0.9; }
      body.offline .spin { display: none; }
      body.offline .err { display: block; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="logo">R</div>
      <h1>${appName}</h1>
      <p>Connexion à la plateforme…</p>
      <div class="spin"></div>
      <div class="err">Connexion impossible. Vérifiez votre connexion Internet puis réessayez.</div>
    </div>
    <script>
      // Si aucune connexion : afficher le message offline.
      window.addEventListener("offline", function () {
        if (navigator.onLine === false) document.body.classList.add("offline");
      });
      if (navigator.onLine === false) document.body.classList.add("offline");
    </script>
  </body>
</html>
`;

writeFileSync(target, html, "utf8");
console.log("✔ dist/index.html généré (page de secours Capacitor)");
if (existsSync(join(root, "dist", "index.html"))) {
  console.log(`  → ${join(root, "dist", "index.html")}`);
}