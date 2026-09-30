import { templates } from '../data/cards.ts'
import { tokenTemplates } from '../data/tokens.ts'
import { SIGILS } from '../data/sigils.ts'
import type { Card, Species, Sigil, TokenKind } from '../data/types.ts'

export * from '../data/types.ts'
export { templates } from '../data/cards.ts'
export { SIGILS } from '../data/sigils.ts'

export function makeCard(index: number, id: string): Card { const card = templates[index % templates.length]; return { ...card, native: [...card.native], added: [], id } }
export function creature(species: Species, id: string): Card { const index = templates.findIndex(c => c.species === species); if (index < 0) throw new Error('Unknown card: ' + species); return makeCard(index, id) }
export function makeSquirrel(id: string): Card { return creature('squirrel', id) }
export function allCreatures(): Card[] { return templates.map((_, index) => makeCard(index, 'catalog-' + index)) }
export const sigils = (card: Card): Sigil[] => [...new Set([...card.native, ...card.added])]
export const load = (card: Card): number => card.added.reduce((sum, s) => sum + SIGILS[s].weight, 0)
export function makeToken(kind: TokenKind, id: string): Card { const card = tokenTemplates[kind]; return { ...card, id, added: [], native: [...card.native] } }

export function allTokens(): Card[] { return (Object.keys(tokenTemplates) as TokenKind[]).map(kind => makeToken(kind, 'catalog-token-' + kind)) }
