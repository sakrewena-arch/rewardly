import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Version Node.js (synchrone) pour les Server Components.
 * Utilise createHmac de Node.js crypto (fiable en Node.js).
 */
export function signAdminSessionNode(userId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
  const payload = `${userId}:${Date.now()}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Vérifie la signature du cookie admin (version Node.js synchrone).
 * Retourne true si le cookie est valide et non expiré.
 */
export function verifyAdminSessionNode(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return false;

  const [userId, timestamp, signature] = parts;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
  const expected = createHmac("sha256", secret).update(`${userId}:${timestamp}`).digest("hex");

  // Comparaison en temps constant
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) return false;

  // Expiration : 8 heures
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > 8 * 60 * 60 * 1000) return false;

  return true;
}