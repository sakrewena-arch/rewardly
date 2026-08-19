// ============================================================
// GÉNÉRATION DES ASSETS NATIFS (icônes + splashes) pour Capacitor & Electron
// Source : public/images/logo.png
// Sortie : assets/  (icônes Capacitor) + desktop/build/icon.png (Electron)
// ============================================================
import sharp from "sharp";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SRC_LOGO = path.join(root, "public", "images", "logo.png");
const OUT_ASSETS = path.join(root, "assets");
const OUT_DESKTOP = path.join(root, "desktop", "build");

const PURPLE = { r: 157, g: 63, b: 231, alpha: 1 };
const DARK = { r: 9, g: 9, b: 9, alpha: 1 };

const write = (dir, name, buf) => writeFile(path.join(dir, name), buf);
const solid = (size, color) =>
  sharp({ create: { width: size, height: size, channels: 4, background: color } });

async function splashImage(size, bg) {
  // Fond uni (violet clair ou sombre) + logo centré
  const base = sharp({ create: { width: size, height: size, channels: 4, background: bg } });
  const logo = await sharp(SRC_LOGO)
    .resize(Math.round(size * 0.5), Math.round(size * 0.5), { fit: "contain" })
    .png()
    .toBuffer();
  return base
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
}

async function main() {
  await Promise.all([mkdir(OUT_ASSETS, { recursive: true }), mkdir(OUT_DESKTOP, { recursive: true })]);

  const meta = await sharp(SRC_LOGO).metadata();
  console.log(`Logo source : ${meta.width}x${meta.height}`);

  // ---- ICÔNES Capacitor ----
  // 1. Icone "only" (logo seul) et "foreground" (couche avant adaptive) → 1024px transparent
  const iconOnly = await sharp(SRC_LOGO)
    .resize(1024, 1024, { fit: "contain" })
    .png()
    .toBuffer();
  await write(OUT_ASSETS, "icon-only.png", iconOnly);
  await write(OUT_ASSETS, "icon-foreground.png", iconOnly);
  await write(OUT_ASSETS, "icon-dark.png", iconOnly);

  // 2. Fonds adaptatifs (couleur unie)
  await write(OUT_ASSETS, "icon-background.png", await solid(1024, PURPLE).png().toBuffer());
  await write(OUT_ASSETS, "icon-background-dark.png", await solid(1024, DARK).png().toBuffer());

  // 3. Splashs (fond plein + logo centré)
  await write(OUT_ASSETS, "splash.png", await splashImage(2732, PURPLE));
  await write(OUT_ASSETS, "splash-dark.png", await splashImage(2732, DARK));

  // ---- ICÔNE Electron (desktop/build/icon.png) ----
  // Carré 512px : fond violet + logo centré
  const logoDesktop = await sharp(SRC_LOGO)
    .resize(460, 460, { fit: "contain" })
    .png()
    .toBuffer();
  const desktopIcon = await solid(512, PURPLE)
    .composite([{ input: logoDesktop, gravity: "center" }])
    .png()
    .toBuffer();
  await write(OUT_DESKTOP, "icon.png", desktopIcon);

  console.log("✅ Assets générés :");
  console.log(" - sous assets/ (icônes + splash Capacitor)");
  console.log(" - desktop/build/icon.png (icône Electron)");
}

main().catch((err) => {
  console.error("❌ Erreur génération assets :", err);
  process.exit(1);
});