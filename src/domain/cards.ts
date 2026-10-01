import { templates, GROWTH_FORMS } from "../data/cards.ts";
import { tokenTemplates } from "../data/tokens.ts";
import { SIGILS } from "../data/sigils.ts";
import type { Card, Species, Sigil, TokenKind } from "../data/types.ts";

export * from "../data/types.ts";
export { templates } from "../data/cards.ts";
export { SIGILS } from "../data/sigils.ts";

export function makeCard(index: number, id: string): Card {
  const card = templates[index % templates.length];
  return { ...card, native: [...card.native], added: [], id };
}
export function creature(species: Species, id: string): Card {
  const index = templates.findIndex((c) => c.species === species);
  if (index < 0) throw new Error("Unknown card: " + species);
  return makeCard(index, id);
}
export function makeSquirrel(id: string): Card {
  return creature("squirrel", id);
}
export function allCreatures(): Card[] {
  return templates.map((_, index) => makeCard(index, "catalog-" + index));
}
export const sigils = (card: Card): Sigil[] => [...new Set([...card.native, ...card.added])];
export const load = (card: Card): number =>
  card.added.reduce((sum, s) => sum + SIGILS[s].weight, 0);
export function makeToken(kind: TokenKind, id: string): Card {
  const card = tokenTemplates[kind];
  return { ...card, id, added: [], native: [...card.native] };
}

export function allTokens(): Card[] {
  return (Object.keys(tokenTemplates) as TokenKind[]).map((kind) =>
    makeToken(kind, "catalog-token-" + kind),
  );
}

export function grownForm(card: Card): Card | undefined {
  const targetSpecies = GROWTH_FORMS[card.species];
  if (!targetSpecies) return;
  const pool = [...templates, ...Object.values(tokenTemplates)];
  const original = pool.find((c) => c.species === card.species)!;
  const target = pool.find((c) => c.species === targetSpecies)!;
  return {
    ...card,
    species: target.species,
    name: target.name,
    art: target.art,
    tribe: target.tribe,
    cost: target.cost,
    attack: card.attack + target.attack - original.attack,
    health: card.health + target.health - original.health,
    native: [...new Set([...card.native.filter((s) => s !== "growth"), ...target.native])],
  };
}

export function sigilDescription(card: Card, sigil: Sigil): string {
  const adult = sigil === "growth" ? grownForm(card) : undefined;
  if (!adult) return SIGILS[sigil].description;
  const abilities = adult.native.map((s) => SIGILS[s].name).join("、");
  return `一回合后长大为${adult.name}（${adult.cost} 费，${adult.attack}/${adult.health}${abilities ? `，${abilities}` : ""}）。`;
}
