// ============================================================
// Découpe admin-actions.ts en modules thématiques (barrel).
// Usage : node scripts/split-admin-actions.mjs
// Non idempotent : une fois le barrel créé, le script refuse de
// re-découper (garde anti-rexécution).
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcFile = join(root, "src", "actions", "admin-actions.ts");
const source = readFileSync(srcFile, "utf8");
const lines = source.split(/\r?\n/);

if (source.includes("export * from \"./admin-actions-helpers\"")) {
  console.log("admin-actions.ts est déjà un barrel. Abort.");
  process.exit(0);
}

// Marqueurs de section (lignes exactes, trim-start match)
const MARKERS = [
  "// ============ AUTH HELPERS ============",
  "// ============ ADMIN ANALYTICS ============",
  "// ============ PLATFORM STATS ============",
  "// ============ USERS ============",
  "// ============ DEPOSITS ============",
  "// ============ WITHDRAWALS ============",
  "// ============ PLANS ============",
  "// ============ TASKS ============",
  "// ============ SUBMISSIONS (manual validation) ============",
  "// ============ CATEGORIES ============",
  "// ============ SERVICE ORDERS ============",
  "// ============ SYSTEM SETTINGS ============",
];

const find = (m) => lines.findIndex((l) => l.trim() === m);
const idx = MARKERS.map(find);
if (idx.some((i) => i === -1)) {
  throw new Error("Marqueurs introuvables (code a changé?)");
}

const slice = (a, b) => lines.slice(a, b).join("\n");

// headers d'imports par module (config)
const BASE = [
  '"use server";',
  "",
  'import { createClient, createAdminClient } from "@/lib/supabase/server";',
];
const WITH_ADMIN = [...BASE, 'import { requireAdmin } from "./admin-actions-helpers";', 'import { revalidatePath } from "next/cache";', ""];
const WITH_TYPES = [...WITH_ADMIN, 'import type { CreateTaskInput, TaskFieldInput } from "@/types/admin";', ""];

const build = (header, body) => header.join("\n") + "\n\n" + body + "\n";

// 0) helpers : getCurrentUser / isAdmin / requireAdmin
const helpersBody = slice(idx[0], idx[1] - 1)
  .replace(/^async function requireAdmin/gm, "export async function requireAdmin");

writeFileSync(
  join(root, "src", "actions", "admin-actions-helpers.ts"),
  build(
    ['"use server";', "", 'import { createClient, createAdminClient } from "@/lib/supabase/server";', 'import { cookies } from "next/headers";', ""],
    helpersBody
  )
);

// 1) analytics (inclut PLATFORM STATS)
writeFileSync(
  join(root, "src", "actions", "admin-actions-analytics.ts"),
  build(WITH_ADMIN, slice(idx[1], idx[3] - 1))
);

// 2) users
writeFileSync(
  join(root, "src", "actions", "admin-actions-users.ts"),
  build(WITH_ADMIN, slice(idx[3], idx[4] - 1))
);

// 3) finance (deposits + withdrawals)
writeFileSync(
  join(root, "src", "actions", "admin-actions-finance.ts"),
  build(WITH_ADMIN, slice(idx[4], idx[6] - 1))
);

// 4) plans
writeFileSync(
  join(root, "src", "actions", "admin-actions-plans.ts"),
  build(WITH_ADMIN, slice(idx[6], idx[7] - 1))
);

// 5) tasks
writeFileSync(
  join(root, "src", "actions", "admin-actions-tasks.ts"),
  build(WITH_TYPES, slice(idx[7], idx[8] - 1))
);

// 6) submissions
writeFileSync(
  join(root, "src", "actions", "admin-actions-submissions.ts"),
  build(WITH_ADMIN, slice(idx[8], idx[9] - 1))
);

// 7) categories (lecture seule, pas de requireAdmin ni revalidatePath)
writeFileSync(
  join(root, "src", "actions", "admin-actions-categories.ts"),
  build([...BASE, ""], slice(idx[9], idx[10] - 1))
);

// 8) services (requireAdmin + revalidatePath)
writeFileSync(
  join(root, "src", "actions", "admin-actions-services.ts"),
  build(WITH_ADMIN, slice(idx[10], idx[11] - 1))
);

// 9) settings (lecture seule)
writeFileSync(
  join(root, "src", "actions", "admin-actions-settings.ts"),
  build([...BASE, ""], slice(idx[11], lines.length))
);

// ============================================================
// Barrel : conserve l'API publique d'origine
// ============================================================
const barrel = `/*
 * admin-actions.ts — BARREL.
 * Les actions admin sont réparties par domaine :
 *   - helpers      : utilisateurs/role (requireAdmin)
 *   - analytics    : statistiques
 *   - users        : gestion des utilisateurs
 *   - finance      : dépôts & retraits
 *   - plans        : packs
 *   - tasks        : tâches
 *   - submissions  : validation des soumissions
 *   - categories   : catégories de tâches
 *   - services     : commandes de services
 *   - settings     : paramètres système & moyens de paiement
 */
export * from "./admin-actions-helpers";
export * from "./admin-actions-analytics";
export * from "./admin-actions-users";
export * from "./admin-actions-finance";
export * from "./admin-actions-plans";
export * from "./admin-actions-tasks";
export * from "./admin-actions-submissions";
export * from "./admin-actions-categories";
export * from "./admin-actions-services";
export * from "./admin-actions-settings";
`.trimStart();

writeFileSync(srcFile, barrel + "\n");
console.log("✔ admin-actions.ts barrélisé");
console.log("✔ modules générés dans src/actions/admin-actions-*.ts");