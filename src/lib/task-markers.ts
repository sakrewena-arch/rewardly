// ============================================================
// MARQUEURS DE TÂCHES — source unique de vérité
// ============================================================
// Les tâches stockent leurs métadonnées dans `tasks.instructions`
// sous forme de marqueurs texte (aucune colonne SQL supplémentaire) :
//
//   [MEDIA] type=image|video data=data:...        (média joint)
//   [SHARE] app=whatsapp target=contacts count=10 (tâche de partage)
//   [PROMO] site=1xbet code=REWARD bonus=bonus200 link=https://… (code promo)
//
// ⚠️ Ces helpers sont utilisés par le formulaire ADMIN (encodage) ET par
// l'application UTILISATEUR (décodage) : ils DOIVENT rester synchronisés.
// ============================================================

export const PROMO_SITES: Record<string, { name: string; emoji: string; link: string }> = {
  "1xbet": { name: "1xBet", emoji: "🎰", link: "https://1xbet.com" },
  betwinner: { name: "BetWinner", emoji: "🎯", link: "https://betwinner.com" },
  "1win": { name: "1Win", emoji: "🏆", link: "https://1win.com" },
  melbet: { name: "Melbet", emoji: "🎲", link: "https://melbet.com" },
  other: { name: "Site partenaire", emoji: "🌐", link: "" },
};

/** Bonus proposés (clé technique → libellé affiché). */
export const PROMO_BONUSES: Record<string, string> = {
  cashback25: "25 % cashback",
  bonus200: "Bonus 200 % au 1er dépôt",
  bonus100: "Bonus 100 % au 1er dépôt",
  codebonus: "Code bonus de bienvenue",
  freebet: "Freebet offert",
};

export interface PromoInfo {
  siteKey: string;
  siteName: string;
  siteEmoji: string;
  code: string;
  bonusKey: string;
  bonusLabel: string;
  link: string;
}

/** Construit le marqueur [PROMO] à stocker dans instructions (côté admin). */
export function buildPromoMarker(input: {
  site: string;
  code: string;
  bonus: string;
  link?: string;
}): string {
  const link = input.link?.trim() || PROMO_SITES[input.site]?.link || "";
  return `[PROMO] site=${input.site} code=${input.code.trim()} bonus=${input.bonus} link=${link}`;
}

/** Décode le marqueur [PROMO] (côté utilisateur). */
export function parsePromoFromInstructions(
  instructions: string | null | undefined
): PromoInfo | null {
  const match = (instructions || "").match(
    /\[PROMO\]\s*site=(\w+)\s*code=([A-Za-z0-9._-]+)\s*bonus=([A-Za-z0-9._-]+)\s*link=(\S*)/
  );
  if (!match) return null;
  const site = PROMO_SITES[match[1]] || PROMO_SITES.other;
  return {
    siteKey: match[1],
    siteName: site.name,
    siteEmoji: site.emoji,
    code: match[2],
    bonusKey: match[3],
    bonusLabel: PROMO_BONUSES[match[3]] || "",
    link: match[4] || site.link,
  };
}

/** Construit le marqueur [SHARE] (côté admin). */
export function buildShareMarker(input: {
  app: string;
  target: string;
  count: number | string;
}): string {
  return `[SHARE] app=${input.app} target=${input.target} count=${input.count}`;
}

/** Construit le marqueur [MEDIA] (côté admin). */
export function buildMediaMarker(type: "image" | "video", dataUrl: string): string {
  return `[MEDIA] type=${type} data=${dataUrl}`;
}

/**
 * Retire TOUS les marqueurs techniques du texte destiné à l'utilisateur
 * (sinon on afficherait le base64 brut ou les paramètres internes).
 */
export function cleanTaskInstructions(instructions: string | null | undefined): string {
  return (instructions || "")
    .replace(/\[MEDIA\] type=\w+ data=data:[^\s]+\n?/g, "")
    .replace(/\[SHARE\]\s*app=\w*\s*target=\w*\s*count=\d*\n?/g, "")
    .replace(/\[PROMO\][^\n]*\n?/g, "")
    .trim();
}
