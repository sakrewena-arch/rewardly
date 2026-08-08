export const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Signe la valeur du cookie admin avec un HMAC-SHA256.
 * Utilise la Web Crypto API (compatible Edge Runtime et Node.js).
 * Le secret est dérivé de SUPABASE_SERVICE_ROLE_KEY (jamais exposé au client).
 */
export async function signAdminSession(userId: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
  const payload = `${userId}:${Date.now()}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  // Convertir en hexadécimal
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${payload}.${signature}`;
}

/**
 * Vérifie la signature du cookie admin.
 * Utilise la Web Crypto API (compatible Edge Runtime et Node.js).
 * Retourne true si le cookie est valide et non expiré.
 */
export async function verifyAdminSession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;

  const [userId, timestamp, signature] = parts;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const expectedBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${timestamp}`)
  );

  // Convertir en hexadécimal
  const expected = Array.from(new Uint8Array(expectedBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Comparaison à temps constant (évite les attaques par timing)
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) return false;

  // Expiration : 8 heures
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > 8 * 60 * 60 * 1000) return false;

  return true;
}