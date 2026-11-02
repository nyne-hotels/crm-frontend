import type { SpreadsheetData } from '@/lib/spreadsheet'
import type { ImportFieldInfo } from '@/lib/types'

// Matching a file's columns to CRM fields, for both spreadsheet imports:
// Stays → Import bookings and Settings → Import contacts.

const normalise = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// The matching saved last time first, then column titles the CRM knows.
// Each column feeds one field at most.
export function autoMatch(fields: ImportFieldInfo[], headers: string[], saved: Record<string, string>) {
  const used = new Set<string>()
  const mapping: Record<string, string> = {}
  for (const f of fields) {
    const h = saved[f.key]
    if (h && headers.includes(h) && !used.has(h)) {
      mapping[f.key] = h
      used.add(h)
    }
  }
  for (const f of fields) {
    if (mapping[f.key]) continue
    const names = [f.label, ...f.headings].map(normalise)
    const h = headers.find((header) => !used.has(header) && names.includes(normalise(header)))
    if (h) {
      mapping[f.key] = h
      used.add(h)
    }
  }
  return mapping
}

// Each row as the API takes it: only the matched fields, as text. A matched
// field that is blank in a row is sent as ''.
export function buildRows(data: SpreadsheetData, mapping: Record<string, string>): Record<string, string>[] {
  const columns = Object.entries(mapping).map(([field, header]) => [field, data.headers.indexOf(header)] as const)
  return data.rows.map((row) => Object.fromEntries(columns.map(([field, c]) => [field, row[c] ?? ''])))
}
