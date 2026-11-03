// Pick-lists and labels for consent and the marketing list (Module 5).
// Mirrors the CHECK constraints in backend/src/db/schema/contacts.ts and
// the rules in backend/src/consent/consent-rules.ts.

export const CONSENT_CHANNELS = ['email', 'whatsapp'] as const
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number]

export const CHANNEL_LABELS: Record<ConsentChannel, string> = { email: 'Email', whatsapp: 'WhatsApp' }

export const CONSENT_STATUSES = ['opted_in', 'opted_out', 'not_opted_in', 'unknown'] as const
export type ConsentStatus = (typeof CONSENT_STATUSES)[number]

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  opted_in: 'Opted in',
  opted_out: 'Opted out',
  not_opted_in: 'Not opted in',
  unknown: 'Unknown',
}

// Opted in green, opted out red; not opted in and unknown grey (both mean no marketing).
export const CONSENT_CHIP_CLASSES: Record<ConsentStatus, string> = {
  opted_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  opted_out: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  not_opted_in: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

export const CONSENT_SOURCES = [
  'wix',
  'website_form',
  'booking_form',
  'check_in_form',
  'whatsapp',
  'in_person',
  'email_unsubscribe',
  'do_not_contact',
  'contact_import',
  'campaign_form',
  'other',
] as const
export type ConsentSource = (typeof CONSENT_SOURCES)[number]

export const CONSENT_SOURCE_LABELS: Record<ConsentSource, string> = {
  wix: 'Wix',
  website_form: 'Website form',
  booking_form: 'Booking form',
  check_in_form: 'Check-in form',
  whatsapp: 'WhatsApp',
  in_person: 'In person',
  email_unsubscribe: 'Email unsubscribe',
  do_not_contact: 'Do not contact request',
  contact_import: 'Contact import',
  campaign_form: 'Campaign form',
  other: 'Other',
}

// What staff can pick in the Change dialog; 'do_not_contact' is set by the database,
// 'contact_import' by Settings → Import contacts and 'campaign_form' by a campaign's form.
export const CHOICE_SOURCES: ConsentSource[] = [
  'check_in_form',
  'booking_form',
  'website_form',
  'whatsapp',
  'in_person',
  'email_unsubscribe',
  'wix',
  'other',
]

// ---------- the marketing email list ----------
export type NotOnListReason = 'do_not_contact' | 'no_opt_in' | 'no_personal_email' | 'email_bounced' | 'email_invalid'

export const NOT_ON_LIST_LABELS: Record<NotOnListReason, string> = {
  do_not_contact: 'do not contact',
  no_opt_in: 'no email opt-in',
  no_personal_email: 'no personal email',
  email_bounced: 'email bounced',
  email_invalid: 'email marked wrong',
}

// 'YYYY-MM-DD' for today, where the user is
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------- unsubscribe and bounce files ----------
const EMAIL = /[^\s@<>()[\],;:"']+@[^\s@<>()[\],;:"']+\.[a-z]{2,}/i

// The email addresses in a file from the email tool: the column with the most
// of them (so a "from" or "list" address elsewhere is left out), with any
// display name around them dropped ("Ann <ann@example.com>").
export function emailsFromGrid(grid: string[][]): { column: string | null; emails: string[] } {
  const width = Math.max(0, ...grid.map((row) => row.length))
  let best = -1
  let bestCount = 0
  for (let c = 0; c < width; c++) {
    const n = grid.filter((row) => EMAIL.test(row[c] ?? '')).length
    if (n > bestCount) [best, bestCount] = [c, n]
  }
  if (best < 0) return { column: null, emails: [] }
  const heading = grid.find((row) => row[best])?.[best] ?? ''
  return {
    column: heading && !EMAIL.test(heading) ? heading : `Column ${String.fromCharCode(65 + (best % 26))}`,
    emails: grid.map((row) => (row[best] ?? '').match(EMAIL)?.[0]).filter((e): e is string => !!e),
  }
}
