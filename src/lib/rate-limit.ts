// Rate limiting utility for Route Handlers & Server Actions
// Simple in-memory rate limiter (per IP / per utilisateur).
// ⚠️ En environnement serverless (Vercel), le store est par instance :
//    c'est une protection "best-effort", pas une barrière absolue.
//    Il reste efficace contre les abus d'un même appelant.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_REQUESTS = 30; // 30 requests per minute

/**
 * Vérifie si une requête est autorisée selon le rate limit
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = DEFAULT_MAX_REQUESTS,
  windowMs: number = DEFAULT_WINDOW_MS
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Détermine une clé d'identification par IP pour le rate limiting.
 * Gère les reverse proxies (Vercel/Cloudflare) via x-forwarded-for.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Nettoie les entrées expirées (appel périodique)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

// Cleanup every 5 minutes (inactif pendant le test/typecheck : module exécuté
// uniquement à l'import côté runtime).
setInterval(cleanupRateLimits, 5 * 60 * 1000);