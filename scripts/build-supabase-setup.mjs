/**
 * ============================================================
 * REWARDLY — Générateur du fichier SQL UNIQUE
 * ============================================================
 * Lit les sources (matière première, jamais exécutées telles quelles) :
 *   1. supabase/sources/base_schema.sql            (tables, RLS, seed, storage)
 *   2. supabase/sources/migrations/00001..00022    (correctifs, ordre croissant)
 *
 * et écrit UN SEUL fichier à exécuter dans le SQL Editor Supabase :
 *   supabase/INSTALL.sql
 *     §1 schéma (tables, index, types, seeds, storage)
 *     §2 fonctions  (34, dernière version gagnante, idempotentes)
 *     §3 triggers + policies RLS
 *     §4 privilèges (GRANT/REVOKE + durcissement anti accès anonyme)
 *
 * Règles :
 *   - « dernière définition gagnante » : une fonction/un trigger/une policy
 *     défini plusieurs fois n'est conservé qu'une fois (version la plus
 *     récente selon l'ordre ci-dessus) -> état final = celui attendu en prod.
 *   - Les RPC AVEC paramètres sont précédées d'un DROP FUNCTION IF EXISTS :
 *     évite l'erreur « cannot change name of input parameter » quand la
 *     fonction existe déjà avec d'autres noms de paramètres.
 *   - Les RPC d'administration reçoivent une garde is_admin()/is_staff() si
 *     elle manque, et sont retirées de l'accès anonyme (anon/PUBLIC).
 *   - Un VALIDATEUR vérifie ensuite que chaque référence (policy/trigger/
 *     index/GRANT) pointe bien sur un objet défini dans le fichier.
 *
 * Usage :
 *   node scripts/build-supabase-setup.mjs           # génère INSTALL.sql
 *   node scripts/build-supabase-setup.mjs --check   # vérifie (CI)
 * ============================================================
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE = join(ROOT, "supabase");
const SOURCES_DIR = join(SUPABASE, "sources");
const OUT_FILE = join(SUPABASE, "INSTALL.sql");
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// ------------------------------------------------------------
// 1. Sources (ordre d'application)
// ------------------------------------------------------------
const MIGRATIONS_DIR = join(SOURCES_DIR, "migrations");
const MIGRATIONS = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort()
  : [];

const SOURCES = [
  join(SOURCES_DIR, "base_schema.sql"),
  ...MIGRATIONS.map((f) => join(MIGRATIONS_DIR, f)),
].filter((f) => existsSync(f));

// RPC d'administration : garde obligatoire + retrait de l'accès anonyme
const ADMIN_RPCS = [
  "add_reward",
  "approve_submission",
  "reject_submission",
  "validate_deposit",
  "validate_withdrawal",
  "ban_user",
  "delete_user",
  "create_task",
  "update_task",
  "delete_task",
  "create_plan",
  "update_plan",
  "toggle_plan_status",
  "get_platform_stats",
  "get_users_with_details",
];

// RPC réservées au serveur / à l'administration (aucun accès anonyme)
const NO_ANON = [...ADMIN_RPCS, "credit_referral_commission", "credit_feeexpay_deposit", "request_withdrawal_feeexpay"];

// ------------------------------------------------------------
// 2. Découpage en instructions de premier niveau ($ / ' / -- / /* gérés)
// ------------------------------------------------------------
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let start = 0;
  let i = 0;
  let parens = 0;
  let inLine = false;
  let inBlock = false;
  let inSingle = false;
  let dollar = null;

  const push = () => {
    const text = buf.trim();
    if (text) out.push({ text, offset: start + buf.indexOf(text) });
    buf = "";
  };

  while (i < sql.length) {
    const c = sql[i];

    if (inLine) { buf += c; if (c === "\n") inLine = false; i++; continue; }
    if (inBlock) {
      if (sql.startsWith("*/", i)) { buf += "*/"; i += 2; inBlock = false; continue; }
      buf += c; i++; continue;
    }
    if (inSingle) {
      if (c === "'") {
        if (sql[i + 1] === "'") { buf += "''"; i += 2; continue; }
        buf += c; inSingle = false; i++; continue;
      }
      buf += c; i++; continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { buf += dollar; i += dollar.length; dollar = null; continue; }
      buf += c; i++; continue;
    }
    if (sql.startsWith("--", i)) { buf += "--"; i += 2; inLine = true; continue; }
    if (sql.startsWith("/*", i)) { buf += "/*"; i += 2; inBlock = true; continue; }
    if (c === "'") { buf += c; inSingle = true; i++; continue; }
    if (c === "$") {
      const m = /^(\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$)/.exec(sql.slice(i));
      if (m) { buf += m[1]; i += m[1].length; dollar = m[1]; continue; }
    }
    if (!buf.trim() && !/\s/.test(c)) start = i;
    if (c === "(") parens++;
    else if (c === ")") parens = Math.max(0, parens - 1);
    buf += c;
    i++;
    if (c === ";" && parens === 0) push();
  }
  push();
  return out;
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

/** Retire les commentaires de tête pour pouvoir classifier l'instruction. */
const stripLeadingComments = (s) =>
  s
    .replace(/^(?:\s*--[^\n]*\n|\s*\/\*[\s\S]*?\*\/)+/g, "")
    .trim();

/**
 * Neutralise les « $$ » présents DANS LES COMMENTAIRES : le tokenizer du
 * SQL Editor Supabase les interprète comme des délimiteurs de bloc.
 */
const sanitizeComments = (s) =>
  s
    .split("\n")
    .map((l) => (/^\s*--/.test(l) ? l.replace(/\$\$/g, "$ $") : l))
    .join("\n");

// ------------------------------------------------------------
// 3. Classification & extraction des signatures
// ------------------------------------------------------------
const RE_FN = /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z_0-9]+)\s*\(/i;
const RE_DROP_FN = /^\s*DROP\s+FUNCTION/i;
const RE_TRIGGER_CREATE = /^\s*CREATE\s+TRIGGER\s+([a-z_0-9]+)/i;
const RE_TRIGGER_DROP = /^\s*DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?([a-z_0-9]+)/i;
const RE_POLICY_CREATE = /^\s*CREATE\s+POLICY\s+"([^"]+)"/i;
const RE_POLICY_DROP = /^\s*DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/i;
const RE_PRIV = /^\s*(GRANT|REVOKE)\b/i;

const fnName = (stmt) => (RE_FN.exec(stmt) || [])[1] || null;
const triggerTable = (stmt) => (/\bON\s+([\w."]+)/i.exec(stmt) || [])[1] || "?";
const policyTable = (stmt) => (/\bON\s+([\w."]+)/i.exec(stmt) || [])[1] || "?";

/** Découpe la liste d'arguments au premier niveau (respecte quotes/parenthèses). */
function argParts(stmt) {
  const open = stmt.indexOf("(");
  if (open < 0) return [];
  let depth = 0;
  let end = open;
  let inS = false;
  for (let i = open; i < stmt.length; i++) {
    const c = stmt[i];
    if (inS) { if (c === "'") inS = false; continue; }
    if (c === "'") { inS = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) { end = i; break; } }
  }
  const raw = stmt.slice(open + 1, end);
  const parts = [];
  let cur = "";
  let d = 0;
  let s = false;
  for (const ch of raw) {
    if (s) { cur += ch; if (ch === "'") s = false; continue; }
    if (ch === "'") { s = true; cur += ch; continue; }
    if (ch === "(") d++;
    if (ch === ")") d--;
    if (ch === "," && d === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts
    .map((p) =>
      p
        .replace(/--[^\n]*/g, " ") // commentaire de fin de ligne
        .replace(/\/\*[\s\S]*?\*\//g, " ") // commentaire de bloc
        .replace(/\s+DEFAULT[\s\S]*$/i, "") // valeur par défaut
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

/**
 * Signature « types seuls », pour REVOKE/GRANT : (p_user_id UUID) -> "uuid".
 * Analyse une version NETTOYÉE (sans commentaires ni chaînes littérales) :
 * évite qu'une parenthèse ou une virgule d'un commentaire fausse le résultat.
 */
function typesSig(stmt) {
  const clean = stmt
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, " ");

  const open = clean.indexOf("(");
  if (open < 0) return "";
  let depth = 0;
  let end = clean.length;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === "(") depth++;
    else if (clean[i] === ")") { depth--; if (depth === 0) { end = i; break; } }
  }

  return clean
    .slice(open + 1, end)
    .split(",")
    .map((p) => p.replace(/\s+DEFAULT[\s\S]*$/i, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((p) => (/\s+\S/.test(p) ? p.replace(/^\S+\s+/, "") : p)) // retire le nom du paramètre
    .map((t) => t.toLowerCase())
    .join(", ");
}

const GUARD_LINES = [
  "  -- 🔒 Réservé aux administrateurs (défense en profondeur)",
  "  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN",
  "    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');",
  "  END IF;",
];

/** Ajoute la garde admin juste après le BEGIN du corps, si elle manque. */
function injectGuard(name, stmt) {
  if (!ADMIN_RPCS.includes(name)) return stmt;
  if (/is_admin\(\)|is_staff\(\)/.test(stmt)) return stmt;
  if (!/RETURNS\s+JSONB/i.test(stmt)) return stmt;
  const lines = stmt.split("\n");
  const idx = lines.findIndex((l) => /^\s*BEGIN\s*$/i.test(l));
  if (idx < 0) return stmt;
  lines.splice(idx + 1, 0, ...GUARD_LINES);
  return lines.join("\n");
}

// ------------------------------------------------------------
// 4. Collecte — « dernière définition gagnante »
// ------------------------------------------------------------
const functions = new Map(); // nom -> { stmt, file, line, guardAdded }
const triggers = new Map(); // nom -> { stmt, file, line }
const policies = new Map(); // nom -> { stmt, file, line, table }
const privileges = []; // GRANT/REVOKE (ordre conservé, dédupliqués)
const schemaStmts = [];
const seenPriv = new Set();
const seenSchema = new Set();
const dropped = { functions: 0, triggers: 0, policies: 0, schema: 0, privileges: 0 };
const dropFunctionStmts = [];

for (const file of SOURCES) {
  const text = readFileSync(file, "utf8");
  for (const { text: stmt, offset } of splitStatements(text)) {
    const line = lineOf(text, offset);
    const head = stripLeadingComments(stmt);

    const name = fnName(head);
    if (name) {
      if (functions.has(name)) dropped.functions++;
      const before = stmt;
      const after = injectGuard(name, stmt);
      functions.set(name, { stmt: after, file: rel(file), line, guardAdded: after !== before });
      continue;
    }

    if (RE_DROP_FN.test(head)) {
      if (!/IF\s+EXISTS/i.test(head)) dropFunctionStmts.push({ stmt, file: rel(file), line });
      continue;
    }

    const trig = RE_TRIGGER_CREATE.exec(head);
    if (trig) {
      const key = trig[1].toLowerCase();
      if (triggers.has(key)) dropped.triggers++;
      triggers.set(key, { stmt, file: rel(file), line, table: triggerTable(head) });
      continue;
    }
    if (RE_TRIGGER_DROP.test(head)) continue;

    const pol = RE_POLICY_CREATE.exec(head);
    if (pol) {
      if (policies.has(pol[1])) dropped.policies++;
      policies.set(pol[1], { stmt, file: rel(file), line, table: policyTable(head) });
      continue;
    }
    if (RE_POLICY_DROP.test(head)) continue;

    if (RE_PRIV.test(head)) {
      const key = stmt.replace(/\s+/g, " ").trim().toLowerCase();
      if (seenPriv.has(key)) { dropped.privileges++; continue; }
      seenPriv.add(key);
      privileges.push({ stmt, file: rel(file), line });
      continue;
    }

    // Clé de dédoublonnage basée sur l'instruction SEULE (les commentaires
    // de tête ne doivent pas empêcher de reconnaître un doublon).
    const key = stripLeadingComments(stmt).replace(/\s+/g, " ").trim().toLowerCase();
    if (seenSchema.has(key)) { dropped.schema++; continue; }
    seenSchema.add(key);
    schemaStmts.push({ stmt, file: rel(file), line });
  }
}

// Garde-fou : évite de générer un jeu vide si le parsing casse
if (functions.size < 20) {
  console.error(`ERREUR : ${functions.size} fonction(s) détectée(s) — parsing suspect, génération annulée.`);
  process.exit(1);
}

// ------------------------------------------------------------
// 5. Durcissement : aucun client anonyme sur les RPC sensibles
// ------------------------------------------------------------
const hardening = [];
for (const name of NO_ANON) {
  const fn = functions.get(name);
  if (!fn) continue;
  const sig = typesSig(stripLeadingComments(fn.stmt));
  hardening.push(`REVOKE ALL ON FUNCTION public.${name}(${sig}) FROM PUBLIC;`);
  hardening.push(`REVOKE ALL ON FUNCTION public.${name}(${sig}) FROM anon;`);
}

// ------------------------------------------------------------
// 6. Écriture
// ------------------------------------------------------------
mkdirSync(SUPABASE, { recursive: true });

// Anti-erreur « cannot change name of input parameter » : les RPC AVEC
// paramètres sont supprimées avant recréation (aucune policy RLS ne dépend
// d'une RPC — contrairement aux helpers sans argument, laissés en REPLACE).
const fnDrops = [...functions.entries()]
  .filter(([, f]) => typesSig(stripLeadingComments(f.stmt)) !== "")
  .map(([name, f]) => `DROP FUNCTION IF EXISTS public.${name}(${typesSig(stripLeadingComments(f.stmt))});`);

const schemaBody = schemaStmts
  .map((s) => `-- [${s.file}:${s.line}]\n${sanitizeComments(s.stmt)}`)
  .join("\n\n");
const fnBody = [...functions.entries()]
  .map(
    ([, f]) =>
      `-- [${f.file}:${f.line}]${f.guardAdded ? "  << garde admin ajoutée automatiquement" : ""}\n${sanitizeComments(f.stmt)}`
  )
  .join("\n\n");
const trigBody = [...triggers.entries()]
  .map(([name, t]) => `DROP TRIGGER IF EXISTS ${name} ON ${t.table};\n-- [${t.file}:${t.line}]\n${sanitizeComments(t.stmt)}`)
  .join("\n\n");
const polBody = [...policies.entries()]
  .map(([name, p]) => `DROP POLICY IF EXISTS "${name}" ON ${p.table};\n-- [${p.file}:${p.line}]\n${sanitizeComments(p.stmt)}`)
  .join("\n\n");
const privBody = privileges.map((p) => `-- [${p.file}:${p.line}]\n${sanitizeComments(p.stmt)}`).join("\n\n");

const out = {
  "§1 — SCHÉMA (tables, index, types, seeds, stockage)": schemaBody,
  [`§2 — FONCTIONS (${functions.size})`]: `${fnDrops.join("\n")}\n\n${fnBody}`,
  [`§3 — TRIGGERS (${triggers.size}) + RLS (${policies.size} policies)`]: `${trigBody}\n\n${polBody}`,
  "§4 — PRIVILÈGES (GRANT/REVOKE + durcissement)": `${privBody}\n\n${hardening.join("\n")}`,
};

const toc = Object.keys(out)
  .map((t) => `--   • ${t}`)
  .join("\n");

const installContent = [
  "/*",
  " * " + "=".repeat(74),
  " * REWARDLY — INSTALLATION / MISE À JOUR COMPLÈTE DE LA BASE DE DONNÉES",
  " * " + "=".repeat(74),
  " *",
  " * ⭐ FICHIER UNIQUE À EXÉCUTER :",
  " *      Supabase → SQL Editor → coller TOUT ce fichier → Run",
  " *",
  " * ✅ Idempotent : peut être exécuté plusieurs fois, sans erreur et",
  " *    sans perte de données (CREATE IF NOT EXISTS / DROP IF EXISTS /\n *    CREATE OR REPLACE / DROP FUNCTION puis CREATE pour les RPC).",
  " *",
  " * Contenu :",
  toc,
  " *",
  " * ⚠️ NE PAS ÉDITER À LA MAIN : ce fichier est GÉNÉRÉ par",
  " *    scripts/build-supabase-setup.mjs à partir de supabase/sources/",
  " *    (modifier une migration dans supabase/sources/migrations/, puis",
  " *     exécuter : npm run db:build).",
  " *",
  " * " + "=".repeat(74),
  " */",
  "",
  ...Object.entries(out).map(([title, body]) =>
    [
      "",
      "/* " + "=".repeat(70),
      " * " + title,
      " * " + "=".repeat(70) + " */",
      "",
      body,
    ].join("\n")
  ),
  "",
].join("\n").replace(/\r\n/g, "\n"); // toujours en LF (identique sur Windows et Linux)

// ------------------------------------------------------------
// 7. VALIDATION — toute référence doit pointer sur un objet défini
//    (attrape les erreurs d'exécution les plus fréquentes : policy ou
//     trigger sur une table inexistante, GRANT sur une fonction absente
//     ou avec une signature qui ne correspond pas…)
// ------------------------------------------------------------
const normType = (t) =>
  t
    .toLowerCase()
    .replace(/\bdecimal\b/g, "numeric")
    .replace(/\bint\b|\bint4\b/g, "integer")
    .replace(/\bbool\b/g, "boolean")
    .replace(/\s+/g, " ")
    .trim();

const SYSTEM_OBJECTS = new Set([
  "auth.users",
  "auth.sessions",
  "auth.refresh_tokens",
  "auth.identities",
  "storage.objects",
  "storage.buckets",
]);

const definedTables = new Set();
for (const s of schemaStmts) {
  const h = stripLeadingComments(s.stmt);
  for (const m of h.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w".]+)/gi)) {
    const full = m[1].toLowerCase().replace(/"/g, "").replace(/;$/, "");
    definedTables.add(full.includes(".") ? full : `public.${full}`);
  }
}

const fnByName = new Map([...functions.entries()].map(([k, v]) => [k.toLowerCase(), v]));
const problems = [];

const tableOfStmt = (stmt) => {
  const h = stripLeadingComments(stmt);
  let m = null;
  if (/^INSERT\s+INTO/i.test(h)) {
    m = /\bINSERT\s+INTO\s+([\w".]+)/i.exec(h);
  } else if (/^ALTER\s+TABLE/i.test(h)) {
    m = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([\w".]+)/i.exec(h);
  } else {
    m = /\bON\s+(?:TABLE\s+)?([\w".]+)/i.exec(h);
    // ignore ON CONFLICT / ON UPDATE / ON DELETE (clauses, pas des tables)
    if (m && /^(conflict|update|delete|commit|rollback)$/i.test(m[1])) m = null;
  }
  if (!m) return null;
  const raw = m[1].toLowerCase().replace(/"/g, "").replace(/;$/, "");
  return raw.includes(".") ? raw : `public.${raw}`;
};

const checkTableRef = (stmt, label) => {
  const t = tableOfStmt(stmt);
  if (!t) return;
  if (!definedTables.has(t) && !SYSTEM_OBJECTS.has(t)) {
    problems.push(`${label} → table « ${t} » non définie dans le fichier`);
  }
};

for (const [name, p] of policies) checkTableRef(p.stmt, `POLICY "${name}"`);
for (const [name, t] of triggers) checkTableRef(t.stmt, `TRIGGER ${name}`);
for (const s of schemaStmts) {
  const h = stripLeadingComments(s.stmt);
  if (/^(ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|INSERT\s+INTO)/i.test(h)) {
    checkTableRef(s.stmt, `${h.split(/\s+/).slice(0, 3).join(" ")} (${s.file}:${s.line})`);
  }
}

for (const p of privileges) {
  const m = /ON\s+FUNCTION\s+(?:public\.)?([a-z_0-9]+)\s*\(([^)]*)\)/i.exec(stripLeadingComments(p.stmt));
  if (!m) continue;
  const name = m[1].toLowerCase();
  const fn = fnByName.get(name);
  if (!fn) {
    problems.push(`PRIVILÈGE (${p.file}:${p.line}) → fonction « ${name} » non définie`);
    continue;
  }
  const want = normType(m[2]);
  const have = normType(typesSig(stripLeadingComments(fn.stmt)));
  if (want !== have) {
    problems.push(
      `PRIVILÈGE (${p.file}:${p.line}) → ${name}(${want}) ≠ définition ${name}(${have})`
    );
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} référence(s) invalide(s) :`);
  problems.slice(0, 30).forEach((p) => console.error(`   - ${p}`));
  console.error("  → corrigez les sources puis relancez.");
  process.exit(1);
}

const allFiles = { "INSTALL.sql": installContent };

// Mode --check : vérifie que le fichier généré est à jour (utilisé en CI)
if (process.argv.includes("--check")) {
  const drifted = Object.entries(allFiles).filter(([, content]) => {
    return !existsSync(OUT_FILE) || readFileSync(OUT_FILE, "utf8") !== content;
  });
  if (drifted.length) {
    console.error("✗ supabase/INSTALL.sql n'est pas à jour.");
    console.error("  → corrigez avec : node scripts/build-supabase-setup.mjs");
    process.exit(1);
  }
  console.log("✓ supabase/INSTALL.sql est à jour par rapport aux sources.");
  process.exit(0);
}

writeFileSync(OUT_FILE, installContent, "utf8");

// ------------------------------------------------------------
// 7. Rapport
// ------------------------------------------------------------
const guardOk = [...functions.entries()].filter(
  ([name, f]) => ADMIN_RPCS.includes(name) && /is_admin\(\)|is_staff\(\)/.test(f.stmt)
);

console.log("Sources appliquées (ordre) :");
SOURCES.forEach((f, i) => console.log(`  ${i + 1}. ${rel(f)}`));
console.log("");
console.log(`→ Fichier généré : ${rel(OUT_FILE)}`);
console.log(`Fonctions           : ${functions.size}  (définitions ignorées : ${dropped.functions})`);
console.log(`Triggers            : ${triggers.size}  (ignorés : ${dropped.triggers})`);
console.log(`Policies RLS        : ${policies.size}  (ignorées : ${dropped.policies})`);
console.log(`GRANT/REVOKE        : ${privileges.length}  (doublons ignorés : ${dropped.privileges})`);
console.log(`Instructions schéma : ${schemaStmts.length}  (doublons ignorés : ${dropped.schema})`);
console.log(`Gardes admin        : ${guardOk.length}/${ADMIN_RPCS.length}`);
console.log(`DROP FUNCTION (RPC) : ${fnDrops.length}`);
console.log(`REVOKE de durcissement : ${hardening.length}`);
console.log(`Références validées : OK (tables, fonctions, signatures)`);
if (dropFunctionStmts.length) {
  console.log("");
  console.log("⚠ DROP FUNCTION explicites trouvés (à vérifier) :");
  dropFunctionStmts.forEach((d) => console.log(`  - ${d.file}:${d.line}`));
}


