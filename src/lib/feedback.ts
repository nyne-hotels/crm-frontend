import { formatDate } from './format'

// Guest feedback and employees (Module 8). Mirrors the CHECK constraints in
// backend/src/db/schema and the rules in backend/src/feedback/feedback-rules.ts.

// Ratings of 1 or 2 need follow-up until a manager marks them followed up.
export const LOW_RATING = 2

export const FEEDBACK_TABS = ['all', 'needs_follow_up', 'followed_up'] as const
export type FeedbackTab = (typeof FEEDBACK_TABS)[number]

export const FEEDBACK_TAB_LABELS: Record<FeedbackTab, string> = {
  all: 'All',
  needs_follow_up: 'Needs follow-up',
  followed_up: 'Followed up',
}

export const SENTIMENTS = ['positive', 'negative'] as const
export type Sentiment = (typeof SENTIMENTS)[number]

export const SENTIMENT_LABELS: Record<Sentiment, string> = { positive: 'Praise', negative: 'Criticism' }

export const SENTIMENT_CHIP_CLASSES: Record<Sentiment, string> = {
  positive: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  negative: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export const DEPARTMENTS = [
  'front_office',
  'housekeeping',
  'food_beverage',
  'kitchen',
  'spa',
  'transport',
  'activities',
  'maintenance',
  'management',
  'other',
] as const
export type Department = (typeof DEPARTMENTS)[number]

export const DEPARTMENT_LABELS: Record<Department, string> = {
  front_office: 'Front office',
  housekeeping: 'Housekeeping',
  food_beverage: 'Food and beverage',
  kitchen: 'Kitchen',
  spa: 'Spa',
  transport: 'Transport',
  activities: 'Activities',
  maintenance: 'Maintenance',
  management: 'Management',
  other: 'Other',
}

// Only a stay that is over can have feedback.
export const STAY_NOT_OVER = 'Feedback can only be added to a checked-out stay'

// The first line of a review, for the inbox.
export const firstLine = (review: string | null) => review?.split(/\r?\n/).find((l) => l.trim())?.trim() ?? ''

// "Kamal Perera", or "Kamal" for a single name
export const employeeName = (e: { firstName: string; lastName: string | null }) =>
  [e.firstName, e.lastName].filter(Boolean).join(' ')

// ---------- matching file columns ----------
// Column titles recognised automatically, compared lower-case with letters
// and digits only, so "Booking Ref." finds the booking reference.
export const normaliseHeading = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export interface ColumnField<K extends string> {
  key: K
  label: string
  hint?: string
  headings: string[]
}

export const RESPONSE_FIELDS: ColumnField<
  'bookingReference' | 'hotel' | 'email' | 'arrivalDate' | 'rating' | 'review' | 'submittedAt'
>[] = [
  {
    key: 'bookingReference',
    label: 'Booking reference',
    hint: 'Finds the stay. Or match the email',
    headings: ['booking reference', 'booking ref', 'reference', 'ref', 'reservation', 'reservation number', 'reservation no',
      'confirmation', 'confirmation number', 'booking number', 'booking no', 'booking id'],
  },
  {
    key: 'hotel',
    label: 'Hotel',
    hint: 'Tells apart the same reference at two hotels',
    headings: ['hotel', 'hotel name', 'property', 'property name', 'which hotel did you stay at', 'where did you stay'],
  },
  {
    key: 'email',
    label: 'Guest email',
    hint: 'Finds the stay when there is no reference',
    headings: ['email', 'e mail', 'email address', 'your email', 'guest email'],
  },
  {
    key: 'arrivalDate',
    label: 'Arrival date',
    hint: 'Picks the stay when the guest has several',
    headings: ['arrival', 'arrival date', 'check in', 'check in date', 'checkin', 'date of stay', 'stay date'],
  },
  {
    key: 'rating',
    label: 'Rating (1 to 5)',
    headings: ['rating', 'overall rating', 'score', 'stars', 'overall', 'how would you rate your stay',
      'overall experience', 'rate your stay'],
  },
  {
    key: 'review',
    label: 'Review',
    headings: ['review', 'comments', 'comment', 'feedback', 'your feedback', 'tell us more', 'remarks', 'message',
      'anything else', 'additional comments'],
  },
  {
    key: 'submittedAt',
    label: 'Date received',
    hint: 'Left out, today',
    headings: ['date', 'submitted', 'submitted at', 'submission date', 'timestamp', 'date received', 'received',
      'created', 'created at', 'response date'],
  },
]

export const STAFF_FIELDS: ColumnField<'name' | 'firstName' | 'lastName' | 'department' | 'jobTitle'>[] = [
  { key: 'name', label: 'Name (full)', hint: 'Or match First and Last name', headings: ['name', 'full name', 'employee', 'employee name', 'staff name'] },
  { key: 'firstName', label: 'First name', headings: ['first name', 'firstname', 'given name', 'first'] },
  { key: 'lastName', label: 'Last name', headings: ['last name', 'lastname', 'surname', 'family name', 'last'] },
  { key: 'department', label: 'Department', headings: ['department', 'dept', 'section', 'team'] },
  { key: 'jobTitle', label: 'Job title', headings: ['job title', 'title', 'designation', 'position', 'role', 'job'] },
]

// Each field's column, by its heading. A column is used once.
export function matchColumns<K extends string>(fields: ColumnField<K>[], headers: string[]): Partial<Record<K, number>> {
  const found: Partial<Record<K, number>> = {}
  const used = new Set<number>()
  const normalised = headers.map(normaliseHeading)
  // exact headings first, then a heading that starts with one ("Rating (1-5)")
  for (const exact of [true, false]) {
    for (const field of fields) {
      if (found[field.key] !== undefined) continue
      const at = normalised.findIndex(
        (h, i) => !used.has(i) && field.headings.some((w) => (exact ? h === w : h.startsWith(`${w} `))),
      )
      if (at >= 0) {
        found[field.key] = at
        used.add(at)
      }
    }
  }
  return found
}

// The rows to send: each field's cell, by the chosen columns.
export function rowsFor<K extends string>(rows: string[][], columns: Partial<Record<K, number>>): Partial<Record<K, string>>[] {
  const entries = Object.entries(columns).filter((e): e is [K, number] => typeof e[1] === 'number')
  return rows.map((row) => Object.fromEntries(entries.map(([key, at]) => [key, row[at] ?? ''])) as Partial<Record<K, string>>)
}

// The day a response was received, in Colombo ('2026-10-21'), for the date field.
export const hotelDay = (at: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date(at))

// "1 Oct 2026 – 4 Oct 2026"
export const stayDates = (s: { arrivalDate: string | null; departureDate: string | null }) =>
  [formatDate(s.arrivalDate), formatDate(s.departureDate)].filter(Boolean).join(' – ') || 'No dates'
