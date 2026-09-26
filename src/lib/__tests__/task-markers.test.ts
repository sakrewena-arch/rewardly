import { describe, it, expect } from "vitest";
import {
  PROMO_SITES,
  PROMO_BONUSES,
  buildPromoMarker,
  buildShareMarker,
  buildMediaMarker,
  parsePromoFromInstructions,
  cleanTaskInstructions,
} from "../task-markers";

describe("task-markers — codes promo", () => {
  it("encode puis décode un code promo (aller-retour admin → utilisateur)", () => {
    const marker = buildPromoMarker({ site: "1xbet", code: "REWARD200", bonus: "bonus200" });
    const promo = parsePromoFromInstructions(marker);

    expect(promo).not.toBeNull();
    expect(promo!.siteName).toBe("1xBet");
    expect(promo!.siteEmoji).toBe("🎰");
    expect(promo!.code).toBe("REWARD200");
    expect(promo!.bonusLabel).toBe(PROMO_BONUSES.bonus200);
    // lien par défaut du site quand aucun lien n'est fourni
    expect(promo!.link).toBe(PROMO_SITES["1xbet"].link);
  });

  it("utilise le lien fourni par l'admin en priorité", () => {
    const marker = buildPromoMarker({
      site: "1win",
      code: "WIN100",
      bonus: "cashback25",
      link: "https://partenaire.example/ref",
    });
    const promo = parsePromoFromInstructions(marker);
    expect(promo!.link).toBe("https://partenaire.example/ref");
    expect(promo!.bonusLabel).toBe("25 % cashback");
  });

  it("accepte les codes avec points / tirets / underscores", () => {
    const promo = parsePromoFromInstructions(
      buildPromoMarker({ site: "betwinner", code: "RE-WARD_2.0", bonus: "codebonus" })
    );
    expect(promo!.code).toBe("RE-WARD_2.0");
  });

  it("retombe sur « Site partenaire » si le site est inconnu", () => {
    const promo = parsePromoFromInstructions("[PROMO] site=inconnu code=ABC bonus=freebet link=");
    expect(promo!.siteName).toBe(PROMO_SITES.other.name);
    expect(promo!.bonusLabel).toBe("Freebet offert");
  });

  it("renvoie null quand la tâche n'a pas de code promo", () => {
    expect(parsePromoFromInstructions("Regardez la vidéo puis validez")).toBeNull();
    expect(parsePromoFromInstructions(null)).toBeNull();
    expect(parsePromoFromInstructions(undefined)).toBeNull();
  });
});

describe("task-markers — nettoyage des marqueurs techniques", () => {
  it("retire [MEDIA], [SHARE] et [PROMO] du texte montré à l'utilisateur", () => {
    const instructions = [
      buildMediaMarker("image", "data:image/png;base64,AAAA"),
      buildPromoMarker({ site: "1xbet", code: "REWARD200", bonus: "bonus200" }),
      buildShareMarker({ app: "whatsapp", target: "contacts", count: 10 }),
      "1. Ouvrez le lien",
      "NB : ne partagez jamais votre mot de passe",
    ].join("\n");

    const cleaned = cleanTaskInstructions(instructions);

    expect(cleaned).not.toMatch(/\[MEDIA\]/);
    expect(cleaned).not.toMatch(/\[SHARE\]/);
    expect(cleaned).not.toMatch(/\[PROMO\]/);
    expect(cleaned).not.toContain("base64");
    expect(cleaned).toContain("1. Ouvrez le lien");
    expect(cleaned).toContain("NB : ne partagez jamais votre mot de passe");
  });

  it("gère un [SHARE] avec app/cible/count vides (marqueur tolérant)", () => {
    const cleaned = cleanTaskInstructions("[SHARE] app= target= count=\nFaites ceci");
    expect(cleaned).toBe("Faites ceci");
    expect(cleaned).not.toMatch(/\[SHARE\]/);
  });

  it("ne touche pas un texte sans marqueur", () => {
    expect(cleanTaskInstructions("Simple instruction")).toBe("Simple instruction");
    expect(cleanTaskInstructions(null)).toBe("");
  });
});
