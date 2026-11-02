import {
  BedDoubleIcon,
  BookUserIcon,
  CircleEllipsisIcon,
  HeartPulseIcon,
  MountainIcon,
  PartyPopperIcon,
  UtensilsCrossedIcon,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from './format'
import type { StaffRole } from './permissions'
import type { StayChip } from './types'

// Pick-lists and labels for what staff know about a guest (Module 4).
// Mirrors the CHECK constraints in backend/src/db/schema/contacts.ts and the
// rules in backend/src/knowledge/special-date-rules.ts.

// ---------- likes and dislikes ----------
export const PREFERENCE_KINDS = ['like', 'dislike'] as const
export type PreferenceKind = (typeof PREFERENCE_KINDS)[number]

export const PREFERENCE_KIND_LABELS: Record<PreferenceKind, string> = { like: 'Like', dislike: 'Dislike' }

export const PREFERENCE_CATEGORIES = [
  'food_drink',
  'dietary_health',
  'room',
  'activity',
  'occasion',
  'background',
  'other',
] as const
export type PreferenceCategory = (typeof PREFERENCE_CATEGORIES)[number]

export const PREFERENCE_CATEGORY_LABELS: Record<PreferenceCategory, string> = {
  food_drink: 'Food and drink',
  dietary_health: 'Dietary or health',
  room: 'Room',
  activity: 'Activity',
  occasion: 'Occasion',
  background: 'Background',
  other: 'Other',
}

export const PREFERENCE_CATEGORY_ICONS: Record<PreferenceCategory, LucideIcon> = {
  food_drink: UtensilsCrossedIcon,
  dietary_health: HeartPulseIcon,
  room: BedDoubleIcon,
  activity: MountainIcon,
  occasion: PartyPopperIcon,
  background: BookUserIcon,
  other: CircleEllipsisIcon,
}

// Likes green, dislikes red.
export const PREFERENCE_CHIP_CLASSES: Record<PreferenceKind, string> = {
  like: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  dislike: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}

// "Rock Villa, 3 Nov 2026" – the stay a note or preference is linked to
export const stayChipLabel = (stay: Pick<StayChip, 'hotel' | 'arrivalDate'>) =>
  stay.arrivalDate ? `${stay.hotel}, ${formatDate(stay.arrivalDate)}` : stay.hotel

// ---------- notes ----------
// Only the author or an admin can edit or delete a note (imported notes have no author).
export const mayChangeNote = (note: { authorId: number | null }, me: { id: number; role: StaffRole } | undefined) =>
  !!me && (me.role === 'admin' || (note.authorId !== null && note.authorId === me.id))

// ---------- special dates ----------
export const SPECIAL_DATE_OCCASIONS = [
  'birthday',
  'wedding_anniversary',
  'partner_birthday',
  'child_birthday',
  'other',
] as const
export type SpecialDateOccasion = (typeof SPECIAL_DATE_OCCASIONS)[number]

export const SPECIAL_DATE_LABELS: Record<SpecialDateOccasion, string> = {
  birthday: 'Birthday',
  wedding_anniversary: 'Wedding anniversary',
  partner_birthday: "Partner's birthday",
  child_birthday: "Child's birthday",
  other: 'Other',
}

// What the name box is for, per occasion.
export const SPECIAL_DATE_NAME_HINTS: Record<SpecialDateOccasion, string | null> = {
  birthday: null,
  wedding_anniversary: "Partner's name",
  partner_birthday: "Partner's name",
  child_birthday: "Child's name",
  other: 'What it is, e.g. Graduation',
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// How far ahead "in 12 days" is shown, and the Upcoming occasions window.
export const UPCOMING_DAYS = 60

// "3 November 2015", or "3 November" without a year
export const specialDateLabel = (d: { day: number; month: number; year: number | null }) =>
  [d.day, MONTHS[d.month - 1], d.year].filter((v) => v != null).join(' ')

// "today", "tomorrow", "in 12 days"
export const daysAwayLabel = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`)

// Age turning for birthdays; years for anniversaries and other dates.
export function yearsLabel(occasion: SpecialDateOccasion, years: number | null) {
  if (years == null) return null
  if (occasion === 'wedding_anniversary' || occasion === 'other') return years === 1 ? '1 year' : `${years} years`
  return `turning ${years}`
}

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

// The same checks as the API, so the form can say what's wrong before saving.
export function specialDateError(day: number, month: number, year: number | null, thisYear = new Date().getFullYear()) {
  if (!Number.isInteger(month) || month < 1 || month > 12) return 'Choose a month'
  if (!Number.isInteger(day) || day < 1 || day > 31) return 'Enter a day between 1 and 31'
  if (year != null) {
    if (!Number.isInteger(year) || year < 1900) return 'Enter a year from 1900, or leave it blank'
    if (year > thisYear) return "The year can't be in the future"
  }
  const days = month === 2 ? (year == null || isLeapYear(year) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
  if (day > days) {
    if (month === 2 && day === 29) return `${year} wasn't a leap year, so it had no 29 February`
    return `${MONTHS[month - 1]} has only ${days} days`
  }
  return null
}
