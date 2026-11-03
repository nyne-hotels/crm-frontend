// Filters that live in the address, shared by the lists' "More filters" panels.
type Update = (changes: Record<string, string | undefined>) => void

// A range's two ends count as one filter: arrivalFrom + arrivalTo, staysMin + staysMax;
// so do "Missing" and whether any or all of it must be missing (missingMatch).
const filterName = (key: string) => key.replace(/(From|To|Min|Max|Match)$/, '')

export function countFilters(params: URLSearchParams, keys: readonly string[]) {
  return new Set(keys.filter((k) => params.has(k)).map(filterName)).size
}

// Binds the panel's fields to filters in the address. `update` is the page's
// own setter, so changing a filter goes back to page 1 like the rest.
export function filterFields(params: URLSearchParams, update: Update) {
  return {
    choice: (key: string) => ({
      value: params.get(key) ?? undefined,
      onChange: (value: string | undefined) => update({ [key]: value }),
    }),
    // several values, kept as 'a,b' in the address
    multi: (key: string) => ({
      values: listOf(params, key),
      onChange: (values: string[]) => update({ [key]: values.join(',') || undefined }),
    }),
    range: (fromKey: string, toKey: string) => ({
      from: params.get(fromKey) ?? undefined,
      to: params.get(toKey) ?? undefined,
      onFromChange: (value: string | undefined) => update({ [fromKey]: value }),
      onToChange: (value: string | undefined) => update({ [toKey]: value }),
    }),
  }
}

// A filter that can have several values: '?stage=stayed,repeat_guest'.
export const listOf = (params: URLSearchParams, key: string) => (params.get(key) ?? '').split(',').filter(Boolean)

// The filters named in `keys`, as the address has them, for a list's query.
// The end of a range that's before its start is left out until it's put right,
// so the list keeps showing results while the panel points it out.
export function pickParams<K extends string>(params: URLSearchParams, keys: readonly K[]) {
  const picked: Partial<Record<K, string>> = {}
  for (const key of keys) {
    const value = params.get(key) ?? undefined
    const start = rangeStart(key)
    const from = start && params.get(start)
    if (value && from && isBackwards(from, value)) continue
    picked[key] = value
  }
  return picked
}

// arrivalTo → arrivalFrom, staysMax → staysMin
const rangeStart = (key: string) =>
  key.endsWith('To') ? `${key.slice(0, -2)}From` : key.endsWith('Max') ? `${key.slice(0, -3)}Min` : null

// Days ('2026-03-01') compare as text, anything else as numbers.
export const isBackwards = (from: string, to: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(from) ? from > to : Number(from) > Number(to)

// Turns a label map into select options, in the order given.
export const optionsFrom = <K extends string>(keys: readonly K[], labels: Record<K, string>) =>
  keys.map((k) => ({ value: k, label: labels[k] }))
