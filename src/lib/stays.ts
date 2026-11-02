// Pick-lists and labels for stays. Mirrors the CHECK constraints in
// backend/src/db/schema/stays.ts and the rules in backend/src/stays/stay-rules.ts.

export const STAY_STATUSES = ['booked', 'checked_in', 'checked_out', 'cancelled', 'no_show'] as const
export type StayStatus = (typeof STAY_STATUSES)[number]

export const STAY_STATUS_LABELS: Record<StayStatus, string> = {
  booked: 'Booked',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

// Chip colours: violet for a booking still to come, green while in house,
// neutral once over, red / orange for the ones that didn't happen.
export const STAY_STATUS_CHIP_CLASSES: Record<StayStatus, string> = {
  booked: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  checked_in: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  checked_out: 'bg-secondary text-secondary-foreground',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
}

// Cancelled and no-show stays stay on the record, struck through, and don't count.
export const didNotHappen = (status: StayStatus) => status === 'cancelled' || status === 'no_show'

// A stay entered by hand can already be in house or over (a walk-in recorded afterwards).
export const NEW_STAY_STATUSES: StayStatus[] = ['booked', 'checked_in', 'checked_out']

export const STAY_CHANNELS = [
  'direct',
  'travel_agent',
  'ota',
  'owner_guest',
  'website',
  'walk_in',
  'online_unclear',
  'mixed',
  'unknown',
] as const
export type StayChannel = (typeof STAY_CHANNELS)[number]

export const CHANNEL_LABELS: Record<StayChannel, string> = {
  direct: 'Direct',
  travel_agent: 'Travel agent',
  ota: 'OTA',
  owner_guest: "Owner's guest",
  website: 'Website',
  walk_in: 'Walk-in',
  online_unclear: 'Online (unclear)',
  mixed: 'Mixed',
  unknown: 'Unknown',
}

// The quick filters across the top of the stays list.
export const QUICK_VIEWS = ['arriving_today', 'in_house', 'departing_today', 'arriving_week'] as const
export type QuickView = (typeof QUICK_VIEWS)[number]

export const QUICK_VIEW_LABELS: Record<QuickView, string> = {
  arriving_today: 'Arriving today',
  in_house: 'In house',
  departing_today: 'Departing today',
  arriving_week: 'Arriving this week',
}

// The buttons on the stay detail for each status, in the order shown.
// The first is the main next step. Mirrors STATUS_CHANGES in the API.
export interface StatusAction {
  to: StayStatus
  label: string
  primary?: boolean
  destructive?: boolean
}

export const STATUS_ACTIONS: Record<StayStatus, StatusAction[]> = {
  booked: [
    { to: 'checked_in', label: 'Check in', primary: true },
    { to: 'no_show', label: 'Mark no-show' },
    { to: 'cancelled', label: 'Cancel stay', destructive: true },
  ],
  checked_in: [
    { to: 'checked_out', label: 'Check out', primary: true },
    { to: 'booked', label: 'Undo check-in' },
    { to: 'cancelled', label: 'Cancel stay', destructive: true },
  ],
  checked_out: [
    { to: 'checked_in', label: 'Undo check-out' },
    { to: 'cancelled', label: 'Cancel stay', destructive: true },
  ],
  cancelled: [{ to: 'booked', label: 'Reinstate' }],
  no_show: [{ to: 'booked', label: 'Reinstate' }],
}

// Common currencies for the revenue field; any 3-letter code is accepted.
export const COMMON_CURRENCIES = ['USD', 'LKR', 'EUR', 'GBP', 'INR', 'AUD']

// "3 nights"
export const nightsLabel = (n: number | null) => (n == null ? '' : `${n} ${n === 1 ? 'night' : 'nights'}`)

// "2 adults, 1 child"
export function partyLabel(adults: number | null, children: number | null) {
  const parts: string[] = []
  if (adults) parts.push(`${adults} ${adults === 1 ? 'adult' : 'adults'}`)
  if (children) parts.push(`${children} ${children === 1 ? 'child' : 'children'}`)
  return parts.join(', ')
}

// Nights between two 'YYYY-MM-DD' dates, as the database works them out
export function nightsBetween(arrival: string, departure: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(departure)) return null
  return Math.round((Date.parse(`${departure}T00:00Z`) - Date.parse(`${arrival}T00:00Z`)) / 86_400_000)
}
