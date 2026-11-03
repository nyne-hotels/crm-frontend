import {
  BuildingIcon,
  CalendarCheckIcon,
  CameraIcon,
  FootprintsIcon,
  GlobeIcon,
  HandshakeIcon,
  MailIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  StoreIcon,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from './format'

// Pick-lists, labels and rules for leads, conversations and companies.
// Mirrors the CHECK constraints in backend/src/db/schema/sales.ts and
// reference.ts, and the rules in backend/src/leads/lead-rules.ts.

// ---------- lead statuses ----------
export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const OPEN_LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'quoted']
export const isOpen = (status: LeadStatus) => OPEN_LEAD_STATUSES.includes(status)

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  booked: 'Booked',
  lost: 'Lost',
}

// Chip colours: cool while being worked, violet once booked, red when lost.
export const LEAD_STATUS_CHIP_CLASSES: Record<LeadStatus, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  contacted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  quoted: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  booked: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

// A lost lead is reopened, never booked straight away; everything else can move anywhere.
export const canMoveLead = (from: LeadStatus, to: LeadStatus) =>
  from !== to && (from !== 'lost' || isOpen(to))

// Does moving a lead need anything from the user first? Lost needs a reason,
// booked a stay, quoted a quote (unless it has one), and reopening a booked or
// lost lead an owner and a follow-up date. Other moves go straight through.
export const needsDetails = (lead: { status: LeadStatus; quotedValue: number | null }, to: LeadStatus) =>
  to === 'lost' || to === 'booked' || (to === 'quoted' && lead.quotedValue == null) || (!isOpen(lead.status) && isOpen(to))

// ---------- sources ----------
// The sources staff pick. 'campaign' is set only by a campaign's public form,
// with the campaign, so it isn't offered when adding or editing a lead.
export const LEAD_SOURCES = [
  'website_form',
  'whatsapp',
  'instagram',
  'phone',
  'email',
  'agent',
  'walk_in',
  'ota_message',
  'other',
] as const
export type LeadSource = (typeof LEAD_SOURCES)[number] | 'campaign'

// every source, for filtering
export const ALL_LEAD_SOURCES: LeadSource[] = [...LEAD_SOURCES.slice(0, -1), 'campaign', 'other']

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website_form: 'Website form',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  phone: 'Phone',
  email: 'Email',
  agent: 'Agent',
  walk_in: 'Walk-in',
  ota_message: 'OTA message',
  campaign: 'Campaign',
  other: 'Other',
}

export const SOURCE_ICONS: Record<LeadSource, LucideIcon> = {
  website_form: GlobeIcon,
  whatsapp: MessageCircleIcon,
  instagram: CameraIcon, // lucide has no brand icons
  phone: PhoneIcon,
  email: MailIcon,
  agent: HandshakeIcon,
  walk_in: FootprintsIcon,
  ota_message: StoreIcon,
  campaign: MegaphoneIcon,
  other: MoreHorizontalIcon,
}

// ---------- lost reasons ----------
export const LOST_REASONS = ['price', 'dates_unavailable', 'went_elsewhere', 'no_response', 'plans_changed', 'other'] as const
export type LostReason = (typeof LOST_REASONS)[number]

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price: 'Price',
  dates_unavailable: 'Dates unavailable',
  went_elsewhere: 'Went elsewhere',
  no_response: 'No response',
  plans_changed: 'Plans changed',
  other: 'Other',
}

// ---------- follow-ups ----------
export type FollowUpState = 'overdue' | 'today' | 'later'

export function followUpState(status: LeadStatus, followUpOn: string | null, today: string): FollowUpState | null {
  if (!isOpen(status) || !followUpOn) return null
  return followUpOn < today ? 'overdue' : followUpOn === today ? 'today' : 'later'
}

export const FOLLOW_UP_FILTERS = ['overdue', 'today', 'due', 'week'] as const
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number]

export const FOLLOW_UP_FILTER_LABELS: Record<FollowUpFilter, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  due: 'Due today or overdue',
  week: 'Due in the next 7 days',
}

// ---------- conversations ----------
export const INTERACTION_KINDS = ['call', 'whatsapp', 'email', 'meeting', 'visit', 'instagram_dm'] as const
export type InteractionKind = (typeof INTERACTION_KINDS)[number]

export const INTERACTION_KIND_LABELS: Record<InteractionKind, string> = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Meeting',
  visit: 'Visit',
  instagram_dm: 'Instagram DM',
}

export const INTERACTION_ICONS: Record<InteractionKind, LucideIcon> = {
  call: PhoneIcon,
  whatsapp: MessageCircleIcon,
  email: MailIcon,
  meeting: CalendarCheckIcon,
  visit: BuildingIcon,
  instagram_dm: CameraIcon,
}

export type InteractionDirection = 'inbound' | 'outbound'

export const DIRECTION_LABELS: Record<InteractionDirection, string> = { outbound: 'We contacted them', inbound: 'They contacted us' }

// ---------- companies ----------
export const COMPANY_TYPES = ['travel_agent', 'inbound_dmc', 'outbound_agent', 'ota', 'corporate', 'media', 'other'] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  travel_agent: 'Travel agent',
  inbound_dmc: 'Inbound DMC',
  outbound_agent: 'Outbound agent',
  ota: 'OTA',
  corporate: 'Corporate',
  media: 'Media',
  other: 'Other',
}

export const COMPANY_STATUSES = ['active', 'prospect', 'dormant'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = { active: 'Active', prospect: 'Prospect', dormant: 'Dormant' }

export const COMPANY_STATUS_CHIP_CLASSES: Record<CompanyStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  prospect: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  dormant: 'bg-secondary text-secondary-foreground',
}

// ---------- words ----------
// "USD 1,600.00"
export const money = (amount: number, currency: string | null) =>
  `${currency ?? ''} ${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim()

// 'YYYY-MM-DD' in Colombo, plus n days
export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const hotelToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(new Date())

// "20 Dec 2026 – 24 Dec 2026", or the one date given
export function requestedDates(checkIn: string | null, checkOut: string | null) {
  if (checkIn && checkOut) return `${formatDate(checkIn)} – ${formatDate(checkOut)}`
  if (checkIn) return `From ${formatDate(checkIn)}`
  if (checkOut) return `Until ${formatDate(checkOut)}`
  return ''
}
