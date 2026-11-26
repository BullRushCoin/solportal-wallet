export type CardSkinId = "skull-king" | "portal-dragon" | "moon" | "classic";

export type CardSkin = {
  id: CardSkinId;
  name: string;
  /** Engraved artwork; `null` keeps the plain gold-on-dark Classic card. */
  src: string | null;
  tone: "light" | "dark";
};

export const CARD_SKINS: CardSkin[] = [
  { id: "skull-king", name: "Skull King", src: "/skins/skull-king.webp", tone: "light" },
  { id: "portal-dragon", name: "Portal Dragon", src: "/skins/portal-dragon.webp", tone: "dark" },
  { id: "moon", name: "Moon", src: "/skins/moon.webp", tone: "dark" },
  { id: "classic", name: "Classic", src: null, tone: "dark" },
];

export const DEFAULT_CARD_SKIN: CardSkinId = "skull-king";
export const DEFAULT_CARD_SKIN_SRC = "/skins/skull-king.webp";

/** Key used when no account exists yet (fresh install). */
export const GLOBAL_SKIN_KEY = "_global";

export function cardSkinById(id: string | null | undefined): CardSkin {
  return CARD_SKINS.find((skin) => skin.id === id) ?? CARD_SKINS.find((skin) => skin.id === DEFAULT_CARD_SKIN)!;
}

/** Per-wallet skin, falling back to the last global pick, then the default. */
export function resolveCardSkin(map: Record<string, string> | undefined, accountId: string | null): CardSkin {
  const saved = map ?? {};
  return cardSkinById((accountId ? saved[accountId] : undefined) ?? saved[GLOBAL_SKIN_KEY]);
}
