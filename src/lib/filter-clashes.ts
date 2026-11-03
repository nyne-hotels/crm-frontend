// Filters that can't both hold, such as "On the marketing email list" and
// "Marked do not contact", or a stays quick view and an arrival date range.
// When a change sets one while the other is on, the one just chosen wins and
// the other gives way: a list filter loses only its clashing values, anything
// else is cleared. Each list names its clashes next to its filters.

export interface ClashSide {
  key: string | readonly string[] // a range's two ends clash together
  label: string // for the note: 'Do not contact'
  is?: (value: string) => boolean // the whole value clashes (default: any value)
  items?: (item: string) => boolean // only these values of a list ('a,b') clash
}

export interface Clash {
  a: ClashSide
  b: ClashSide
}

const keysOf = (side: ClashSide) => (typeof side.key === 'string' ? [side.key] : side.key)
const listOf = (value: string | null) => (value ?? '').split(',').filter(Boolean)

function isOn(side: ClashSide, params: URLSearchParams) {
  return keysOf(side).some((key) => {
    const value = params.get(key)
    if (!value) return false
    if (side.items) return listOf(value).some(side.items)
    return side.is ? side.is(value) : true
  })
}

function giveWay(side: ClashSide, params: URLSearchParams) {
  for (const key of keysOf(side)) {
    const value = params.get(key)
    if (!value) continue
    const rest = side.items ? listOf(value).filter((item) => !side.items!(item)) : []
    if (rest.length) params.set(key, rest.join(','))
    else params.delete(key)
  }
}

// Settles the clashes in `next` after `changed` keys were set, and says what gave way.
export function settleClashes(next: URLSearchParams, changed: readonly string[], clashes: readonly Clash[]): string[] {
  const notes: string[] = []
  for (const { a, b } of clashes) {
    if (!isOn(a, next) || !isOn(b, next)) continue
    const aChanged = keysOf(a).some((k) => changed.includes(k))
    const [winner, loser] = aChanged ? [a, b] : [b, a]
    giveWay(loser, next)
    notes.push(`Removed “${loser.label}”: it can't be combined with “${winner.label}”.`)
  }
  // "any or all of these" only means something with two or more fields
  for (const key of ['filled', 'missing']) {
    if (listOf(next.get(key)).length < 2) next.delete(`${key}Match`)
  }
  return notes
}

// ---------- the usual kinds ----------
export const set = (key: string | readonly string[], label: string): ClashSide => ({ key, label })
export const is = (key: string, value: string, label: string): ClashSide => ({ key, label, is: (v) => v === value })
// a list filter that doesn't include any of `values` (e.g. a status without Lost)
export const without = (key: string, values: readonly string[], label: string): ClashSide => ({
  key,
  label,
  is: (v) => !listOf(v).some((item) => values.includes(item)),
})
export const including = (key: string, values: readonly string[], label: string): ClashSide => ({
  key,
  label,
  items: (item) => values.includes(item),
})
export const missing = (field: string, label: string): ClashSide => ({
  key: 'missing',
  label: `Missing: ${label}`,
  items: (item) => item === field,
})
export const filled = (field: string, label: string): ClashSide => ({
  key: 'filled',
  label: `Filled in: ${label}`,
  items: (item) => item === field,
})
// "Number of stays" up to 0: never stayed
export const neverStayed: ClashSide = { key: 'staysMax', label: 'Number of stays: 0', is: (v) => Number(v) === 0 }
