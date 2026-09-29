// One map seed per application startup. Pure game functions can receive an explicit seed.
export const MAP_SEED = Date.now()

export function deriveSeed(mapSeed: number, scope: string): number {
  let hash = 2166136261
  for (const char of `${mapSeed}:${scope}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}

export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  const int = (maxExclusive: number) => {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError('Random bound must be a positive safe integer')
    return Math.floor(next() * maxExclusive)
  }
  const shuffle = <T>(items: readonly T[]): T[] => {
    const result = [...items]
    for (let i = result.length - 1; i > 0; i--) {
      const j = int(i + 1)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
  return { next, int, shuffle }
}
