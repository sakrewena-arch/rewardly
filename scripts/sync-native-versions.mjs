// ============================================================
// SYNC DES VERSIONS NATIVES (Android + Desktop + iOS)
// ============================================================
// Lit la version dans package.json (racine) et synchronise :
//   - android/app/build.gradle  → versionCode + versionName
//   - desktop/package.json      → version (electron-builder)
//   - ios                       → MARKETING_VERSION (pbxproj) si possible
// Usage : node scripts/sync-native-versions.mjs
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version; // ex "0.1.0"
const [major, minor, patch] = version.split(".").map((n) => parseInt(n, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch; // 0.1.0 → 100

console.log(`Version lue depuis package.json : ${version} → versionCode ${versionCode}`);

// ---- Android : android/app/build.gradle ----
const androidPath = join(root, "android", "app", "build.gradle");
let gradle = readFileSync(androidPath, "utf8");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
writeFileSync(androidPath, gradle);
console.log("✔ android/app/build.gradle synchronisé");

// ---- Desktop : desktop/package.json ----
const desktopPkgPath = join(root, "desktop", "package.json");
const dPkg = JSON.parse(readFileSync(desktopPkgPath, "utf8"));
dPkg.version = version;
writeFileSync(desktopPkgPath, JSON.stringify(dPkg, null, 2) + "\n");
console.log("✔ desktop/package.json synchronisé");

// ---- iOS : MARKETING_VERSION dans project.pbxproj ----
const pbxProj = join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
try {
  let pbx = readFileSync(pbxProj, "utf8");
  if (/MARKETING_VERSION\s*=\s*[^;]+;/.test(pbx)) {
    pbx = pbx.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g, `MARKETING_VERSION = ${version};`);
    pbx = pbx.replace(/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g, `CURRENT_PROJECT_VERSION = ${versionCode};`);
    writeFileSync(pbxProj, pbx);
    console.log("✔ ios project.pbxproj synchronisé (MARKETING_VERSION / CURRENT_PROJECT_VERSION)");
  } else {
    console.log("ℹios pbxproj: MARKETING_VERSION introuvable (géré via Xcode)");
  }
} catch {
  console.log("ℹ ios projet non trouvé — ignoré");
}

console.log("\nVersion native synchronisée sur " + version);