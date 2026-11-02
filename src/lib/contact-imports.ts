import { CONSENT_STATUS_LABELS, type ConsentStatus } from './consent'
import {
  CONTACT_TYPE_LABELS,
  MARKET_LABELS,
  STAGE_LABELS,
  type ContactType,
  type LifecycleStage,
  type Market,
} from './guests'
import type { ContactImportSetup, ImportFieldInfo } from './types'

// Labels and helpers for Settings → Import contacts (Module 9). Mirrors
// backend/src/contact-imports/contact-import-rules.ts.

export type ContactRowGroup = 'new' | 'existing' | 'error' | 'repeated'
export type ContactDecision = 'ignore' | 'add' | 'update'
export type ContactRowOutcome = 'new' | 'updated' | 'added_again' | 'ignored' | 'error'

export const GROUP_LABELS: Record<ContactRowGroup, string> = {
  new: 'New',
  existing: 'Already in the CRM',
  error: 'Errors',
  repeated: 'Repeated in this file',
}

export const OUTCOME_LABELS: Record<ContactRowOutcome, string> = {
  new: 'New contact',
  updated: 'Updated',
  added_again: 'Added again',
  ignored: 'Ignored',
  error: 'Not imported',
}

export const OUTCOME_CLASSES: Record<ContactRowOutcome, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  updated: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  added_again: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  ignored: 'bg-muted text-muted-foreground',
  error: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export const DECISION_LABELS: Record<ContactDecision, string> = {
  ignore: 'Ignore',
  add: 'Add as a new contact',
  update: 'Update',
}

export const CHANGE_FIELDS = [
  'contact',
  'firstName',
  'lastName',
  'contactType',
  'lifecycleStage',
  'countryCode',
  'market',
  'company',
  'designation',
  'vipReason',
  'primaryEmail',
  'primaryPhone',
  'email',
  'phone',
  'sharedEmail',
  'sharedPhone',
  'emailConsent',
  'whatsappConsent',
  'tag',
  'hotel',
  'like',
  'dislike',
  'note',
] as const
export type ChangeField = (typeof CHANGE_FIELDS)[number]

// What the change log and the comparison call each field. Emails, phones,
// tags, hotels, likes, dislikes and notes are added, never replaced.
export const CHANGE_FIELD_LABELS: Record<ChangeField, string> = {
  contact: 'Contact',
  firstName: 'First name',
  lastName: 'Last name',
  contactType: 'Type',
  lifecycleStage: 'Stage',
  countryCode: 'Country',
  market: 'Market',
  company: 'Company',
  designation: 'Job title',
  vipReason: 'VIP reason',
  primaryEmail: 'Primary email',
  primaryPhone: 'Primary phone',
  email: 'Other emails',
  phone: 'Other phones',
  sharedEmail: 'Shared email',
  sharedPhone: 'Shared phone',
  emailConsent: 'Email marketing',
  whatsappConsent: 'WhatsApp marketing',
  tag: 'Tags',
  hotel: 'Hotels stayed at',
  like: 'Likes',
  dislike: 'Dislikes',
  note: 'Notes',
}

// A stored value as staff read it: 'agent_contact' → Agent contact, 'GB' → United Kingdom.
export function formatChangeValue(field: ChangeField, value: string | null, countryName?: (code: string) => string | undefined) {
  if (value == null) return null
  switch (field) {
    case 'contact':
      return value === 'added_again' ? 'Added again' : 'New contact'
    case 'contactType':
      return CONTACT_TYPE_LABELS[value as ContactType] ?? value
    case 'lifecycleStage':
      return STAGE_LABELS[value as LifecycleStage] ?? value
    case 'market':
      return MARKET_LABELS[value as Market] ?? value
    case 'emailConsent':
    case 'whatsappConsent':
      return CONSENT_STATUS_LABELS[value as ConsentStatus] ?? value
    case 'countryCode':
      return countryName?.(value) ?? value
    default:
      return value
  }
}

// ---------- the template ----------
// The template's headings are the field labels; the single Name column is
// left out, since First name and Last name are clearer.
export function templateSheets(setup: ContactImportSetup) {
  const headers = setup.fields.filter((f) => f.key !== 'fullName').map((f) => f.label)
  const lists: [string, string[]][] = [
    ['Type', Object.values(CONTACT_TYPE_LABELS)],
    ['Market', ['Local', 'Foreign', 'Unknown']],
    ['Email / WhatsApp marketing', ['Yes', 'No', '(empty: not known)']],
    ['Hotels stayed at', setup.allowed.hotels.map((h) => h.name)],
    ['Tags', setup.allowed.tags],
    ['Country', setup.allowed.countries.map((c) => c.name)],
    ['Country code', setup.allowed.countries.map((c) => c.code)],
  ]
  const longest = Math.max(...lists.map(([, values]) => values.length))
  return [
    { name: 'Contacts', headers, rows: [], widths: headers.map((h) => Math.max(14, h.length + 2)) },
    {
      name: 'Allowed values',
      headers: lists.map(([name]) => name),
      rows: Array.from({ length: longest }, (_, i) => lists.map(([, values]) => values[i] ?? '')),
      widths: [16, 10, 26, 22, 22, 36, 14],
    },
  ]
}

// ---------- the result file ----------
// Every row of the upload with what happened to it, then the error rows alone.
export function resultSheets(
  headers: string[],
  rows: string[][],
  results: { row: number; outcome: ContactRowOutcome; contactId: number | null; reason: string | null }[],
) {
  const extra = ['What happened', 'Contact ID', 'Why']
  const line = (r: (typeof results)[number]) => [
    ...(rows[r.row - 1] ?? []),
    OUTCOME_LABELS[r.outcome],
    r.contactId ? String(r.contactId) : '',
    r.reason ?? '',
  ]
  return [
    { name: 'All rows', headers: [...headers, ...extra], rows: results.map(line) },
    { name: 'Errors', headers: [...headers, ...extra], rows: results.filter((r) => r.outcome === 'error').map(line) },
  ]
}

// The matched columns of a past import, in the order of the CRM's fields,
// for the result file rebuilt from the history.
export function matchedColumns(fields: ImportFieldInfo[], mapping: Record<string, string>) {
  return fields.filter((f) => mapping[f.key]).map((f) => ({ key: f.key, heading: mapping[f.key] }))
}
