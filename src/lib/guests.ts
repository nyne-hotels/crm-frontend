// Pick-lists and labels for guests. Mirrors the CHECK constraints in
// backend/src/db/schema/contacts.ts.

export const CONTACT_TYPES = ['guest', 'lead', 'agent_contact', 'influencer'] as const
export type ContactType = (typeof CONTACT_TYPES)[number]

// The 'lead' type shows as Prospect (someone who hasn't stayed yet), so it isn't
// mistaken for a lead on the Leads tab (one enquiry being followed up).
export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  guest: 'Guest',
  lead: 'Prospect',
  agent_contact: 'Agent contact',
  influencer: 'Influencer',
}

export const LIFECYCLE_STAGES = [
  'lead',
  'enquired',
  'booked',
  'stayed',
  'repeat_guest',
  'stayed_hotel_unknown',
  'agent_contact',
  'influencer',
] as const
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number]

// The stage filter offers the guest stages; agent contacts and influencers are found by type.
export const STAGE_FILTER_OPTIONS: LifecycleStage[] = [
  'lead',
  'enquired',
  'booked',
  'stayed',
  'repeat_guest',
  'stayed_hotel_unknown',
]

// The 'lead' stage shows as Not enquired (no lead on the Leads tab yet), like the type shows as Prospect.
export const STAGE_LABELS: Record<LifecycleStage, string> = {
  lead: 'Not enquired',
  enquired: 'Enquired',
  booked: 'Booked',
  stayed: 'Stayed',
  repeat_guest: 'Repeat guest',
  stayed_hotel_unknown: 'Hotel unknown',
  agent_contact: 'Agent contact',
  influencer: 'Influencer',
}

// Chip colours: cool for not-yet-stayed, green for stayed, gold for repeat guests.
export const STAGE_CHIP_CLASSES: Record<LifecycleStage, string> = {
  lead: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  enquired: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  booked: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  stayed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  repeat_guest: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  stayed_hotel_unknown: 'bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
  agent_contact: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  influencer: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
}

export const MARKETS = ['local', 'foreign', 'unknown'] as const
export type Market = (typeof MARKETS)[number]

export const MARKET_LABELS: Record<Market, string> = { local: 'Local', foreign: 'Foreign', unknown: 'Market unknown' }

// Sri Lanka is local, any other country foreign, no country unknown. Staff can override it.
export const marketForCountry = (code: string | null): Market => (!code ? 'unknown' : code === 'LK' ? 'local' : 'foreign')

export type ContactMethodKind = 'email' | 'phone'

export const CONTACT_METHOD_STATUSES = ['valid', 'unverified', 'bounced', 'invalid'] as const
export type ContactMethodStatus = (typeof CONTACT_METHOD_STATUSES)[number]

// Emails can bounce; phones can only be wrong.
export const STATUS_OPTIONS: Record<ContactMethodKind, ContactMethodStatus[]> = {
  email: ['valid', 'unverified', 'bounced', 'invalid'],
  phone: ['valid', 'unverified', 'invalid'],
}

export const STATUS_LABELS: Record<ContactMethodKind, Record<ContactMethodStatus, string>> = {
  email: { valid: 'Valid', unverified: 'Unverified', bounced: 'Bounced', invalid: 'Invalid' },
  phone: { valid: 'Valid', unverified: 'Unverified', bounced: 'Bounced', invalid: 'Wrong number' },
}

export const KIND_LABELS: Record<ContactMethodKind, string> = { email: 'email', phone: 'phone number' }
