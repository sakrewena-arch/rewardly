/**
 * ============================================================
 * REWARDLY — Générateur de l'ensemble SQL canonique
 * ============================================================
 * Lit les sources CANONIQUES, dans l'ordre d'application :
 *   1. supabase/legacy/consolidated_schema.sql      (base : tables, RLS, seed)
 *   2. supabase/migrations/00001..000NN_*.sql       (correctifs, ordre croissant)
 *
 * et écrit dans supabase/setup/ :
 *   01_schema.sql        tables, index, types, seeds, storage
 *   02_functions.sql     TOUTES les fonctions (dernière version gagnante)
 *   03_rls_triggers.sql  triggers + policies (dernière version gagnante)
 *   04_privileges.sql    GRANT/REVOKE + durcissement anti auto-crédit
 *   00_full_setup.sql    concaténation des 4 (fichier unique à coller)
 *
 * Règles :
 *   - « dernière définition gagnante » : une fonction/un trigger/une policy
 *     défini plusieurs fois n'est conservé qu'une fois (la version la plus
 *     récente selon l'ordre ci-dessus) -> état final = celui de la prod.
 *   - Les fichiers supabase/legacy/** et supabase/tools/** ne sont JAMAIS
 *     appliqués (historique / exploitation).
 *   - Les RPC d'administration reçoivent une garde is_admin()/is_staff() si
 *     elle manque, et sont retirées de l'accès anonyme (anon/PUBLIC).
 *
 * Usage :  node scripts/build-supabase-setup.mjs
 * ============================================================
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE = join(ROOT, "supabase");
const OUT_DIR = join(SUPABASE, "setup");
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// ------------------------------------------------------------
// 1. Sources canoniques (ordre d'application)
// ------------------------------------------------------------
const MIGRATIONS = readdirSync(join(SUPABASE, "migrations"))
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort();

const SOURCES = [
  join(SUPABASE, "legacy", "consolidated_schema.sql"),
  ...MIGRATIONS.map((f) => join(SUPABASE, "migrations", f)),
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
mkdirSync(OUT_DIR, { recursive: true });

const banner = (step, title, note) =>
  [
    "-- " + "=".repeat(70),
    `-- REWARDLY — ${title}   (étape ${step}/4)`,
    "-- GÉNÉRÉ par scripts/build-supabase-setup.mjs — NE PAS ÉDITER À LA MAIN.",
    "-- Modifier supabase/migrations/, puis régénérer.",
    note ? `-- ${note}` : null,
    "-- " + "=".repeat(70),
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");

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
  "01_schema.sql":
    banner(1, "SCHÉMA — extensions, types, tables, index, seeds, storage", "À exécuter en premier (idempotent).") +
    "\n" +
    schemaBody +
    "\n",
  "02_functions.sql":
    banner(2, `FONCTIONS — ${functions.size} fonctions (état final dédupliqué)`, "Dernière version de chaque fonction selon l'ordre des migrations.") +
    "\n" +
    fnBody +
    "\n",
  "03_rls_triggers.sql":
    banner(3, `TRIGGERS (${triggers.size}) + RLS POLICIES (${policies.size})`, "Chaque objet est supprimé puis recréé : idempotent.") +
    "\n" +
    trigBody +
    "\n\n" +
    polBody +
    "\n",
  "04_privileges.sql":
    banner(4, "PRIVILÈGES — GRANT/REVOKE + durcissement", "Les RPC d'administration ne sont plus accessibles aux clients anonymes.") +
    "\n" +
    privBody +
    "\n\n" +
    "-- ======================================================\n" +
    "-- DURCISSEMENT (généré) : accès ANONYME interdit\n" +
    "-- ======================================================\n" +
    hardening.join("\n") +
    "\n",
};

const fullContent =
  banner(0, "INSTALLATION / MISE À JOUR COMPLÈTE (fichier unique)", "Copier-coller intégral dans le SQL Editor Supabase.") +
  "\n\n" +
  Object.entries(out)
    .map(([name, content]) => `-- ~~~~ INCLUS : ${name} ~~~~\n\n${content}`)
    .join("\n\n");

const allFiles = { ...out, "00_full_setup.sql": fullContent };

// Mode --check : vérifie que les fichiers générés sont à jour (CI)
if (process.argv.includes("--check")) {
  const drifted = Object.entries(allFiles).filter(([name, content]) => {
    const p = join(OUT_DIR, name);
    return !existsSync(p) || readFileSync(p, "utf8") !== content;
  });
  if (drifted.length) {
    console.error("✗ Fichiers supabase/setup/ désynchronisés :");
    drifted.forEach(([name]) => console.error(`   - ${name}`));
    console.error("  → corrigez avec : node scripts/build-supabase-setup.mjs");
    process.exit(1);
  }
  console.log("✓ supabase/setup/ est à jour par rapport aux migrations.");
  process.exit(0);
}

for (const [name, content] of Object.entries(allFiles)) {
  writeFileSync(join(OUT_DIR, name), content, "utf8");
}

// ------------------------------------------------------------
// 7. Rapport
// ------------------------------------------------------------
const guardOk = [...functions.entries()].filter(
  ([name, f]) => ADMIN_RPCS.includes(name) && /is_admin\(\)|is_staff\(\)/.test(f.stmt)
);

console.log("Sources appliquées (ordre) :");
SOURCES.forEach((f, i) => console.log(`  ${i + 1}. ${rel(f)}`));
console.log("");
console.log(`Fonctions           : ${functions.size}  (définitions ignorées : ${dropped.functions})`);
console.log(`Triggers            : ${triggers.size}  (ignorés : ${dropped.triggers})`);
console.log(`Policies RLS        : ${policies.size}  (ignorées : ${dropped.policies})`);
console.log(`GRANT/REVOKE        : ${privileges.length}  (doublons ignorés : ${dropped.privileges})`);
console.log(`Instructions schéma : ${schemaStmts.length}  (doublons ignorés : ${dropped.schema})`);
console.log(`Gardes admin        : ${guardOk.length}/${ADMIN_RPCS.length}`);
console.log(`REVOKE de durcissement : ${hardening.length}`);
if (dropFunctionStmts.length) {
  console.log("");
  console.log("⚠ DROP FUNCTION explicites trouvés (à vérifier) :");
  dropFunctionStmts.forEach((d) => console.log(`  - ${d.file}:${d.line}`));
}


